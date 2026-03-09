import { useState, useEffect } from 'react';
import { getSettings, updateSettings, testEmail, testTelegram } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';
import { Save, Send } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testTgChatId, setTestTgChatId] = useState('');

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoading(false); }).catch(() => toast.error('Failed to load settings'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('Settings saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      {/* Check-in Settings */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Check-in Configuration</h3>
        <Input
          label="Check-in Interval (days)"
          type="number"
          min={1}
          value={settings.checkin_interval_days || 14}
          onChange={e => update('checkin_interval_days', parseInt(e.target.value))}
        />
        <Input
          label="Grace Period (hours)"
          type="number"
          min={0}
          value={settings.grace_period_hours || 48}
          onChange={e => update('grace_period_hours', parseInt(e.target.value))}
        />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-300">
            Warning Schedule (hours before deadline, comma-separated)
          </label>
          <input
            className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            value={Array.isArray(settings.warning_schedule) ? settings.warning_schedule.join(', ') : '72, 48, 24, 12, 6, 1'}
            onChange={e => update('warning_schedule', e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)))}
          />
        </div>
      </Card>

      {/* SMTP Settings */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Email (SMTP)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="SMTP Host" value={settings.smtp_host || ''} onChange={e => update('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
          <Input label="Port" value={settings.smtp_port || '587'} onChange={e => update('smtp_port', e.target.value)} placeholder="587" />
        </div>
        <Input label="Username" value={settings.smtp_user || ''} onChange={e => update('smtp_user', e.target.value)} />
        <Input label="Password" type="password" value={settings.smtp_pass || ''} onChange={e => update('smtp_pass', e.target.value)} />
        <Input label="From Address" value={settings.smtp_from || ''} onChange={e => update('smtp_from', e.target.value)} placeholder="deadman@example.com" />

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="Test Email To" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} placeholder="test@example.com" />
          </div>
          <Button variant="secondary" size="sm" onClick={async () => {
            try { await testEmail(testEmailTo); toast.success('Test email sent!'); }
            catch (err) { toast.error(err.response?.data?.error || 'Test failed'); }
          }} disabled={!testEmailTo}>
            <Send size={14} /> Test
          </Button>
        </div>
      </Card>

      {/* Telegram Settings */}
      <Card className="space-y-3">
        <h3 className="font-semibold text-white">Telegram Bot</h3>
        <Input label="Bot Token" type="password" value={settings.telegram_bot_token || ''} onChange={e => update('telegram_bot_token', e.target.value)} placeholder="123456:ABC-DEF..." />

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="Test Chat ID" value={testTgChatId} onChange={e => setTestTgChatId(e.target.value)} placeholder="123456789" />
          </div>
          <Button variant="secondary" size="sm" onClick={async () => {
            try { await testTelegram(testTgChatId); toast.success('Test message sent!'); }
            catch (err) { toast.error(err.response?.data?.error || 'Test failed'); }
          }} disabled={!testTgChatId}>
            <Send size={14} /> Test
          </Button>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
