import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
export declare class UsersController {
    private readonly usersService;
    private readonly chatService;
    private readonly chatGateway;
    constructor(usersService: UsersService, chatService: ChatService, chatGateway: ChatGateway);
    findAll(): Promise<import("./schemas/user.schema").User[]>;
    findOne(id: string): Promise<import("./schemas/user.schema").UserDocument | null>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<{
        user: {
            id: import("mongoose").Types.ObjectId | undefined;
            username: string;
            email: string;
            color: string;
        };
    }>;
}
