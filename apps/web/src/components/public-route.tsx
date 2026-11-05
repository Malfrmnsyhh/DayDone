import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context.js';
import { LoadingScreen } from './loading-screen.js';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Memeriksa sesi..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

