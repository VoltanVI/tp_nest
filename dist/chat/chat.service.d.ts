import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { Room, RoomDocument, RoomMember } from './schemas/room.schema';
import { UserDocument } from '../users/schemas/user.schema';
export declare class ChatService {
    private messageModel;
    private roomModel;
    private userModel;
    private readonly logger;
    constructor(messageModel: Model<MessageDocument>, roomModel: Model<RoomDocument>, userModel: Model<UserDocument>);
    createMessage(content: string, username: string, userColor?: string, roomId?: string): Promise<Message>;
    getAllMessages(roomId?: string): Promise<Message[]>;
    getMessagesAfterDate(roomId: string, afterDate: Date): Promise<Message[]>;
    toggleReaction(messageId: string, emoji: string, username: string): Promise<Message>;
    updateUserColor(username: string, newColor: string): Promise<void>;
    resolveUsername(typed: string): Promise<string | null>;
    createRoom(name: string, creator: string, members: RoomMember[]): Promise<Room>;
    getRoomsByUser(username: string): Promise<Room[]>;
    getRoomById(roomId: string): Promise<Room | null>;
    isRoomMember(roomId: string, username: string): Promise<boolean>;
    getMemberAccess(roomId: string, username: string): Promise<RoomMember | null>;
    getRoomMessagesForMember(roomId: string, username: string): Promise<Message[]>;
    deleteRoom(roomId: string, username: string): Promise<boolean>;
    addMembersToRoom(roomId: string, username: string, newMembers: RoomMember[]): Promise<{
        room: Room;
        addedUsernames: string[];
    }>;
}
