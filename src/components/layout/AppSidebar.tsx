// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – App Sidebar
// Premium sidebar navigation inspired by Linear / Vercel / Supabase.
// Features: Organization switcher, project navigation, global search trigger.
// ─────────────────────────────────────────────────────────────────────────────

import { Link, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  Shield,
  Settings,
  Search,
  Plus,
  ChevronDown,
  LockKeyhole,
  LogOut,
  Users,
  ScrollText,
  Activity,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuthStore } from '../../features/auth/store/authStore';
import { logout } from '../../features/auth/api/authApi';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/' },
  { label: 'Projects',  icon: <FolderKanban size={18} />,   path: '/projects' },
  { label: 'Members',   icon: <Users size={18} />,           path: '/members' },
];

const BOTTOM_NAV: NavItem[] = [
  { label: 'Audit Logs', icon: <ScrollText size={18} />,  path: '/audit' },
  { label: 'Settings',   icon: <Settings size={18} />,    path: '/settings' },
];

interface AppSidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const AppSidebar = ({ mobileMenuOpen, setMobileMenuOpen }: AppSidebarProps) => {
  const { user, activeOrganization, can } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, setMobileMenuOpen]);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [isDark]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully.');
      navigate('/login');
    } catch {
      toast.error('Failed to sign out.');
    }
  };

  const handleSearchOpen = () => {
    // Dispatch a custom event that the CommandPalette listens to
    window.dispatchEvent(new CustomEvent('envvault:open-command-palette'));
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? 64 : 260,
          x: 0 // handled by css classes for mobile
        }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* ── Logo & Org Switcher ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-sidebar-border">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
              <LockKeyhole size={16} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight">EnvVault</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">
                {activeOrganization?.name || 'Workspace'}
              </p>
            </div>
          </Link>
        )}
        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
              <LockKeyhole size={16} className="text-emerald-500" />
            </div>
          </div>
        )}
      </div>

      {/* ── Search Trigger ──────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleSearchOpen}
          className={cn(
            'flex items-center gap-2 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors',
            isCollapsed && 'justify-center px-0',
          )}
        >
          <Search size={14} />
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-mono text-sidebar-foreground/40">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Main Navigation ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <p className={cn(
          'text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 px-2 pt-2 pb-1',
          isCollapsed && 'hidden',
        )}>
          Menu
        </p>
        {MAIN_NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              isCollapsed && 'justify-center px-0',
            )}
          >
            <span className={cn(
              'shrink-0',
              isActive(item.path) && 'text-emerald-500',
            )}>
              {item.icon}
            </span>
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* ── Quick Create ─────────────────────────────────────────────── */}
        {can('projects.create') && !isCollapsed && (
          <Link
            to="/projects/new"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all border border-dashed border-sidebar-border mt-2"
          >
            <Plus size={18} />
            <span>New Project</span>
          </Link>
        )}
      </nav>

      {/* ── Bottom Navigation ───────────────────────────────────────────── */}
      <div className="px-3 py-2 space-y-1 border-t border-sidebar-border">
        {BOTTOM_NAV.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isActive(item.path)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              isCollapsed && 'justify-center px-0',
            )}
          >
            <span className={cn(
              'shrink-0',
              isActive(item.path) && 'text-emerald-500',
            )}>
              {item.icon}
            </span>
            {!isCollapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {/* ── Theme Toggle ──────────────────────────────────────────────── */}
        <button
          onClick={() => setIsDark(!isDark)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all w-full',
            isCollapsed && 'justify-center px-0',
          )}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* ── Collapse Toggle ───────────────────────────────────────────── */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all w-full',
            isCollapsed && 'justify-center px-0',
          )}
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* ── User Footer ─────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className={cn(
          'flex items-center gap-3',
          isCollapsed && 'justify-center',
        )}>
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-sidebar-border">
            <AvatarImage src={user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'U'}`} />
            <AvatarFallback className="text-xs">{user?.name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="shrink-0 p-1.5 rounded-md text-sidebar-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.aside>
    </>
  );
};
