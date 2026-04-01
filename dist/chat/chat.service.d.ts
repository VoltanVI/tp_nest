import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
export declare class ChatService {
    private messageModel;
    private readonly logger;
    constructor(messageModel: Model<MessageDocument>);
    createMessage(content: string, username: string, userColor?: string): Promise<Message>;
    getAllMessages(): Promise<Message[]>;
    toggleReaction(messageId: string, emoji: string, username: string): Promise<Message>;
}
