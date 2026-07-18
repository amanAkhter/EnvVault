// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Route Definitions
// Feature-based routing with lazy loading for code splitting.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserRouter, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import { AuthGuard } from '../features/auth/components/AuthGuard';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { UnauthorizedPage } from '../features/auth/pages/UnauthorizedPage';
import { AcceptInvitePage } from '../features/auth/pages/AcceptInvitePage';
import { Layout } from '../components/layout/Layout';
import { NotFoundPage } from '../app/NotFoundPage';
import { Loader2 } from 'lucide-react';

// ── Lazy-loaded page components for code splitting ─────────────────────────

const DashboardPage = lazy(() =>
  import('../features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const ProjectsPage = lazy(() =>
  import('../features/projects/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const CreateProjectPage = lazy(() =>
  import('../features/projects/pages/CreateProjectPage').then((m) => ({ default: m.CreateProjectPage })),
);
const ProjectDetailsPage = lazy(() =>
  import('../features/projects/pages/ProjectDetailsPage').then((m) => ({ default: m.ProjectDetailsPage })),
);
const AuditPage = lazy(() =>
  import('../features/audit/pages/AuditPage').then((m) => ({ default: m.AuditPage })),
);
const MembersPage = lazy(() =>
  import('../features/members/pages/MembersPage').then((m) => ({ default: m.MembersPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

// ── Suspense wrapper with loading indicator ────────────────────────────────

const SuspenseLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }
  >
    {children}
  </Suspense>
);

// ── Router Definition ──────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/accept-invite',
    element: <AcceptInvitePage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <Layout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <SuspenseLoader><DashboardPage /></SuspenseLoader>,
      },
      {
        path: 'projects',
        element: <SuspenseLoader><ProjectsPage /></SuspenseLoader>,
      },
      {
        path: 'projects/new',
        element: <SuspenseLoader><CreateProjectPage /></SuspenseLoader>,
      },
      {
        path: 'projects/:projectId',
        element: <SuspenseLoader><ProjectDetailsPage /></SuspenseLoader>,
      },
      {
        path: 'members',
        element: <SuspenseLoader><MembersPage /></SuspenseLoader>,
      },
      {
        path: 'audit',
        element: <SuspenseLoader><AuditPage /></SuspenseLoader>,
      },
      {
        path: 'settings',
        element: <SuspenseLoader><SettingsPage /></SuspenseLoader>,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
