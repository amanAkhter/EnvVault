import { Navigate } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { Loader2 } from 'lucide-react';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, activeOrganization, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!activeOrganization) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
