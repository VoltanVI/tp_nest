import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
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
