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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    chatService;
    server;
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(chatService) {
        this.chatService = chatService;
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    async handleJoin(data, client) {
        client.data.username = data.username;
        client.data.userColor = data.userColor || '#1877f2';
        this.logger.log(`${data.username} joined the chat`);
        const messages = await this.chatService.getAllMessages();
        client.emit('getMessages', messages);
        const rooms = await this.chatService.getRoomsByUser(data.username);
        for (const room of rooms) {
            client.join(`room:${room._id}`);
        }
        client.emit('roomsList', rooms);
        return { success: true };
    }
    async handleMessage(data, client) {
        const username = client.data.username || 'Anonymous';
        const userColor = client.data.userColor || '#1877f2';
        if (data.roomId) {
            const isMember = await this.chatService.isRoomMember(data.roomId, username);
            if (!isMember) {
                return { success: false, error: 'Not a member of this room' };
            }
        }
        const message = await this.chatService.createMessage(data.content, username, userColor, data.roomId);
        if (data.roomId) {
            this.server.to(`room:${data.roomId}`).emit('newMessage', message);
        }
        else {
            this.server.emit('newMessage', message);
        }
        return message;
    }
    async handleGetMessages(data = {}, client) {
        const username = client.data.username || 'Anonymous';
        if (data?.roomId) {
            const memberAccess = await this.chatService.getMemberAccess(data.roomId, username);
            if (!memberAccess) {
                client.emit('getMessages', []);
                return;
            }
            const messages = await this.chatService.getRoomMessagesForMember(data.roomId, username);
            client.emit('getMessages', messages);
            return;
        }
        const messages = await this.chatService.getAllMessages();
        this.logger.log(`Sending ${messages.length} messages to client`);
        client.emit('getMessages', messages);
    }
    handleTyping(data, client) {
        const username = client.data.username || 'Anonymous';
        const payload = {
            username,
            isTyping: data.isTyping,
        };
        if (data.roomId) {
            client.to(`room:${data.roomId}`).emit('userTyping', payload);
        }
        else {
            client.broadcast.emit('userTyping', payload);
        }
    }
    async handleToggleReaction(data, client) {
        const username = client.data.username || 'Anonymous';
        try {
            const updatedMessage = await this.chatService.toggleReaction(data.messageId, data.emoji, username);
            this.server.emit('reactionUpdated', {
                messageId: data.messageId,
                reactions: updatedMessage.reactions,
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Error toggling reaction: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    async handleCreateRoom(data, client) {
        const creator = client.data.username || 'Anonymous';
        try {
            const room = await this.chatService.createRoom(data.name, creator, data.members);
            client.join(`room:${room._id}`);
            const allMemberUsernames = room.members.map((m) => m.username);
            const sockets = await this.server.fetchSockets();
            for (const s of sockets) {
                if (allMemberUsernames.includes(s.data.username) &&
                    s.id !== client.id) {
                    s.join(`room:${room._id}`);
                    s.emit('roomInvite', room);
                }
            }
            client.emit('roomCreated', room);
            return { success: true, room };
        }
        catch (error) {
            this.logger.error(`Error creating room: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    async handleGetRooms(client) {
        const username = client.data.username || 'Anonymous';
        const rooms = await this.chatService.getRoomsByUser(username);
        return rooms;
    }
    async handleJoinRoom(data, client) {
        const username = client.data.username || 'Anonymous';
        const isMember = await this.chatService.isRoomMember(data.roomId, username);
        if (!isMember) {
            return { success: false, error: 'Not a member of this room' };
        }
        client.join(`room:${data.roomId}`);
        const messages = await this.chatService.getRoomMessagesForMember(data.roomId, username);
        client.emit('getMessages', messages);
        return { success: true };
    }
    async handleDeleteRoom(data, client) {
        const username = client.data.username || 'Anonymous';
        try {
            const room = await this.chatService.getRoomById(data.roomId);
            if (!room)
                return { success: false, error: 'Room not found' };
            await this.chatService.deleteRoom(data.roomId, username);
            this.server.to(`room:${data.roomId}`).emit('roomDeleted', {
                roomId: data.roomId,
                roomName: room.name,
            });
            const sockets = await this.server.fetchSockets();
            for (const s of sockets) {
                s.leave(`room:${data.roomId}`);
            }
            return { success: true };
        }
        catch (error) {
            this.logger.error(`Error deleting room: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    async handleAddMembers(data, client) {
        const username = client.data.username || 'Anonymous';
        try {
            const { room: updatedRoom, addedUsernames } = await this.chatService.addMembersToRoom(data.roomId, username, data.members);
            const sockets = await this.server.fetchSockets();
            for (const s of sockets) {
                if (addedUsernames.includes(s.data.username)) {
                    s.join(`room:${data.roomId}`);
                    s.emit('roomInvite', updatedRoom);
                }
            }
            this.server.to(`room:${data.roomId}`).emit('roomUpdated', updatedRoom);
            return { success: true, room: updatedRoom };
        }
        catch (error) {
            this.logger.error(`Error adding members: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    notifyColorUpdate(username, newColor) {
        this.server.emit('userColorUpdated', {
            username,
            newColor,
        });
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getMessages'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleGetMessages", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggleReaction'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleToggleReaction", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getRooms'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleGetRooms", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('deleteRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleDeleteRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('addMembers'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleAddMembers", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map