import { useState } from 'react';
import { AlertTriangle, X, BellOff, Clock } from 'lucide-react';

const STORAGE_KEY = 'enc_key_warn_dismissed';

export default function EncryptionKeyWarningBanner() {
  // "Never show again" persists across sessions via localStorage
  const [neverShow] = useState(() => localStorage.getItem(STORAGE_KEY) === 'forever');
  // "Remind me later" dismisses for this AppLayout mount only (resets on logout)
  const [laterDismissed, setLaterDismissed] = useState(false);

  if (neverShow || laterDismissed) return null;

  const handleNever = () => {
    localStorage.setItem(STORAGE_KEY, 'forever');
    // Force re-render by triggering a state change
    setLaterDismissed(true);
  };

  const handleLater = () => {
    setLaterDismissed(true);
  };

  return (
    <div className="mx-6 mt-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 flex items-start gap-3 shadow-lg shadow-red-900/20">
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-300">
          ⚠ No <code className="font-mono text-xs bg-red-900/40 px-1 py-0.5 rounded">DB_ENCRYPTION_KEY</code> set — using auto-generated key
        </p>
        <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
          Your vault encryption key was auto-generated and stored at{' '}
          <code className="font-mono text-xs bg-red-900/40 px-1 rounded">/app/data/encryption.key</code>.{' '}
          <strong className="text-red-300">Back it up immediately.</strong>{' '}
          If the file is lost, your encrypted vault cannot be recovered. Set{' '}
          <code className="font-mono text-xs bg-red-900/40 px-1 rounded">DB_ENCRYPTION_KEY</code> in your environment to silence this warning permanently.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button
          onClick={handleLater}
          title="Remind me later (shows again on next login)"
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-200 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <Clock className="w-3.5 h-3.5" />
          Later
        </button>
        <button
          onClick={handleNever}
          title="Never show this warning again"
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-200 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          <BellOff className="w-3.5 h-3.5" />
          Never show
        </button>
        <button
          onClick={handleLater}
          title="Dismiss"
          className="text-red-500 hover:text-red-300 transition-colors p-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
