"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAuthController = void 0;
const common_1 = require("@nestjs/common");
const user_auth_dto_1 = require("./dto/user-auth.dto");
const database_service_1 = require("../database/database.service");
const bcrypt = __importStar(require("bcryptjs"));
const uuid_1 = require("uuid");
let UserAuthController = class UserAuthController {
    db;
    constructor(db) {
        this.db = db;
    }
    async signup(dto) {
        const existing = await this.db.query('SELECT * FROM users WHERE email = $1', [dto.email]);
        if (existing.rows.length > 0) {
            throw new common_1.BadRequestException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const id = (0, uuid_1.v4)();
        await this.db.query('INSERT INTO users (id, email, "passwordHash", name, "createdAt") VALUES ($1, $2, $3, $4, NOW())', [id, dto.email, passwordHash, dto.name]);
        return { success: true };
    }
    async login(dto) {
        const userRes = await this.db.query('SELECT * FROM users WHERE email = $1', [dto.email]);
        if (userRes.rows.length === 0) {
            throw new common_1.BadRequestException('Invalid credentials');
        }
        const user = userRes.rows[0];
        const valid = await bcrypt.compare(dto.password, user.passwordhash || user.passwordHash);
        if (!valid) {
            throw new common_1.BadRequestException('Invalid credentials');
        }
        return { token: `demo-token-${user.id}`, user: { id: user.id, email: user.email, name: user.name } };
    }
};
exports.UserAuthController = UserAuthController;
__decorate([
    (0, common_1.Post)('signup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_auth_dto_1.SignupDto]),
    __metadata("design:returntype", Promise)
], UserAuthController.prototype, "signup", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [user_auth_dto_1.LoginDto]),
    __metadata("design:returntype", Promise)
], UserAuthController.prototype, "login", null);
exports.UserAuthController = UserAuthController = __decorate([
    (0, common_1.Controller)('user-auth'),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], UserAuthController);
//# sourceMappingURL=user-auth.controller.js.map