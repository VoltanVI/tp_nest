import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { username: string; userColor?: string },
    @ConnectedSocket() client: Socket,
  ) {
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

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { content: string; roomId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';
    const userColor = client.data.userColor || '#1877f2';

    if (data.roomId) {
      const isMember = await this.chatService.isRoomMember(
        data.roomId,
        username,
      );
      if (!isMember) {
        return { success: false, error: 'Not a member of this room' };
      }
    }

    const message = await this.chatService.createMessage(
      data.content,
      username,
      userColor,
      data.roomId,
    );

    if (data.roomId) {
      this.server.to(`room:${data.roomId}`).emit('newMessage', message);
    } else {
      this.server.emit('newMessage', message);
    }

    return message;
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @MessageBody() data: { roomId?: string } = {},
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';

    if (data?.roomId) {
      const memberAccess = await this.chatService.getMemberAccess(
        data.roomId,
        username,
      );
      if (!memberAccess) {
        client.emit('getMessages', []);
        return;
      }

      const messages = await this.chatService.getRoomMessagesForMember(
        data.roomId,
        username,
      );
      client.emit('getMessages', messages);
      return;
    }

    const messages = await this.chatService.getAllMessages();
    this.logger.log(`Sending ${messages.length} messages to client`);
    client.emit('getMessages', messages);
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { isTyping: boolean; roomId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';

    const payload = {
      username,
      isTyping: data.isTyping,
    };

    if (data.roomId) {
      client.to(`room:${data.roomId}`).emit('userTyping', payload);
    } else {
      client.broadcast.emit('userTyping', payload);
    }
  }

  @SubscribeMessage('toggleReaction')
  async handleToggleReaction(
    @MessageBody() data: { messageId: string; emoji: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';

    try {
      const updatedMessage = await this.chatService.toggleReaction(
        data.messageId,
        data.emoji,
        username,
      );

      this.server.emit('reactionUpdated', {
        messageId: data.messageId,
        reactions: updatedMessage.reactions,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error toggling reaction: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody()
    data: {
      name: string;
      members: { username: string; hasHistoryAccess: boolean }[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const creator = client.data.username || 'Anonymous';

    try {
      const room = await this.chatService.createRoom(
        data.name,
        creator,
        data.members,
      );

      client.join(`room:${room._id}`);

      const allMemberUsernames = room.members.map((m) => m.username);
      const sockets = await this.server.fetchSockets();
      for (const s of sockets) {
        if (
          allMemberUsernames.includes(s.data.username) &&
          s.id !== client.id
        ) {
          s.join(`room:${room._id}`);
          s.emit('roomInvite', room);
        }
      }

      client.emit('roomCreated', room);
      return { success: true, room };
    } catch (error) {
      this.logger.error(`Error creating room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('getRooms')
  async handleGetRooms(@ConnectedSocket() client: Socket) {
    const username = client.data.username || 'Anonymous';
    const rooms = await this.chatService.getRoomsByUser(username);
    return rooms;
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';
    const isMember = await this.chatService.isRoomMember(
      data.roomId,
      username,
    );
    if (!isMember) {
      return { success: false, error: 'Not a member of this room' };
    }

    client.join(`room:${data.roomId}`);

    const messages = await this.chatService.getRoomMessagesForMember(
      data.roomId,
      username,
    );

    client.emit('getMessages', messages);
    return { success: true };
  }

  @SubscribeMessage('deleteRoom')
  async handleDeleteRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';

    try {
      const room = await this.chatService.getRoomById(data.roomId);
      if (!room) return { success: false, error: 'Room not found' };

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
    } catch (error) {
      this.logger.error(`Error deleting room: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('addMembers')
  async handleAddMembers(
    @MessageBody()
    data: {
      roomId: string;
      members: { username: string; hasHistoryAccess: boolean }[];
    },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';

    try {
      const { room: updatedRoom, addedUsernames } =
        await this.chatService.addMembersToRoom(
          data.roomId,
          username,
          data.members,
        );

      const sockets = await this.server.fetchSockets();
      for (const s of sockets) {
        if (addedUsernames.includes(s.data.username)) {
          s.join(`room:${data.roomId}`);
          s.emit('roomInvite', updatedRoom);
        }
      }

      this.server.to(`room:${data.roomId}`).emit('roomUpdated', updatedRoom);

      return { success: true, room: updatedRoom };
    } catch (error) {
      this.logger.error(`Error adding members: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  notifyColorUpdate(username: string, newColor: string) {
    this.server.emit('userColorUpdated', {
      username,
      newColor,
    });
  }
}
