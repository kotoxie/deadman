import { useState, useEffect } from 'react';
import { getSettings, updateSettings, testEmail, testTelegram, testWarning } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import ChangePasswordModal from '../components/features/ChangePasswordModal.jsx';
import toast from 'react-hot-toast';
import { Save, Send, KeyRound, Clock, Mail, MessageCircle, Bell, FileText, Shield, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [warningScheduleText, setWarningScheduleText] = useState('');

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
      setWarningScheduleText(Array.isArray(s.warning_schedule) ? s.warning_schedule.join(', ') : '72, 48, 24, 12, 6, 1');
      setLoading(false);
    }).catch(() => toast.error('Failed to load settings'));
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

      {/* Login & Security */}
      <Section title="Login & Security" icon={Shield} defaultOpen>
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Application Password</p>
              <p className="text-xs text-gray-500">Change the password used to log in</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
              <KeyRound size={14} /> Change Password
            </Button>
          </div>

          <hr className="border-border" />

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Login Protection</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Max Failed Attempts"
                type="number"
                min={2}
                max={50}
                value={settings.login_max_attempts || '5'}
                onChange={e => update('login_max_attempts', e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Failed attempts before IP is blocked</p>
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

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Security Notifications</p>
          <p className="text-xs text-gray-500">Requires Admin Notification channels to be configured below.</p>

          {/* Notify on IP Block */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Notify on IP Block</p>
              <p className="text-xs text-gray-500">Send alert when an IP is banned for failed logins</p>
            </div>
            <button
              type="button"
              onClick={() => update('notify_ip_block', settings.notify_ip_block === 'true' ? 'false' : 'true')}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings.notify_ip_block === 'true' ? 'bg-brand' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.notify_ip_block === 'true' ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Notify on Excessive Failures */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">Notify on Excessive Login Failures</p>
                <p className="text-xs text-gray-500">Alert when many failures occur across multiple IPs (possible brute-force)</p>
              </div>
              <button
                type="button"
                onClick={() => update('notify_excessive_failures', settings.notify_excessive_failures === 'true' ? 'false' : 'true')}
                className={`relative w-10 h-5 rounded-full transition-colors ${settings.notify_excessive_failures === 'true' ? 'bg-brand' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.notify_excessive_failures === 'true' ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {settings.notify_excessive_failures === 'true' && (
              <div className="pl-1 border-l-2 border-brand/20 ml-1">
                <div className="pl-3">
                  <Input
                    label="Failure Threshold (per hour)"
                    type="number"
                    min={5}
                    value={settings.login_excessive_threshold || '20'}
                    onChange={e => update('login_excessive_threshold', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-500">Total failed logins across all IPs within 1 hour before notification triggers</p>
                </div>
              </div>
            )}
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
              value={warningScheduleText}
              onChange={e => setWarningScheduleText(e.target.value)}
              onBlur={e => {
                const parsed = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                update('warning_schedule', parsed);
              }}
              placeholder="72, 48, 24, 12, 6, 1"
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

      {/* Notification Templates */}
      <Section title="Notification Templates" icon={FileText}>
        <Card className="space-y-4">
          <p className="text-xs text-gray-500">
            Customize the warning messages sent to you before the deadline. Use <code className="text-gray-400 bg-black/30 px-1 rounded">{'{{hours}}'}</code> as a placeholder for hours remaining. Leave fields empty to use the default templates.
          </p>

          {/* Email Template */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300 flex items-center gap-2"><Mail size={14} /> Email Template</span>
              <button
                type="button"
                onClick={() => {
                  if (settings.warning_email_subject || settings.warning_email_body) {
                    update('warning_email_subject', '');
                    update('warning_email_body', '');
                  } else {
                    update('warning_email_subject', "[Dead Man's Switch] Warning: {{hours}}h remaining");
                    update('warning_email_body', 'Your Dead Man\'s Switch deadline is in {{hours}} hours. Please check in to prevent delivery.');
                  }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${settings.warning_email_subject || settings.warning_email_body ? 'bg-brand' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.warning_email_subject || settings.warning_email_body ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {(settings.warning_email_subject || settings.warning_email_body) ? (
              <div className="space-y-3 pl-1 border-l-2 border-brand/20 ml-1">
                <div className="pl-3">
                  <Input
                    label="Subject"
                    value={settings.warning_email_subject || ''}
                    onChange={e => update('warning_email_subject', e.target.value)}
                    placeholder="[Dead Man's Switch] Warning: {{hours}}h remaining"
                  />
                </div>
                <div className="pl-3 space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Body</label>
                  <textarea
                    className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-h-[80px] resize-y"
                    value={settings.warning_email_body || ''}
                    onChange={e => update('warning_email_body', e.target.value)}
                    placeholder="Your Dead Man's Switch deadline is in {{hours}} hours. Please check in to prevent delivery."
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic pl-1">Using default email template</p>
            )}
          </div>

          <hr className="border-border" />

          {/* Telegram Template */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300 flex items-center gap-2"><MessageCircle size={14} /> Telegram Template</span>
              <button
                type="button"
                onClick={() => {
                  if (settings.warning_telegram_template) {
                    update('warning_telegram_template', '');
                  } else {
                    update('warning_telegram_template', '⚠️ <b>Dead Man\'s Switch Warning</b>\n\nYour deadline is in <b>{{hours}} hours</b>. Please check in to prevent delivery.');
                  }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${settings.warning_telegram_template ? 'bg-brand' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.warning_telegram_template ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {settings.warning_telegram_template ? (
              <div className="space-y-1 pl-1 border-l-2 border-brand/20 ml-1">
                <div className="pl-3 space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Message</label>
                  <textarea
                    className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-h-[80px] resize-y"
                    value={settings.warning_telegram_template || ''}
                    onChange={e => update('warning_telegram_template', e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">Supports HTML: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;code&gt;code&lt;/code&gt;</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 italic pl-1">Using default Telegram template</p>
            )}
          </div>
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
