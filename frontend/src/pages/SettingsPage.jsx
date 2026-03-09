import { useState, useEffect } from 'react';
import { getSettings, updateSettings, testEmail, testTelegram, testWarning } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import ChangePasswordModal from '../components/features/ChangePasswordModal.jsx';
import toast from 'react-hot-toast';
import { Save, Send, KeyRound, Clock, Mail, MessageCircle, Bell, ChevronDown, ChevronRight } from 'lucide-react';

function Section({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl hover:bg-surface-light transition-colors"
      >
        <Icon size={18} className="text-brand shrink-0" />
        <span className="font-semibold text-white text-left flex-1">{title}</span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="mt-2 space-y-3 pl-1">{children}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testTgChatId, setTestTgChatId] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      {/* Security */}
      <Section title="Security" icon={KeyRound} defaultOpen>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Application Password</p>
              <p className="text-xs text-gray-500">Change the password used to log in</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
              <KeyRound size={14} /> Change Password
            </Button>
          </div>
        </Card>
      </Section>

      {/* Check-in Configuration */}
      <Section title="Check-in Configuration" icon={Clock}>
        <Card className="space-y-4">
          <div>
            <Input
              label="Check-in Interval (days)"
              type="number"
              min={1}
              value={settings.checkin_interval_days || 14}
              onChange={e => update('checkin_interval_days', parseInt(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500">How often you must check in. If you don't check in within this many days, the deadline countdown begins.</p>
          </div>
          <div>
            <Input
              label="Grace Period (hours)"
              type="number"
              min={0}
              value={settings.grace_period_hours || 48}
              onChange={e => update('grace_period_hours', parseInt(e.target.value))}
            />
            <p className="mt-1 text-xs text-gray-500">Extra time after the deadline passes before vault contents are delivered to recipients. Acts as a safety net — if you miss the deadline by a day due to travel, illness, or a lost phone, you can still check in during the grace period to prevent delivery.</p>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              Warning Schedule (hours before deadline, comma-separated)
            </label>
            <input
              className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              value={Array.isArray(settings.warning_schedule) ? settings.warning_schedule.join(', ') : '72, 48, 24, 12, 6, 1'}
              onChange={e => update('warning_schedule', e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v)))}
            />
            <p className="mt-1 text-xs text-gray-500">You'll receive reminders at each of these thresholds before the deadline. Notifications are sent to the channels configured in Admin Notifications below.</p>
          </div>
        </Card>
      </Section>

      {/* Admin Notifications */}
      <Section title="Admin Notifications" icon={Bell}>
        <Card className="space-y-3">
          <p className="text-xs text-gray-500">
            Check-in reminders and deadline warnings are sent only to you (the admin).
            Recipients will only receive vault items when the dead man's switch triggers.
          </p>
          <Input
            label="Your Email (for check-in reminders)"
            value={settings.admin_notify_email || ''}
            onChange={e => update('admin_notify_email', e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Your Telegram Chat ID (for check-in reminders)"
            value={settings.admin_notify_telegram_chat_id || ''}
            onChange={e => update('admin_notify_telegram_chat_id', e.target.value)}
            placeholder="123456789"
          />
          <Button variant="secondary" size="sm" onClick={async () => {
            try {
              const result = await testWarning();
              const parts = [];
              for (const [ch, info] of Object.entries(result.channels || {})) {
                parts.push(`${ch}: ${info.status}${info.error ? ` (${info.error})` : ''}`);
              }
              toast.success(`Test warning sent! ${parts.join(', ')}`, { duration: 5000 });
            } catch (err) { toast.error(err.response?.data?.error || 'Test warning failed'); }
          }}>
            <Bell size={14} /> Test Warning
          </Button>
        </Card>
      </Section>

      {/* Email (SMTP) */}
      <Section title="Email (SMTP)" icon={Mail}>
        <Card className="space-y-3">
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
      </Section>

      {/* Telegram Bot */}
      <Section title="Telegram Bot" icon={MessageCircle}>
        <Card className="space-y-3">
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
      </Section>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
      </Button>

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        isFirstLogin={false}
      />
    </div>
  );
}
