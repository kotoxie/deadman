import { Save, Bell, Mail, MessageCircle, FileText } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import { useSettings } from '../hooks/useSettings.js';
import { testWarning } from '../services/api.js';
import toast from 'react-hot-toast';

export default function SettingsNotificationsPage() {
  const { settings, loading, saving, update, save } = useSettings();

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const emailTemplateActive = !!(settings.warning_email_subject || settings.warning_email_body);
  const tgTemplateActive = !!settings.warning_telegram_template;

  const handleTestWarning = async () => {
    try {
      const result = await testWarning();
      const parts = [];
      for (const [ch, info] of Object.entries(result.channels || {})) {
        parts.push(`${ch}: ${info.status}${info.error ? ` (${info.error})` : ''}`);
      }
      toast.success(`Test warning sent! ${parts.join(', ')}`, { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Test warning failed');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
          <Bell size={18} className="text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Notifications</h2>
          <p className="text-xs text-gray-500">Where check-in reminders and deadline warnings are sent to you</p>
        </div>
      </div>

      {/* Admin Channels */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Notification Channels</span>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Check-in reminders and deadline warnings are sent only to you.
          Recipients only receive vault items when the dead man's switch triggers.
        </p>

        <Input
          label="Your Email"
          value={settings.admin_notify_email || ''}
          onChange={e => update('admin_notify_email', e.target.value)}
          placeholder="you@example.com"
        />
        <Input
          label="Your Telegram Chat ID"
          value={settings.admin_notify_telegram_chat_id || ''}
          onChange={e => update('admin_notify_telegram_chat_id', e.target.value)}
          placeholder="123456789"
        />

        <Button variant="secondary" size="sm" onClick={handleTestWarning}>
          <Bell size={14} /> Send Test Warning
        </Button>
      </Card>

      {/* Notification Templates */}
      <Card className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={14} className="text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notification Templates</span>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Customize warning messages sent before the deadline. Use{' '}
          <code className="text-gray-300 bg-black/30 px-1 py-0.5 rounded text-[11px]">{'{{hours}}'}</code>{' '}
          as a placeholder for hours remaining. Leave disabled to use the built-in defaults.
        </p>

        {/* Email Template */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Mail size={14} className="text-gray-400" /> Email Template
            </span>
            <Toggle
              value={emailTemplateActive}
              onChange={on => {
                if (on) {
                  update('warning_email_subject', "[Dead Man's Switch] Warning: {{hours}}h remaining");
                  update('warning_email_body', "Your Dead Man's Switch deadline is in {{hours}} hours. Please check in to prevent delivery.");
                } else {
                  update('warning_email_subject', '');
                  update('warning_email_body', '');
                }
              }}
            />
          </div>

          {emailTemplateActive ? (
            <div className="space-y-3 pl-4 border-l-2 border-brand/25 ml-1">
              <Input
                label="Subject"
                value={settings.warning_email_subject || ''}
                onChange={e => update('warning_email_subject', e.target.value)}
                placeholder="[Dead Man's Switch] Warning: {{hours}}h remaining"
              />
              <div className="space-y-1.5">
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
            <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <MessageCircle size={14} className="text-gray-400" /> Telegram Template
            </span>
            <Toggle
              value={tgTemplateActive}
              onChange={on => {
                if (on) {
                  update('warning_telegram_template', "⚠️ <b>Dead Man's Switch Warning</b>\n\nYour deadline is in <b>{{hours}} hours</b>. Please check in to prevent delivery.");
                } else {
                  update('warning_telegram_template', '');
                }
              }}
            />
          </div>

          {tgTemplateActive ? (
            <div className="space-y-2 pl-4 border-l-2 border-brand/25 ml-1">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-300">Message</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 min-h-[80px] resize-y"
                  value={settings.warning_telegram_template || ''}
                  onChange={e => update('warning_telegram_template', e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  Supports HTML: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;code&gt;code&lt;/code&gt;
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic pl-1">Using default Telegram template</p>
          )}
        </div>
      </Card>

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}
