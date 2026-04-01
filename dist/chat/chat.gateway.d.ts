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
        roomId?: string;
    }, client: Socket): Promise<import("./schemas/message.schema").Message | {
        success: boolean;
        error: string;
    }>;
    handleGetMessages(data: {
        roomId?: string;
    } | undefined, client: Socket): Promise<void>;
    handleTyping(data: {
        isTyping: boolean;
        roomId?: string;
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
    handleCreateRoom(data: {
        name: string;
        members: {
            username: string;
            hasHistoryAccess: boolean;
        }[];
    }, client: Socket): Promise<{
        success: boolean;
        room: import("./schemas/room.schema").Room;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        room?: undefined;
    }>;
    handleGetRooms(client: Socket): Promise<import("./schemas/room.schema").Room[]>;
    handleJoinRoom(data: {
        roomId: string;
    }, client: Socket): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    handleDeleteRoom(data: {
        roomId: string;
    }, client: Socket): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    handleAddMembers(data: {
        roomId: string;
        members: {
            username: string;
            hasHistoryAccess: boolean;
        }[];
    }, client: Socket): Promise<{
        success: boolean;
        room: import("./schemas/room.schema").Room;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        room?: undefined;
    }>;
    notifyColorUpdate(username: string, newColor: string): void;
}
