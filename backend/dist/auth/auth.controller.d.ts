import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    login(body: LoginDto): {
        accessToken: string;
        storeId: string;
        tokenType: string;
        expiresIn: number;
    };
}
