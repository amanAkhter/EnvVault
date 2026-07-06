import { Link, useLocation } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center text-sm text-muted-foreground">
        <li>
          <Link
            to="/"
            className="flex items-center hover:text-foreground transition-colors"
          >
            <Home size={14} />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          
          // Format the value (e.g., replace hyphens with spaces, capitalize)
          const formattedValue = value
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());

          // If it's a Firestore ID (usually long and alphanumeric), maybe we truncate or say "Details" 
          // For now, let's just show it, or check if it's longer than 15 chars
          const displayValue = formattedValue.length > 20 ? `${formattedValue.substring(0, 8)}...` : formattedValue;

          return (
            <li key={to} className="flex items-center">
              <ChevronRight size={14} className="mx-2 text-muted-foreground/50" />
              {isLast ? (
                <span className="font-medium text-foreground" aria-current="page">
                  {displayValue}
                </span>
              ) : (
                <Link
                  to={to}
                  className="hover:text-foreground transition-colors"
                >
                  {displayValue}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
