import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';
import { AuthProvider } from './auth/auth-context.js';
import { AppLayout } from './components/layout/app-layout.js';
import { ProtectedRoute } from './components/protected-route.js';
import { PublicRoute } from './components/public-route.js';
import { DashboardPage } from './pages/dashboard-page.js';
import { LogDetailPage } from './pages/log-detail-page.js';
import { LogFormPage } from './pages/log-form-page.js';
import { LoginPage } from './pages/login-page.js';
import { SettingsPage } from './pages/settings-page.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const router = createBrowserRouter([
  // Rute Publik (hanya untuk pengunjung yang belum login)
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  // Rute Terlindungi (wajib login)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/logs/new', element: <LogFormPage /> },
          { path: '/logs/:id', element: <LogDetailPage /> },
          { path: '/logs/:id/edit', element: <LogFormPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  // Fallback rute tak dikenal
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
