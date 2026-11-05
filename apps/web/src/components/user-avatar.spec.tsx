import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatar, getInitials } from './user-avatar.js';

describe('UserAvatar Component', () => {
  it('menghitung inisial dengan benar untuk berbagai format nama', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Budi')).toBe('B');
    expect(getInitials('Muhammad Alif Firmansyah')).toBe('MF');
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
  });

  it('menampilkan elemen img dengan referrerPolicy="no-referrer" bila avatarUrl tersedia', () => {
    render(
      <UserAvatar
        name="John Doe"
        avatarUrl="https://lh3.googleusercontent.com/photo.jpg"
      />,
    );

    const img = screen.getByRole('img', { name: /John Doe/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      'src',
      'https://lh3.googleusercontent.com/photo.jpg',
    );
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('fallback ke inisial nama saat onError dipicu pada gambar', () => {
    render(
      <UserAvatar
        name="John Doe"
        avatarUrl="https://broken-image-link.com/404.jpg"
      />,
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    // Gambar digantikan oleh avatar fallback inisial
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('menampilkan inisial langsung bila avatarUrl null atau kosong', () => {
    render(<UserAvatar name="Ahmad Dahlan" avatarUrl={null} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });
});

