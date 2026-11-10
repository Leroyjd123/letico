/** Request DTOs for the auth module — validated by the global ValidationPipe. */
import { IsEmail, IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Supabase email OTPs are 6 digits by default (configurable up to 10). */
  @Matches(/^\d{6,10}$/, { message: 'token must be a 6–10 digit code' })
  token!: string;
}

export class MigrateGuestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  guestToken!: string;
}
