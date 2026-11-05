import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

describe('App Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan loading screen saat memeriksa sesi awal', () => {
    // Mock fetch pending agar tetap di state loading
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    render(<App />);
    expect(
      screen.getByText(/Memverifikasi izin akses|Memeriksa sesi|Memuat sesi/i),
    ).toBeInTheDocument();
  });
});
