// ─────────────────────────────────────────────────────────────
// LoginPage – Garage Auto Supplies CRM
// ─────────────────────────────────────────────────────────────
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await handleLoginAttempt(email, password);
  };

  const handleLoginAttempt = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setLoading(true);

    try {
      let loginId = loginEmail.trim().toLowerCase();
      if (!loginId.includes('@')) {
        loginId = `${loginId}@garageautosupplies.com`;
      }
      await login(loginId, loginPass);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      if (message.includes('auth/invalid-credential')) {
        setError('Invalid email or password.');
      } else if (message.includes('auth/user-not-found')) {
        setError('No account found with this email.');
      } else if (message.includes('auth/wrong-password')) {
        setError('Incorrect password.');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-brand-600/15 rounded-full blur-[140px] animate-pulse-slow" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        {/* Gradient border effect */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-brand-500/40 via-brand-600/10 to-surface-700/40 shadow-2xl" />

        <div className="relative bg-surface-900/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/25 border border-brand-400/30">
              <Wrench className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              GAS <span className="text-brand-400">CRM</span>
            </h1>
            <p className="text-surface-400 text-xs font-bold uppercase tracking-widest mt-1">
              Hot Lead War Room
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 mb-6 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold animate-fade-in shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5"
              >
                Username or Email
              </label>
              <input
                id="login-email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@garageautosupplies.com"
                className="input-field"
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-surface-300 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2 shadow-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entering War Room…</span>
                </>
              ) : (
                <>
                  <span className="font-bold">Enter War Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-[11px] text-surface-500 mt-6 font-medium">
            Protected by Garage Auto Supplies High-Ticket Auth Shield.
          </p>
        </div>
      </div>
    </div>
  );
}
