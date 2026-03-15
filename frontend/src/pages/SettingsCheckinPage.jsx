import { useState, useEffect } from 'react';
import { Save, Clock } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useSettings } from '../hooks/useSettings.js';

export default function SettingsCheckinPage() {
  const { settings, loading, saving, update, save } = useSettings();
  const [warningScheduleText, setWarningScheduleText] = useState('');

  // Sync local text state once settings loads
  useEffect(() => {
    if (!loading) {
      setWarningScheduleText(
        Array.isArray(settings.warning_schedule)
          ? settings.warning_schedule.join(', ')
          : '72, 48, 24, 12, 6, 1'
      );
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <p className="text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
          <Clock size={18} className="text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Check-In Configuration</h2>
          <p className="text-xs text-gray-500">Set how often you check in and when warnings are sent</p>
        </div>
      </div>

      <Card className="space-y-5">
        {/* Interval */}
        <div>
          <Input
            label="Check-in Interval (days)"
            type="number"
            min={1}
            value={settings.checkin_interval_days || 14}
            onChange={e => update('checkin_interval_days', parseInt(e.target.value))}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            How often you must check in. If you don't check in within this many days,
            the deadline countdown begins.
          </p>
        </div>

        <hr className="border-border" />

        {/* Grace Period */}
        <div>
          <Input
            label="Grace Period (hours)"
            type="number"
            min={0}
            value={settings.grace_period_hours || 48}
            onChange={e => update('grace_period_hours', parseInt(e.target.value))}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Extra time after the deadline passes before vault contents are delivered to recipients.
            Acts as a safety net — if you miss the deadline due to travel or illness you can still
            check in during the grace period to prevent delivery.
          </p>
        </div>

        <hr className="border-border" />

        {/* Warning Schedule */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">
            Warning Schedule
            <span className="ml-2 text-xs font-normal text-gray-500">hours before deadline, comma-separated</span>
          </label>
          <input
            className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            value={warningScheduleText}
            onChange={e => setWarningScheduleText(e.target.value)}
            onBlur={e => {
              const parsed = e.target.value
                .split(',')
                .map(v => parseInt(v.trim()))
                .filter(v => !isNaN(v) && v > 0);
              update('warning_schedule', parsed);
            }}
            placeholder="72, 48, 24, 12, 6, 1"
          />
          <p className="text-xs text-gray-500">
            You'll receive reminders at each of these thresholds before the deadline.
            Notifications are sent to the channels configured in{' '}
            <span className="text-brand">Notifications</span>.
          </p>
        </div>
      </Card>

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}
