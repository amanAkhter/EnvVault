// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Notification Bell
// In-app notification center: unread badge, list, mark-read, mark-all-read.
// Polls the notification repository via React Query.
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { notificationRepository } from '../../services/firestore';
import { useAuthStore } from '../../features/auth/store/authStore';
import { cn } from '../../lib/utils';
import type { Notification } from '../../types';

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const NotificationBell = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.uid;

  const { data: notifications } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => notificationRepository.getByUser(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationRepository.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationRepository.markAllRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
  });

  const onClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.actionUrl) navigate(n.actionUrl);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors outline-none">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Inbox size={22} />
              <span className="text-xs">You're all caught up</span>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => onClick(n)}
                className={cn(
                  'flex w-full items-start gap-3 px-3 py-2.5 text-left border-b border-border/50 transition-colors hover:bg-accent/50',
                  !n.isRead && 'bg-emerald-500/5',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    n.isRead ? 'bg-transparent' : 'bg-emerald-500',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.message}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                {!n.isRead && (
                  <Check
                    size={13}
                    className="mt-1 shrink-0 text-muted-foreground/40"
                  />
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
