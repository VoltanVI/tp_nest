import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        user: {
            id: import("mongoose").Types.ObjectId | undefined;
            username: string;
            email: string;
            color: string;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        user: {
            id: import("mongoose").Types.ObjectId;
            username: string;
            email: string;
            color: string;
        };
    }>;
}
