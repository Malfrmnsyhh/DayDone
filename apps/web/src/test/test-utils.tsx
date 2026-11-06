import type { User } from '@daydone/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/auth-context.js';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const defaultMockUser: User = {
  id: 'user-test-id',
  email: 'test@example.com',
  name: 'Akmal Test',
  avatarUrl: null,
  driveStatus: 'CONNECTED',
};

export const defaultMockAuthValue: AuthContextValue = {
  user: defaultMockUser,
  isAuthenticated: true,
  isLoading: false,
  loginWithCode: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

interface TestWrapperProps {
  children: ReactNode;
  initialEntries?: string[];
  routePath?: string;
  authValue?: Partial<AuthContextValue>;
}

export function TestWrapper({
  children,
  initialEntries = ['/'],
  routePath = '/',
  authValue,
}: TestWrapperProps) {
  const queryClient = createTestQueryClient();

  const mergedAuthValue: AuthContextValue = {
    ...defaultMockAuthValue,
    ...authValue,
  };

  const router = createMemoryRouter(
    [
      {
        path: routePath,
        element: children,
      },
      {
        path: '*',
        element: <div data-testid="fallback-route" />,
      },
    ],
    { initialEntries },
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mergedAuthValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
