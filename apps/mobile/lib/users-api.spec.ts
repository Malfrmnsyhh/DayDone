import { describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@daydone/shared';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  isErrorWithCode: vi.fn(() => false),
  isSuccessResponse: vi.fn(() => false),
  statusCodes: {},
}));

import { ApiError } from './api-client';
import {
  getDeleteAccountErrorMessage,
  getUserInitials,
  isDeleteConfirmationValid,
  validateDeleteAccountConfirmation,
} from './users-api';

describe('users-api helpers (mobile)', () => {
  describe('validateDeleteAccountConfirmation & isDeleteConfirmationValid', () => {
    it('hanya menerima teks persis "HAPUS" huruf kapital sesuai deleteUserSchema', () => {
      expect(isDeleteConfirmationValid('HAPUS')).toBe(true);
      expect(validateDeleteAccountConfirmation('HAPUS')).toEqual({
        valid: true,
        data: { confirm: 'HAPUS' },
      });
    });

    it('menolak variasi huruf kecil, spasi tambahan, atau string kosong', () => {
      const invalidInputs = ['', 'hapus', 'Hapus', 'HAPUS ', ' HAPUS', 'DELETE'];

      for (const input of invalidInputs) {
        expect(isDeleteConfirmationValid(input)).toBe(false);
        const result = validateDeleteAccountConfirmation(input);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain('HAPUS');
        }
      }
    });
  });

  describe('getUserInitials', () => {
    it('membentuk inisial dari nama lengkap, satu kata, email, atau fallback DD', () => {
      expect(getUserInitials('Muhammad Akmal Firmansyah', 'akmal@daydone.app')).toBe('MF');
      expect(getUserInitials('Akmal', 'akmal@daydone.app')).toBe('AK');
      expect(getUserInitials(null, 'mahasiswa@daydone.app')).toBe('MA');
      expect(getUserInitials(null, null)).toBe('DD');
    });
  });

  describe('getDeleteAccountErrorMessage', () => {
    it('memetakan ApiError ke pesan ramah bahasa Indonesia', () => {
      const err = new ApiError({
        statusCode: 401,
        code: ErrorCode.SESSION_EXPIRED,
      });
      expect(getDeleteAccountErrorMessage(err)).toContain('Sesi');
      expect(getDeleteAccountErrorMessage(new Error('Koneksi putus'))).toBe(
        'Koneksi putus',
      );
    });
  });
});
