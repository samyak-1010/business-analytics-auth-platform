import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { SignupDto, LoginDto } from './dto/user-auth.dto';
import { DatabaseService } from '../database/database.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Authentication Controller
 *
 * Design decisions:
 * - bcryptjs (10 salt rounds) for password hashing — good balance of security vs. latency
 * - Returns same "Invalid credentials" message for both wrong email and wrong password
 *   to prevent user enumeration attacks
 * - Demo token (not JWT) — upgrading to real JWTs is a drop-in change in the login method
 * - Email uniqueness enforced at both application level (check before insert) and DB level (UNIQUE constraint)
 */
@Controller('user-auth')
export class UserAuthController {
  constructor(private readonly db: DatabaseService) {}

  /** Register a new user with hashed password and UUID primary key */
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    // Application-level duplicate check — provides a user-friendly error message
    // (the DB UNIQUE constraint is our safety net if a race condition occurs)
    const existing = await this.db.query('SELECT * FROM users WHERE email = $1', [dto.email]);
    if (existing.rows.length > 0) {
      throw new BadRequestException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const id = uuidv4();
    await this.db.query(
      'INSERT INTO users (id, email, "passwordHash", name, "createdAt") VALUES ($1, $2, $3, $4, NOW())',
      [id, dto.email, passwordHash, dto.name]
    );
    return { success: true };
  }

  /**
   * Authenticate user by email + password and return a session token.
   * Security: same error message for "no user" and "wrong password" to prevent enumeration.
   */
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const userRes = await this.db.query('SELECT * FROM users WHERE email = $1', [dto.email]);
    if (userRes.rows.length === 0) {
      throw new BadRequestException('Invalid credentials');
    }
    const user = userRes.rows[0];
    // Handle both quoted ("passwordHash") and unquoted (passwordhash) PG column casing
    const valid = await bcrypt.compare(dto.password, user.passwordhash || user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Invalid credentials');
    }
    // For demo: return a fake JWT (in real app, sign a JWT)
    return { token: `demo-token-${user.id}`, user: { id: user.id, email: user.email, name: user.name } };
  }
}
