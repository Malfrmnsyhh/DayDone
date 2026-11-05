import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

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

interface TestWrapperProps {
  children: ReactNode;
  initialEntries?: string[];
  routePath?: string;
}

export function TestWrapper({
  children,
  initialEntries = ['/'],
  routePath = '/',
}: TestWrapperProps) {
  const queryClient = createTestQueryClient();

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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
