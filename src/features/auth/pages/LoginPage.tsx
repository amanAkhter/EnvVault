// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Login Page (Redesigned)
// Premium login screen with gradient background and branded feel.
// ─────────────────────────────────────────────────────────────────────────────

import { Button } from '../../../components/ui/button';
import { loginWithGoogle } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { Navigate } from 'react-router';
import { LockKeyhole, ShieldCheck, Loader2, Lock, Key, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

export const LoginPage = () => {
  const { user, isLoading, error, setError } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (error) {
      toast.error(error, { id: 'auth-error' });
      setError(null);
    }
  }, [error, setError]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await loginWithGoogle();
    } catch (err: any) {
      toast.error(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-background" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <LockKeyhole size={28} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">EnvVault</h1>
                <p className="text-emerald-300/80 text-sm">The Modern Configuration Platform</p>
              </div>
            </div>

            <div className="space-y-6 max-w-md">
              {[
                { icon: <Lock size={18} />, title: 'Zero-Knowledge Encryption', desc: 'AES-256-GCM encryption in your browser. Firestore never sees plaintext.' },
                { icon: <Key size={18} />, title: 'Envelope Encryption', desc: 'Per-project encryption keys wrapped with a master key.' },
                { icon: <Globe size={18} />, title: 'Multi-Environment', desc: 'Dev, Staging, Production — each with its own encrypted variables.' },
              ].map(({ icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="flex items-start gap-4"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-emerald-200/60 mt-0.5">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-8 sm:px-16 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md mx-auto"
        >
          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden mb-8">
            <div className="p-4 rounded-2xl bg-emerald-500/10">
              <LockKeyhole size={40} className="text-emerald-500" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center lg:text-left">
            Sign in to EnvVault
          </h2>
          <p className="mt-2 text-sm text-muted-foreground text-center lg:text-left">
            Secure environment variable management for your team
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-xl px-4 py-3">
              <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
              <span>Access is restricted to authorized team members only.</span>
            </div>

            <Button
              className="w-full font-semibold h-12 text-base"
              onClick={handleLogin}
              disabled={isLoggingIn}
              size="lg"
            >
              {isLoggingIn ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Sign in with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-6">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
