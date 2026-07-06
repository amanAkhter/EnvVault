import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-9xl font-extrabold text-muted">
          404
        </h2>
        <h3 className="mt-4 text-2xl font-bold text-foreground">
          Page Not Found
        </h3>
        <p className="mt-2 text-muted-foreground mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Button size="lg" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    </div>
  );
};
