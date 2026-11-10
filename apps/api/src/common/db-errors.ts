/**
 * db-errors.ts — turn Supabase/PostgREST errors into typed HTTP errors so the
 * client always receives { error: { code, message } } instead of a bare 500.
 */
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

export interface PostgrestLikeError {
  message: string;
  code?: string;
}

/** Postgres foreign_key_violation */
const FK_VIOLATION = '23503';

export function dbError(code: string, error: PostgrestLikeError): never {
  if (error.code === FK_VIOLATION) {
    throw new BadRequestException({
      error: { code: 'INVALID_REFERENCE', message: 'one or more ids do not exist' },
    });
  }
  throw new InternalServerErrorException({ error: { code, message: error.message } });
}
