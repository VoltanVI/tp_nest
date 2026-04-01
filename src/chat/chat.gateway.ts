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
    
    return { success: true };
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';
    const userColor = client.data.userColor || '#1877f2';
    
    const message = await this.chatService.createMessage(
      data.content,
      username,
      userColor,
    );

    this.server.emit('newMessage', message);
    
    return message;
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages() {
    const messages = await this.chatService.getAllMessages();
    this.logger.log(`Sending ${messages.length} messages to client`);
    return messages;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const username = client.data.username || 'Anonymous';
    
    client.broadcast.emit('userTyping', {
      username,
      isTyping: data.isTyping,
    });
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
}
