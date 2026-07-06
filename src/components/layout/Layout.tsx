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
import { Button } from '../ui/button';

export const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        </div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
    </div>
  );
};
