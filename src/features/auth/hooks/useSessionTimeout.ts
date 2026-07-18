// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Session Timeout Hook
// Auto-logs the user out after a period of inactivity. The window is driven by
// the active organization's security policy (sessionTimeoutMinutes). Activity
// on any of the tracked DOM events resets the idle timer.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { logout } from '../api/authApi';
import { clearReauth } from '../../../services/auth/reauth-service';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'visibilitychange'];

/** Warn the user this many ms before the session actually expires. */
const WARNING_LEAD_MS = 60_000;

export const useSessionTimeout = () => {
  const { user, activeOrganization } = useAuthStore();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeoutMinutes = activeOrganization?.security?.sessionTimeoutMinutes ?? 60;

  useEffect(() => {
    // Only enforce while authenticated with a positive timeout.
    if (!user || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60_000;

    const expire = async () => {
      try {
        await logout();
      } finally {
        clearReauth();
        toast.error('Session expired due to inactivity. Please sign in again.');
        navigate('/login');
      }
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);

      if (timeoutMs > WARNING_LEAD_MS) {
        warnRef.current = setTimeout(() => {
          toast('You will be signed out soon due to inactivity.', { icon: '⏳' });
        }, timeoutMs - WARNING_LEAD_MS);
      }
      timerRef.current = setTimeout(expire, timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [user, timeoutMinutes, navigate]);
};
