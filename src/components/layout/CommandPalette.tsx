// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Command Palette (CMD+K)
// Global search and navigation powered by keyboard shortcuts.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
  ScrollText,
  Plus,
  ArrowRight,
  Command,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
  section: string;
}

export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'View overview and analytics',
      icon: <LayoutDashboard size={16} />,
      action: () => navigate('/'),
      keywords: ['home', 'overview', 'analytics'],
      section: 'Navigation',
    },
    {
      id: 'nav-projects',
      label: 'Go to Projects',
      description: 'Browse all projects',
      icon: <FolderKanban size={16} />,
      action: () => navigate('/projects'),
      keywords: ['list', 'browse'],
      section: 'Navigation',
    },
    {
      id: 'nav-members',
      label: 'Go to Members',
      description: 'Manage team members',
      icon: <Users size={16} />,
      action: () => navigate('/members'),
      keywords: ['team', 'invite', 'people'],
      section: 'Navigation',
    },
    {
      id: 'nav-audit',
      label: 'Go to Audit Logs',
      description: 'View activity history',
      icon: <ScrollText size={16} />,
      action: () => navigate('/audit'),
      keywords: ['history', 'activity', 'log'],
      section: 'Navigation',
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      description: 'Configure workspace',
      icon: <Settings size={16} />,
      action: () => navigate('/settings'),
      keywords: ['config', 'preferences'],
      section: 'Navigation',
    },
    // Actions
    {
      id: 'action-new-project',
      label: 'Create New Project',
      description: 'Add a new project to your workspace',
      icon: <Plus size={16} />,
      action: () => navigate('/projects/new'),
      keywords: ['add', 'create'],
      section: 'Actions',
    },
  ];

  const filteredCommands = query
    ? commands.filter((cmd) => {
        const search = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(search) ||
          cmd.description?.toLowerCase().includes(search) ||
          cmd.keywords?.some((k) => k.includes(search))
        );
      })
    : commands;

  // Group by section
  const sections = filteredCommands.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {});

  const flatItems = filteredCommands;

  // ── Keyboard Shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('envvault:open-command-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('envvault:open-command-palette', handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      item.action();
      setIsOpen(false);
    },
    [],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2">
              {Object.keys(sections).length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found.
                </div>
              ) : (
                Object.entries(sections).map(([section, items]) => (
                  <div key={section}>
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {section}
                    </p>
                    {items.map((item) => {
                      const globalIndex = flatItems.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-accent text-accent-foreground'
                              : 'text-foreground hover:bg-accent/50',
                          )}
                        >
                          <span className="shrink-0 text-muted-foreground">{item.icon}</span>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          {globalIndex === selectedIndex && (
                            <ArrowRight size={14} className="shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border px-1 py-0.5">↵</kbd> Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border px-1 py-0.5">Esc</kbd> Close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
