import { SignupDto, LoginDto } from './dto/user-auth.dto';
import { DatabaseService } from '../database/database.service';
export declare class UserAuthController {
    private readonly db;
    constructor(db: DatabaseService);
    signup(dto: SignupDto): Promise<{
        success: boolean;
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: any;
            email: any;
            name: any;
        };
    }>;
}
