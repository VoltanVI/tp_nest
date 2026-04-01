import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly chatService;
    server: Server;
    private readonly logger;
    constructor(chatService: ChatService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoin(data: {
        username: string;
        userColor?: string;
    }, client: Socket): Promise<{
        success: boolean;
    }>;
    handleMessage(data: {
        content: string;
    }, client: Socket): Promise<import("./schemas/message.schema").Message>;
    handleGetMessages(): Promise<import("./schemas/message.schema").Message[]>;
    handleTyping(data: {
        isTyping: boolean;
    }, client: Socket): void;
    handleToggleReaction(data: {
        messageId: string;
        emoji: string;
    }, client: Socket): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
}
