import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { Room, RoomDocument, RoomMember } from './schemas/room.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    @InjectModel(Room.name)
    private roomModel: Model<RoomDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async createMessage(
    content: string,
    username: string,
    userColor?: string,
    roomId?: string,
  ): Promise<Message> {
    const message = new this.messageModel({
      content,
      username,
      userColor: userColor || '#1877f2',
      roomId: roomId ? new Types.ObjectId(roomId) : null,
    });

    const savedMessage = await message.save();
    this.logger.log(
      `Message saved: ${savedMessage._id} from ${username} in ${roomId || 'general'}`,
    );
    return savedMessage;
  }

  async getAllMessages(roomId?: string): Promise<Message[]> {
    const filter = roomId
      ? { roomId: new Types.ObjectId(roomId) }
      : { roomId: null };

    const messages = await this.messageModel
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();
    this.logger.log(`Retrieved ${messages.length} messages`);
    return messages;
  }

  async getMessagesAfterDate(
    roomId: string,
    afterDate: Date,
  ): Promise<Message[]> {
    const messages = await this.messageModel
      .find({
        roomId: new Types.ObjectId(roomId),
        createdAt: { $gte: afterDate },
      })
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();
    return messages;
  }

  async toggleReaction(
    messageId: string,
    emoji: string,
    username: string,
  ): Promise<Message> {
    const message = await this.messageModel.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    const reactionIndex = message.reactions.findIndex((r) => r.emoji === emoji);

    if (reactionIndex === -1) {
      message.reactions.push({ emoji, users: [username] });
    } else {
      const userIndex =
        message.reactions[reactionIndex].users.indexOf(username);

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
    this.logger.log(
      `Reaction ${emoji} toggled on message ${messageId} by ${username}`,
    );
    return updatedMessage;
  }

  async updateUserColor(username: string, newColor: string): Promise<void> {
    const result = await this.messageModel.updateMany(
      { username },
      { $set: { userColor: newColor } },
    );
    this.logger.log(
      `Updated color for ${result.modifiedCount} messages from ${username}`,
    );
  }

  async resolveUsername(typed: string): Promise<string | null> {
    const user = await this.userModel
      .findOne({ username: { $regex: new RegExp(`^${typed}$`, 'i') } })
      .exec();
    return user ? user.username : null;
  }

  async createRoom(
    name: string,
    creator: string,
    members: RoomMember[],
  ): Promise<Room> {
    const validatedMembers: RoomMember[] = [];
    const invalidUsernames: string[] = [];

    for (const m of members) {
      if (m.username === creator) continue;
      const realUsername = await this.resolveUsername(m.username);
      if (realUsername) {
        validatedMembers.push({
          username: realUsername,
          hasHistoryAccess: m.hasHistoryAccess,
        });
      } else {
        invalidUsernames.push(m.username);
      }
    }

    if (invalidUsernames.length > 0) {
      throw new Error(
        `Utilisateur(s) introuvable(s) : ${invalidUsernames.join(', ')}`,
      );
    }

    const joinedAt = new Date();
    const allMembers: RoomMember[] = [
      { username: creator, hasHistoryAccess: true, joinedAt },
      ...validatedMembers.map((m) => ({ ...m, joinedAt })),
    ];

    const room = new this.roomModel({
      name,
      creator,
      members: allMembers,
    });

    await room.save();
    const savedRoom = await this.roomModel
      .findById(room._id)
      .lean()
      .exec();
    this.logger.log(
      `Room "${name}" created by ${creator} with ${allMembers.length} members`,
    );
    return savedRoom as Room;
  }

  async getRoomsByUser(username: string): Promise<Room[]> {
    return this.roomModel
      .find({ 'members.username': username })
      .sort({ updatedAt: -1 })
      .lean()
      .exec() as Promise<Room[]>;
  }

  async getRoomById(roomId: string): Promise<Room | null> {
    return this.roomModel.findById(roomId).lean().exec() as Promise<Room | null>;
  }

  async isRoomMember(roomId: string, username: string): Promise<boolean> {
    const room = await this.roomModel.findOne({
      _id: roomId,
      'members.username': username,
    });
    return !!room;
  }

  async getMemberAccess(
    roomId: string,
    username: string,
  ): Promise<RoomMember | null> {
    const room = await this.roomModel.findById(roomId);
    if (!room) return null;
    return room.members.find((m) => m.username === username) || null;
  }

  async getRoomMessagesForMember(
    roomId: string,
    username: string,
  ): Promise<Message[]> {
    const room = await this.getRoomById(roomId);
    if (!room) return [];

    const member = room.members.find((m) => m.username === username);
    if (!member) return [];

    if (member.hasHistoryAccess) {
      return this.getAllMessages(roomId);
    }

    let from: Date;
    if (member.joinedAt != null) {
      from = new Date(member.joinedAt as Date);
    } else {
      const m = member as RoomMember & { _id?: Types.ObjectId | string };
      if (m._id != null && Types.ObjectId.isValid(String(m._id))) {
        from = new Types.ObjectId(String(m._id)).getTimestamp();
      } else {
        from = new Date(room.createdAt || Date.now());
      }
    }

    return this.getMessagesAfterDate(roomId, from);
  }

  async deleteRoom(roomId: string, username: string): Promise<boolean> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new Error('Room not found');
    if (room.creator !== username) throw new Error('Only the creator can delete this room');

    await this.messageModel.deleteMany({ roomId: room._id });
    await this.roomModel.findByIdAndDelete(roomId);
    this.logger.log(`Room "${room.name}" deleted by ${username}`);
    return true;
  }

  async addMembersToRoom(
    roomId: string,
    username: string,
    newMembers: RoomMember[],
  ): Promise<{ room: Room; addedUsernames: string[] }> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new Error('Room not found');
    if (room.creator !== username)
      throw new Error('Only the creator can add members');

    const existingUsernames = room.members.map((m) => m.username);
    const validatedToAdd: RoomMember[] = [];
    const invalidUsernames: string[] = [];

    const joinedAt = new Date();
    for (const m of newMembers) {
      const realUsername = await this.resolveUsername(m.username);
      if (!realUsername) {
        invalidUsernames.push(m.username);
      } else if (!existingUsernames.includes(realUsername)) {
        validatedToAdd.push({
          username: realUsername,
          hasHistoryAccess: m.hasHistoryAccess,
          joinedAt,
        });
      }
    }

    if (invalidUsernames.length > 0) {
      throw new Error(
        `Utilisateur(s) introuvable(s) : ${invalidUsernames.join(', ')}`,
      );
    }

    if (validatedToAdd.length === 0)
      throw new Error('All users are already members');

    room.members.push(...validatedToAdd);
    await room.save();
    const updatedRoom = await this.roomModel
      .findById(room._id)
      .lean()
      .exec();
    this.logger.log(
      `Added ${validatedToAdd.length} members to room "${room.name}" by ${username}`,
    );
    return {
      room: updatedRoom as Room,
      addedUsernames: validatedToAdd.map((m) => m.username),
    };
  }
}
