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
let ChatService = ChatService_1 = class ChatService {
    messageModel;
    logger = new common_1.Logger(ChatService_1.name);
    constructor(messageModel) {
        this.messageModel = messageModel;
    }
    async createMessage(content, username, userColor) {
        const message = new this.messageModel({
            content,
            username,
            userColor: userColor || '#1877f2',
        });
        const savedMessage = await message.save();
        this.logger.log(`Message saved: ${savedMessage._id} from ${username}`);
        return savedMessage;
    }
    async getAllMessages() {
        const messages = await this.messageModel
            .find()
            .sort({ createdAt: 1 })
            .limit(500)
            .exec();
        this.logger.log(`Retrieved ${messages.length} messages from database`);
        return messages;
    }
    async toggleReaction(messageId, emoji, username) {
        const message = await this.messageModel.findById(messageId);
        if (!message) {
            throw new Error('Message not found');
        }
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
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
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ChatService);
//# sourceMappingURL=chat.service.js.map