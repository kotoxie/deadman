import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authSetup } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter.jsx';

export default function SetupPage() {
  const { completeSetup } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = set password, 2 = save reminder
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isWeakScore = () => {
    const checks = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];
    return checks.filter(Boolean).length < 3;
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (isWeakScore()) {
      setError('Password is too weak. Add uppercase letters, numbers, and symbols.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await authSetup(password, confirm);
      completeSetup(data.csrfToken);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      {step === 1 ? (
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 mb-4">
              <span className="text-3xl">💀</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome to Dead Man's Switch</h1>
            <p className="text-gray-400 mt-2 text-sm">
              No password has been set yet. Create one now to protect your vault.
            </p>
          </div>

          {/* Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-5">
              <ShieldAlert className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-300">
                This password <strong>cannot be recovered</strong>. If you lose it, your encrypted vault data is permanently inaccessible.
              </p>
            </div>

            <form onSubmit={handleSetup} className="space-y-4">
              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Master Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Create a strong password"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-600"
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && <div className="mt-2"><PasswordStrengthMeter password={password} /></div>}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Repeat your password"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-600"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
                {confirm && password === confirm && confirm.length > 0 && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passwords match</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm || password !== confirm}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                {loading ? 'Setting up…' : 'Create Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Step 2 — Save reminder */
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-900/40 border border-green-700 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Password Set Successfully</h1>
            <p className="text-gray-400 mt-2 text-sm">One important step before you continue.</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0" />
                <span className="text-yellow-300 font-semibold text-sm">Save Your Password Now</span>
              </div>
              <p className="text-yellow-200/80 text-xs leading-relaxed">
                Your password <strong>cannot be reset or recovered</strong> by any means. If you forget it:
              </p>
              <ul className="text-yellow-200/70 text-xs space-y-1 list-none pl-1">
                <li>• Your entire encrypted vault becomes inaccessible</li>
                <li>• You will need to delete the database and start fresh</li>
                <li>• There is no backdoor, no recovery email, no support option</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-300 font-medium">Store it in one of these secure places:</p>
              <ul className="text-xs text-gray-400 space-y-1 pl-1">
                <li>✓ A password manager (Bitwarden, 1Password, etc.)</li>
                <li>✓ An encrypted notes app</li>
                <li>✓ A physical safe</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saved}
                onChange={e => setSaved(e.target.checked)}
                className="mt-0.5 accent-indigo-500 w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">
                I have saved my password in a secure location and understand it cannot be recovered.
              </span>
            </label>

            <button
              onClick={handleContinue}
              disabled={!saved}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              Continue to Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
