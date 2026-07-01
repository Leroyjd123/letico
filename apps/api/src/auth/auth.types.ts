/**
 * auth.types.ts — DTOs for the auth module.
 *
 * Using class-validator decorated classes (rather than plain interfaces)
 * so the global ValidationPipe's whitelist/forbidNonWhitelisted actually
 * validates and strips these request bodies.
 */
import { IsEmail, IsString, Length } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  token!: string;
}

export class MigrateGuestDto {
  @IsString()
  @Length(1, 200)
  guestToken!: string;
}

export class DemoLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 100)
  password!: string;
}
