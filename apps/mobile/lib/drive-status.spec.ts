import { describe, expect, it, vi } from 'vitest';
import type { AuthResponse, User } from '@daydone/shared';
import {
  getDriveStatusInfo,
  runDriveReconnectFlow,
  shouldShowDriveBanner,
} from './drive-status';

describe('drive-status helpers (mobile)', () => {
  describe('shouldShowDriveBanner', () => {
    it('mengembalikan false saat CONNECTED atau undefined, dan true saat NOT_CONNECTED / NEEDS_RECONNECT', () => {
      expect(shouldShowDriveBanner('CONNECTED')).toBe(false);
      expect(shouldShowDriveBanner(undefined)).toBe(false);
      expect(shouldShowDriveBanner('NOT_CONNECTED')).toBe(true);
      expect(shouldShowDriveBanner('NEEDS_RECONNECT')).toBe(true);
    });
  });

  describe('getDriveStatusInfo', () => {
    it('mengembalikan tone connected saat status CONNECTED', () => {
      const info = getDriveStatusInfo('CONNECTED');

      expect(info.tone).toBe('connected');
      expect(info.badgeLabel).toBe('Terhubung');
      expect(info.title).toContain('Terhubung');
      expect(info.description).toContain('DayDone');
    });

    it('mengembalikan tone warning saat status NEEDS_RECONNECT', () => {
      const info = getDriveStatusInfo('NEEDS_RECONNECT');

      expect(info.tone).toBe('warning');
      expect(info.badgeLabel).toBe('Perlu Hubungkan Ulang');
      expect(info.title).toContain('Hubungkan Ulang');
      expect(info.description).toContain('kedaluwarsa');
      expect(info.actionLabel).toBe('Hubungkan Ulang Google Drive');
    });

    it('mengembalikan tone neutral saat status NOT_CONNECTED atau undefined', () => {
      const notConnected = getDriveStatusInfo('NOT_CONNECTED');
      const fallback = getDriveStatusInfo(undefined);

      expect(notConnected.tone).toBe('neutral');
      expect(notConnected.badgeLabel).toBe('Belum Terhubung');
      expect(notConnected.title).toContain('Belum Terhubung');
      expect(notConnected.actionLabel).toBe('Hubungkan Google Drive');
      expect(fallback).toEqual(notConnected);
    });
  });

  describe('runDriveReconnectFlow', () => {
    const connectedUser: User = {
      id: 'u-1',
      email: 'mahasiswa@daydone.app',
      name: 'Mahasiswa',
      avatarUrl: null,
      driveStatus: 'CONNECTED',
    };

    const connectedResponse: AuthResponse = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: '2026-11-28T17:00:00.000Z',
      refreshToken: 'new-refresh-token',
      user: connectedUser,
    };

    it('mengembalikan cancelled tanpa memanggil exchangeCode atau mengubah sesi saat popup dibatalkan', async () => {
      const exchangeCode = vi.fn();
      const onConnected = vi.fn();

      const outcome = await runDriveReconnectFlow({
        requestAuthCode: async () => null,
        exchangeCode,
        onConnected,
      });

      expect(outcome).toBe('cancelled');
      expect(exchangeCode).not.toHaveBeenCalled();
      expect(onConnected).not.toHaveBeenCalled();
    });

    it('melempar error jaringan tanpa memanggil onConnected sehingga sesi aktif tetap aman', async () => {
      const onConnected = vi.fn();

      await expect(
        runDriveReconnectFlow({
          requestAuthCode: async () => 'auth-code-123',
          exchangeCode: async () => {
            throw new Error('Gagal terhubung ke server');
          },
          onConnected,
        }),
      ).rejects.toThrow('Gagal terhubung ke server');

      expect(onConnected).not.toHaveBeenCalled();
    });

    it('memperbarui sesi dan mengembalikan connected saat driveStatus menjadi CONNECTED', async () => {
      const onConnected = vi.fn();

      const outcome = await runDriveReconnectFlow({
        requestAuthCode: async () => 'auth-code-ok',
        exchangeCode: async () => connectedResponse,
        onConnected,
      });

      expect(outcome).toBe('connected');
      expect(onConnected).toHaveBeenCalledWith(connectedResponse);
    });

    it('memberi pesan jelas bila user tidak mencentang izin Drive saat login ulang', async () => {
      const onConnected = vi.fn();
      const notConnectedResp: AuthResponse = {
        ...connectedResponse,
        user: { ...connectedUser, driveStatus: 'NOT_CONNECTED' },
      };

      await expect(
        runDriveReconnectFlow({
          requestAuthCode: async () => 'auth-code-no-drive',
          exchangeCode: async () => notConnectedResp,
          onConnected,
        }),
      ).rejects.toThrow('Izin Google Drive belum dicentang');

      expect(onConnected).toHaveBeenCalledWith(notConnectedResp);
    });
  });
});
