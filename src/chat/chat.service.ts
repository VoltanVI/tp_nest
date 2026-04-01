import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
  ) {}

  async createMessage(content: string, username: string, userColor?: string): Promise<Message> {
    const message = new this.messageModel({
      content,
      username,
      userColor: userColor || '#1877f2',
    });

    const savedMessage = await message.save();
    this.logger.log(`Message saved: ${savedMessage._id} from ${username}`);
    return savedMessage;
  }

  async getAllMessages(): Promise<Message[]> {
    const messages = await this.messageModel
      .find()
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();
    this.logger.log(`Retrieved ${messages.length} messages from database`);
    return messages;
  }

  async toggleReaction(messageId: string, emoji: string, username: string): Promise<Message> {
    const message = await this.messageModel.findById(messageId);
    
    if (!message) {
      throw new Error('Message not found');
    }

    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
    
    if (reactionIndex === -1) {
      message.reactions.push({ emoji, users: [username] });
    } else {
      const userIndex = message.reactions[reactionIndex].users.indexOf(username);
      
      if (userIndex === -1) {
        message.reactions[reactionIndex].users.push(username);
      } else {
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

  async updateUserColor(username: string, newColor: string): Promise<void> {
    const result = await this.messageModel.updateMany(
      { username },
      { $set: { userColor: newColor } }
    );
    this.logger.log(`Updated color for ${result.modifiedCount} messages from ${username}`);
  }
}
