// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Main Layout
// Sidebar + Content area + Command Palette.
// ─────────────────────────────────────────────────────────────────────────────

import { Outlet } from 'react-router';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { CommandPalette } from './CommandPalette';
import { Breadcrumbs } from './Breadcrumbs';
import { NotificationBell } from './NotificationBell';
import { Button } from '../ui/button';
import { useSessionTimeout } from '../../features/auth/hooks/useSessionTimeout';

export const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useSessionTimeout();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppSidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <CommandPalette />

      {/* Content area offset by sidebar width on desktop */}
      <main className="flex-1 min-h-screen transition-all duration-200 lg:ml-[260px] w-full">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={20} />
          </Button>
          <span className="ml-3 font-semibold">EnvVault</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-4">
            <Breadcrumbs />
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
