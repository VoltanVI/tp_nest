import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoomDocument = Room & Document;

export interface RoomMember {
  username: string;
  hasHistoryAccess: boolean;
  joinedAt?: Date;
}

@Schema({ timestamps: true })
export class Room {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  creator: string;

  @Prop({
    type: [
      { username: String, hasHistoryAccess: Boolean, joinedAt: Date },
    ],
    default: [],
  })
  members: RoomMember[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
