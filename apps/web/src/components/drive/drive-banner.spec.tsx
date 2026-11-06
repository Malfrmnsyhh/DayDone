import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultMockUser, TestWrapper } from '../../test/test-utils.js';
import { DriveBanner } from './drive-banner.js';

describe('DriveBanner Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('tidak menampilkan banner bila user.driveStatus === CONNECTED', () => {
    const { container } = render(
      <TestWrapper authValue={{ user: { ...defaultMockUser, driveStatus: 'CONNECTED' } }}>
        <DriveBanner />
      </TestWrapper>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('menampilkan banner peringatan kuning bila status NEEDS_RECONNECT', () => {
    render(
      <TestWrapper
        authValue={{ user: { ...defaultMockUser, driveStatus: 'NEEDS_RECONNECT' } }}
      >
        <DriveBanner />
      </TestWrapper>,
    );

    expect(
      screen.getByText('Akses Google Drive Perlu Dihubungkan Ulang'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hubungkan Ulang Drive/i }),
    ).toBeInTheDocument();
  });

  it('menampilkan banner biru bila status NOT_CONNECTED', () => {
    render(
      <TestWrapper
        authValue={{ user: { ...defaultMockUser, driveStatus: 'NOT_CONNECTED' } }}
      >
        <DriveBanner />
      </TestWrapper>,
    );

    expect(
      screen.getByText('Akses Google Drive Belum Terhubung'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Hubungkan Google Drive/i }),
    ).toBeInTheDocument();
  });

  it('memanggil GIS initCodeClient dengan prompt: "consent" saat tombol diklik', () => {
    const mockRequestCode = vi.fn();
    const mockInitCodeClient = vi.fn().mockReturnValue({ requestCode: mockRequestCode });

    (window as any).google = {
      accounts: {
        oauth2: {
          initCodeClient: mockInitCodeClient,
        },
      },
    };

    render(
      <TestWrapper
        authValue={{ user: { ...defaultMockUser, driveStatus: 'NEEDS_RECONNECT' } }}
      >
        <DriveBanner />
      </TestWrapper>,
    );

    const btn = screen.getByRole('button', { name: /Hubungkan Ulang Drive/i });
    fireEvent.click(btn);

    expect(mockInitCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'consent',
        scope: expect.stringContaining('https://www.googleapis.com/auth/drive.file'),
      }),
    );
    expect(mockRequestCode).toHaveBeenCalled();
  });
});

