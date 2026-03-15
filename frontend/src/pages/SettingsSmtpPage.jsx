import { useState } from 'react';
import { Save, Send, Mail } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useSettings } from '../hooks/useSettings.js';
import { testEmail } from '../services/api.js';
import toast from 'react-hot-toast';

export default function SettingsSmtpPage() {
  const { settings, loading, saving, update, save } = useSettings();
  const [testEmailTo, setTestEmailTo] = useState('');

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const handleTestEmail = async () => {
    try {
      await testEmail(testEmailTo);
      toast.success('Test email sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Test failed');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
          <Mail size={18} className="text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Email (SMTP)</h2>
          <p className="text-xs text-gray-500">Configure outgoing email for notifications and vault delivery</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">SMTP Server</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="SMTP Host"
            value={settings.smtp_host || ''}
            onChange={e => update('smtp_host', e.target.value)}
            placeholder="smtp.gmail.com"
          />
          <Input
            label="Port"
            value={settings.smtp_port || '587'}
            onChange={e => update('smtp_port', e.target.value)}
            placeholder="587"
          />
        </div>

        <hr className="border-border" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Credentials</span>
        </div>

        <Input
          label="Username"
          value={settings.smtp_user || ''}
          onChange={e => update('smtp_user', e.target.value)}
          placeholder="user@example.com"
        />
        <Input
          label="Password"
          type="password"
          value={settings.smtp_pass || ''}
          onChange={e => update('smtp_pass', e.target.value)}
        />

        <hr className="border-border" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sender</span>
        </div>

        <Input
          label="From Address"
          value={settings.smtp_from || ''}
          onChange={e => update('smtp_from', e.target.value)}
          placeholder="deadman@example.com"
        />

        <hr className="border-border" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Test Connection</span>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Send Test Email To"
              value={testEmailTo}
              onChange={e => setTestEmailTo(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestEmail}
            disabled={!testEmailTo}
          >
            <Send size={14} /> Send Test
          </Button>
        </div>
      </Card>

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}
