import { useState } from 'react';
import { Save, KeyRound, ShieldCheck, Lock, Network } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import ChangePasswordModal from '../components/features/ChangePasswordModal.jsx';
import { useSettings } from '../hooks/useSettings.js';

export default function SettingsSecurityPage() {
  const { settings, loading, saving, update, save } = useSettings();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  if (loading) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
          <ShieldCheck size={18} className="text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Login &amp; Security</h2>
          <p className="text-xs text-gray-500">Manage your password and login protection rules</p>
        </div>
      </div>

      {/* Password */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Application Password</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-300">Master Password</p>
            <p className="text-xs text-gray-500">Change the password used to log in to this application</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
            <KeyRound size={14} /> Change Password
          </Button>
        </div>
      </Card>

      {/* Login Protection */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Login Protection</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label="Max Failed Attempts"
              type="number"
              min={2}
              max={50}
              value={settings.login_max_attempts || '5'}
              onChange={e => update('login_max_attempts', e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Failed attempts before an IP is blocked</p>
          </div>
          <div>
            <Input
              label="Cooloff Timer (hours)"
              type="number"
              min={0.25}
              step={0.25}
              value={settings.login_cooloff_hours || '4'}
              onChange={e => update('login_cooloff_hours', e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">How long a blocked IP stays banned</p>
          </div>
        </div>

        <hr className="border-border" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Security Notifications</span>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Requires Notification channels to be configured in <span className="text-brand">Notification Settings</span>.
        </p>

        {/* IP Block toggle */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm text-gray-300">Notify on IP Block</p>
            <p className="text-xs text-gray-500">Send alert when an IP is banned for failed logins</p>
          </div>
          <Toggle
            value={settings.notify_ip_block === 'true'}
            onChange={v => update('notify_ip_block', v ? 'true' : 'false')}
          />
        </div>

        {/* Excessive failures toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-gray-300">Notify on Excessive Login Failures</p>
              <p className="text-xs text-gray-500">Alert when many failures occur across IPs (possible brute-force)</p>
            </div>
            <Toggle
              value={settings.notify_excessive_failures === 'true'}
              onChange={v => update('notify_excessive_failures', v ? 'true' : 'false')}
            />
          </div>

          {settings.notify_excessive_failures === 'true' && (
            <div className="pl-4 border-l-2 border-brand/25 ml-1 space-y-1">
              <Input
                label="Failure Threshold (per hour)"
                type="number"
                min={5}
                value={settings.login_excessive_threshold || '20'}
                onChange={e => update('login_excessive_threshold', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Total failed logins across all IPs within 1 hour before a notification is triggered
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Reverse Proxy */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Network size={14} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reverse Proxy</span>
        </div>
        <div>
          <Input
            label="Trusted Proxy"
            placeholder="e.g. uniquelocal"
            value={settings.trust_proxy || ''}
            onChange={e => update('trust_proxy', e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Set if the app is behind a reverse proxy (Nginx, Pangolin, Cloudflare Tunnel, etc.).
            Use <code className="text-brand">uniquelocal</code> for Docker, or enter the proxy's specific IP.
            Leave empty for direct deployments. Changes apply immediately without restart.
          </p>
        </div>
      </Card>

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
      </Button>

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        isFirstLogin={false}
      />
    </div>
  );
}
