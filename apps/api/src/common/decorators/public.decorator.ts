import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Menandai endpoint sebagai rute publik yang tidak memerlukan autentikasi
 * (seperti /health).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

