import { Button } from '../../../components/ui/button';
import { logout } from '../api/authApi';
import { useNavigate } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully.");
      navigate('/login');
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-2xl bg-destructive/10">
            <ShieldAlert size={56} className="text-destructive" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-foreground">
          Access Denied
        </h2>
        <p className="mt-3 text-muted-foreground mb-8 max-w-sm mx-auto">
          You do not have administrative privileges to access EnvVault. Please contact your administrator.
        </p>
        <Button variant="destructive" size="lg" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};
