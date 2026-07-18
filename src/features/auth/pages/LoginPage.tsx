// ─────────────────────────────────────────────────────────────────────────────
// EnvVault – Login Page (Redesigned)
// Google, email/password, and phone (SMS OTP) authentication.
// ─────────────────────────────────────────────────────────────────────────────

import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  loginWithGoogle,
  signUpWithEmail,
  loginWithEmail,
  resetPassword,
  createRecaptcha,
  startPhoneSignIn,
  confirmPhoneCode,
} from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { Navigate } from 'react-router';
import {
  LockKeyhole,
  ShieldCheck,
  Loader2,
  Lock,
  Key,
  Globe,
  Mail,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';

type Method = 'google' | 'email' | 'phone';

export const LoginPage = () => {
  const { user, isLoading, error, setError } = useAuthStore();
  const [method, setMethod] = useState<Method>('google');
  const [busy, setBusy] = useState(false);

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

  if (user) return <Navigate to="/" replace />;

  const handleGoogle = async () => {
    try {
      setBusy(true);
      await loginWithGoogle();
    } catch (err: any) {
      toast.error(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-background" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
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
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">{icon}</div>
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

      {/* Right: Auth */}
      <div className="flex-1 flex flex-col justify-center py-12 px-8 sm:px-16 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="flex justify-center lg:hidden mb-8">
            <div className="p-4 rounded-2xl bg-emerald-500/10">
              <LockKeyhole size={40} className="text-emerald-500" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center lg:text-left">Sign in to EnvVault</h2>
          <p className="mt-2 text-sm text-muted-foreground text-center lg:text-left">
            Secure environment variable management for your team
          </p>

          {/* Method switcher */}
          <div className="mt-6 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                { id: 'google', label: 'Google', icon: <Globe size={14} /> },
                { id: 'email', label: 'Email', icon: <Mail size={14} /> },
                { id: 'phone', label: 'Phone', icon: <Smartphone size={14} /> },
              ] as { id: Method; label: string; icon: React.ReactNode }[]
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-colors',
                  method === m.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {method === 'google' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-xl px-4 py-3">
                  <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                  <span>Access is restricted to authorized team members only.</span>
                </div>
                <Button className="w-full font-semibold h-12 text-base" onClick={handleGoogle} disabled={busy} size="lg">
                  {busy ? (
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
              </div>
            )}

            {method === 'email' && <EmailAuth busy={busy} setBusy={setBusy} />}
            {method === 'phone' && <PhoneAuth busy={busy} setBusy={setBusy} />}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

// ── Email / Password ──────────────────────────────────────────────────────────

const EmailAuth = ({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      toast.error('Email and password are required.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    try {
      setBusy(true);
      if (mode === 'signup') await signUpWithEmail(name, email, password);
      else await loginWithEmail(email, password);
      // Auth listener drives the redirect.
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first.');
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Password reset email sent.');
    } catch (err: any) {
      toast.error(err.message || 'Could not send reset email.');
    }
  };

  return (
    <div className="space-y-4">
      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === 'login' && (
            <button type="button" onClick={forgot} className="text-xs text-emerald-500 hover:text-emerald-400">
              Forgot?
            </button>
          )}
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <Button className="w-full h-11 font-semibold" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          className="text-emerald-500 hover:text-emerald-400 font-medium"
        >
          {mode === 'signup' ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </div>
  );
};

// ── Phone (SMS OTP) ────────────────────────────────────────────────────────────

const PhoneAuth = ({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  // Clean up the reCAPTCHA widget on unmount.
  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  const sendCode = async () => {
    const e164 = phone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
      toast.error('Enter a phone number in international format, e.g. +14155552671.');
      return;
    }
    try {
      setBusy(true);
      if (!verifierRef.current) {
        verifierRef.current = createRecaptcha('recaptcha-container');
      }
      confirmationRef.current = await startPhoneSignIn(e164, verifierRef.current);
      setStep('code');
      toast.success('Verification code sent.');
    } catch (err: any) {
      toast.error(err.message || 'Could not send code.');
      // Reset the widget so a retry gets a fresh challenge.
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!confirmationRef.current) return;
    if (code.trim().length < 6) {
      toast.error('Enter the 6-digit code.');
      return;
    }
    try {
      setBusy(true);
      await confirmPhoneCode(confirmationRef.current, code.trim());
      // Auth listener drives the redirect.
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 415 555 2671"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            <p className="text-xs text-muted-foreground">Use international format with country code.</p>
          </div>
          <Button className="w-full h-11 font-semibold" onClick={sendCode} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send code
          </Button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setStep('phone')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={13} /> Change number
          </button>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              className="tracking-[0.5em] text-center font-mono"
            />
            <p className="text-xs text-muted-foreground">Sent to {phone}</p>
          </div>
          <Button className="w-full h-11 font-semibold" onClick={verify} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify & sign in
          </Button>
        </>
      )}

      {/* Invisible reCAPTCHA mount point (required by Firebase phone auth). */}
      <div id="recaptcha-container" />
    </div>
  );
};
