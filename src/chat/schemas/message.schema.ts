import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export interface Reaction {
  emoji: string;
  users: string[];
}

@Schema({ timestamps: true })
export class Message {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  username: string;

  @Prop({ default: '#1877f2' })
  userColor: string;

  @Prop({ type: [{ emoji: String, users: [String] }], default: [] })
  reactions: Reaction[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
