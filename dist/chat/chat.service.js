"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const message_schema_1 = require("./schemas/message.schema");
const room_schema_1 = require("./schemas/room.schema");
const user_schema_1 = require("../users/schemas/user.schema");
let ChatService = ChatService_1 = class ChatService {
    messageModel;
    roomModel;
    userModel;
    logger = new common_1.Logger(ChatService_1.name);
    constructor(messageModel, roomModel, userModel) {
        this.messageModel = messageModel;
        this.roomModel = roomModel;
        this.userModel = userModel;
    }
    async createMessage(content, username, userColor, roomId) {
        const message = new this.messageModel({
            content,
            username,
            userColor: userColor || '#1877f2',
            roomId: roomId ? new mongoose_2.Types.ObjectId(roomId) : null,
        });
        const savedMessage = await message.save();
        this.logger.log(`Message saved: ${savedMessage._id} from ${username} in ${roomId || 'general'}`);
        return savedMessage;
    }
    async getAllMessages(roomId) {
        const filter = roomId
            ? { roomId: new mongoose_2.Types.ObjectId(roomId) }
            : { roomId: null };
        const messages = await this.messageModel
            .find(filter)
            .sort({ createdAt: 1 })
            .limit(500)
            .exec();
        this.logger.log(`Retrieved ${messages.length} messages`);
        return messages;
    }
    async getMessagesAfterDate(roomId, afterDate) {
        const messages = await this.messageModel
            .find({
            roomId: new mongoose_2.Types.ObjectId(roomId),
            createdAt: { $gte: afterDate },
        })
            .sort({ createdAt: 1 })
            .limit(500)
            .exec();
        return messages;
    }
    async toggleReaction(messageId, emoji, username) {
        const message = await this.messageModel.findById(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);
        if (reactionIndex === -1) {
            message.reactions.push({ emoji, users: [username] });
        }
        else {
            const userIndex = message.reactions[reactionIndex].users.indexOf(username);
            if (userIndex === -1) {
                message.reactions[reactionIndex].users.push(username);
            }
            else {
                message.reactions[reactionIndex].users.splice(userIndex, 1);
                if (message.reactions[reactionIndex].users.length === 0) {
                    message.reactions.splice(reactionIndex, 1);
                }
            }
        }
        const updatedMessage = await message.save();
        this.logger.log(`Reaction ${emoji} toggled on message ${messageId} by ${username}`);
        return updatedMessage;
    }
    async updateUserColor(username, newColor) {
        const result = await this.messageModel.updateMany({ username }, { $set: { userColor: newColor } });
        this.logger.log(`Updated color for ${result.modifiedCount} messages from ${username}`);
    }
    async resolveUsername(typed) {
        const user = await this.userModel
            .findOne({ username: { $regex: new RegExp(`^${typed}$`, 'i') } })
            .exec();
        return user ? user.username : null;
    }
    async createRoom(name, creator, members) {
        const validatedMembers = [];
        const invalidUsernames = [];
        for (const m of members) {
            if (m.username === creator)
                continue;
            const realUsername = await this.resolveUsername(m.username);
            if (realUsername) {
                validatedMembers.push({
                    username: realUsername,
                    hasHistoryAccess: m.hasHistoryAccess,
                });
            }
            else {
                invalidUsernames.push(m.username);
            }
        }
        if (invalidUsernames.length > 0) {
            throw new Error(`Utilisateur(s) introuvable(s) : ${invalidUsernames.join(', ')}`);
        }
        const joinedAt = new Date();
        const allMembers = [
            { username: creator, hasHistoryAccess: true, joinedAt },
            ...validatedMembers.map((m) => ({ ...m, joinedAt })),
        ];
        const room = new this.roomModel({
            name,
            creator,
            members: allMembers,
        });
        await room.save();
        const savedRoom = await this.roomModel
            .findById(room._id)
            .lean()
            .exec();
        this.logger.log(`Room "${name}" created by ${creator} with ${allMembers.length} members`);
        return savedRoom;
    }
    async getRoomsByUser(username) {
        return this.roomModel
            .find({ 'members.username': username })
            .sort({ updatedAt: -1 })
            .lean()
            .exec();
    }
    async getRoomById(roomId) {
        return this.roomModel.findById(roomId).lean().exec();
    }
    async isRoomMember(roomId, username) {
        const room = await this.roomModel.findOne({
            _id: roomId,
            'members.username': username,
        });
        return !!room;
    }
    async getMemberAccess(roomId, username) {
        const room = await this.roomModel.findById(roomId);
        if (!room)
            return null;
        return room.members.find((m) => m.username === username) || null;
    }
    async getRoomMessagesForMember(roomId, username) {
        const room = await this.getRoomById(roomId);
        if (!room)
            return [];
        const member = room.members.find((m) => m.username === username);
        if (!member)
            return [];
        if (member.hasHistoryAccess) {
            return this.getAllMessages(roomId);
        }
        let from;
        if (member.joinedAt != null) {
            from = new Date(member.joinedAt);
        }
        else {
            const m = member;
            if (m._id != null && mongoose_2.Types.ObjectId.isValid(String(m._id))) {
                from = new mongoose_2.Types.ObjectId(String(m._id)).getTimestamp();
            }
            else {
                from = new Date(room.createdAt || Date.now());
            }
        }
        return this.getMessagesAfterDate(roomId, from);
    }
    async deleteRoom(roomId, username) {
        const room = await this.roomModel.findById(roomId);
        if (!room)
            throw new Error('Room not found');
        if (room.creator !== username)
            throw new Error('Only the creator can delete this room');
        await this.messageModel.deleteMany({ roomId: room._id });
        await this.roomModel.findByIdAndDelete(roomId);
        this.logger.log(`Room "${room.name}" deleted by ${username}`);
        return true;
    }
    async addMembersToRoom(roomId, username, newMembers) {
        const room = await this.roomModel.findById(roomId);
        if (!room)
            throw new Error('Room not found');
        if (room.creator !== username)
            throw new Error('Only the creator can add members');
        const existingUsernames = room.members.map((m) => m.username);
        const validatedToAdd = [];
        const invalidUsernames = [];
        const joinedAt = new Date();
        for (const m of newMembers) {
            const realUsername = await this.resolveUsername(m.username);
            if (!realUsername) {
                invalidUsernames.push(m.username);
            }
            else if (!existingUsernames.includes(realUsername)) {
                validatedToAdd.push({
                    username: realUsername,
                    hasHistoryAccess: m.hasHistoryAccess,
                    joinedAt,
                });
            }
        }
        if (invalidUsernames.length > 0) {
            throw new Error(`Utilisateur(s) introuvable(s) : ${invalidUsernames.join(', ')}`);
        }
        if (validatedToAdd.length === 0)
            throw new Error('All users are already members');
        room.members.push(...validatedToAdd);
        await room.save();
        const updatedRoom = await this.roomModel
            .findById(room._id)
            .lean()
            .exec();
        this.logger.log(`Added ${validatedToAdd.length} members to room "${room.name}" by ${username}`);
        return {
            room: updatedRoom,
            addedUsernames: validatedToAdd.map((m) => m.username),
        };
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __param(1, (0, mongoose_1.InjectModel)(room_schema_1.Room.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map