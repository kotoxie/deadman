import { useState, useEffect, useCallback } from 'react';
import { getDashboard, checkIn, togglePause, triggerPanic } from '../services/api.js';
import { useCountdown } from '../hooks/useCountdown.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';
import { Shield, Users, Clock, AlertTriangle, Play, Pause, Zap, CheckCircle2, Bell, Skull, Timer } from 'lucide-react';

function formatRelativeTime(ms) {
  const abs = Math.abs(ms);
  const isPast = ms < 0;
  if (abs < 3600000) return `${Math.round(abs / 60000)}m ${isPast ? 'ago' : ''}`.trim();
  if (abs < 86400000) return `${Math.round(abs / 3600000)}h ${isPast ? 'ago' : ''}`.trim();
  return `${Math.round(abs / 86400000)}d ${isPast ? 'ago' : ''}`.trim();
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DeliveryTimeline({ checkin }) {
  const now = Date.now();
  const lastCheckinTime = new Date(checkin.lastCheckinAt).getTime();
  const deadlineTime = new Date(checkin.nextDeadlineAt).getTime();
  const graceEndTime = deadlineTime + checkin.gracePeriodHours * 3600000;

  const timelineStart = lastCheckinTime;
  const timelineEnd = graceEndTime;
  const totalSpan = timelineEnd - timelineStart;
  const getPos = (t) => Math.max(0, Math.min(100, ((t - timelineStart) / totalSpan) * 100));

  const nowPos = getPos(now);
  const nowIsPast = now > graceEndTime;

  const warningEvents = [...(checkin.warningSchedule || [])]
    .sort((a, b) => b - a)
    .map((hours, i) => ({
      time: deadlineTime - hours * 3600000,
      label: `${hours}h reminder`,
      shortLabel: `${hours}h`,
      type: 'warning',
      key: `w-${i}`,
    }));

  const events = [
    { time: lastCheckinTime, label: 'Last Check-in', shortLabel: 'Check-in', type: 'checkin', key: 'checkin' },
    ...warningEvents,
    { time: deadlineTime, label: 'Deadline', shortLabel: 'Deadline', type: 'deadline', key: 'deadline' },
    { time: graceEndTime, label: 'Delivery', shortLabel: 'Delivery', type: 'delivery', key: 'delivery' },
  ];

  const eventConfig = {
    checkin: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400', ring: 'ring-green-400/30', dotBg: 'bg-green-500' },
    warning: { icon: Bell, color: 'text-yellow-400', bg: 'bg-yellow-400', ring: 'ring-yellow-400/30', dotBg: 'bg-yellow-500' },
    deadline: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-400', ring: 'ring-orange-400/30', dotBg: 'bg-orange-500' },
    delivery: { icon: Skull, color: 'text-red-400', bg: 'bg-red-400', ring: 'ring-red-400/30', dotBg: 'bg-red-500' },
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Timer size={18} className="text-brand" />
          <h3 className="font-semibold text-white">Delivery Timeline</h3>
        </div>
        <span className="text-xs text-gray-500">
          {checkin.intervalDays}d cycle · {checkin.gracePeriodHours}h grace period
        </span>
      </div>

      {/* Progress bar track */}
      <div className="relative mb-10 mt-4">
        {/* Background track */}
        <div className="relative h-2 rounded-full overflow-hidden">
          {/* Gradient zones */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 via-yellow-500/30 via-orange-500/30 to-red-500/30" />
          {/* Filled progress */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(nowPos, 100)}%`,
              background: nowPos < 50
                ? 'linear-gradient(to right, #22c55e, #eab308)'
                : nowPos < 85
                  ? 'linear-gradient(to right, #22c55e, #eab308, #f97316)'
                  : 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
            }}
          />
        </div>

        {/* Event dots on the track */}
        {events.map((ev) => {
          const pos = getPos(ev.time);
          const isPast = now > ev.time;
          const cfg = eventConfig[ev.type];
          return (
            <div
              key={ev.key}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${pos}%` }}
            >
              <div className={`w-4 h-4 rounded-full border-2 ${isPast ? `${cfg.dotBg} border-white/20` : 'bg-surface border-white/20'} transition-all`} />
            </div>
          );
        })}

        {/* NOW indicator */}
        {!checkin.isPaused && !nowIsPast && (
          <div
            className="absolute top-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${nowPos}%` }}
          >
            <div className="w-0.5 h-6 -translate-y-full bg-white/70 mb-0" />
            <div className="absolute -top-8 whitespace-nowrap bg-white/10 backdrop-blur-sm border border-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
              NOW
            </div>
          </div>
        )}

        {/* Event labels */}
        {events.map((ev, i) => {
          const pos = getPos(ev.time);
          const isPast = now > ev.time;
          const cfg = eventConfig[ev.type];
          const Icon = cfg.icon;
          const isAbove = i % 2 === 0;

          return (
            <div
              key={`label-${ev.key}`}
              className="absolute -translate-x-1/2"
              style={{ left: `${pos}%`, [isAbove ? 'bottom' : 'top']: '14px' }}
            >
              <div className={`flex flex-col items-center gap-0.5 ${isAbove ? 'flex-col-reverse' : ''}`}>
                {!isAbove && <div className="w-px h-3 bg-white/10" />}
                <div className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-medium ${isPast ? 'text-gray-500' : cfg.color}`}>
                  <Icon size={11} />
                  <span>{ev.shortLabel}</span>
                </div>
                <div className={`text-[10px] whitespace-nowrap ${isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                  {isPast
                    ? formatRelativeTime(ev.time - now)
                    : formatDateTime(new Date(ev.time).toISOString())}
                </div>
                {isAbove && <div className="w-px h-3 bg-white/10" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event legend / status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
        {events.map((ev) => {
          const isPast = now > ev.time;
          const isNext = !isPast && events.filter(e => !( now > e.time))[0]?.key === ev.key;
          const cfg = eventConfig[ev.type];
          const Icon = cfg.icon;
          return (
            <div
              key={`card-${ev.key}`}
              className={`rounded-lg px-3 py-2.5 border transition-all ${
                isNext
                  ? `bg-surface-lighter border-white/15 ring-1 ${cfg.ring}`
                  : isPast
                    ? 'bg-surface/40 border-white/5 opacity-50'
                    : 'bg-surface/60 border-white/8'
              }`}
            >
              <div className={`flex items-center gap-1.5 mb-1 ${isPast ? 'text-gray-500' : cfg.color}`}>
                <Icon size={12} />
                <span className="text-[11px] font-semibold">{ev.label}</span>
              </div>
              <p className={`text-[10px] leading-tight ${isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                {isPast
                  ? `${formatRelativeTime(ev.time - now)} ago`
                  : `In ${formatRelativeTime(now - ev.time)}`}
              </p>
              {isNext && (
                <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                  Next
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [panicOpen, setPanicOpen] = useState(false);
  const [panicConfirm, setPanicConfirm] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await getDashboard();
      setData(d);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const countdown = useCountdown(data?.checkin?.nextDeadlineAt);

  const handleCheckin = async () => {
    try {
      await checkIn();
      toast.success('Checked in successfully!');
      load();
    } catch { toast.error('Check-in failed'); }
  };

  const handlePause = async () => {
    try {
      const result = await togglePause(!data.checkin.isPaused);
      toast.success(result.isPaused ? 'Switch paused' : 'Switch resumed');
      load();
    } catch { toast.error('Failed to toggle pause'); }
  };

  const handlePanic = async () => {
    if (panicConfirm !== 'DELIVER') return;
    try {
      await triggerPanic();
      toast.success('Delivery triggered!');
      setPanicOpen(false);
      setPanicConfirm('');
      load();
    } catch { toast.error('Delivery failed'); }
  };

  if (loading) return <div className="text-gray-400">Loading...</div>;
  if (!data) return null;

  const { checkin, vault, recipients, deliveryStats, recentLogs } = data;

  const timerColor = countdown.isExpired
    ? 'text-red-500'
    : countdown.days < 1
      ? 'text-yellow-400'
      : 'text-green-400';

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>

      {/* Countdown Timer */}
      <Card className="text-center py-8">
        {checkin.isPaused ? (
          <div className="text-3xl font-bold text-yellow-400">PAUSED</div>
        ) : (
          <div className={`text-5xl font-mono font-bold ${timerColor}`}>
            {String(countdown.days).padStart(2, '0')}:{String(countdown.hours).padStart(2, '0')}:
            {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
          </div>
        )}
        <p className="text-gray-400 mt-2 text-sm">
          {checkin.isPaused ? 'Countdown is paused' : 'Time remaining until delivery'}
        </p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <Button onClick={handleCheckin} size="lg">
            <Clock size={18} /> Check In
          </Button>
          <Button variant={checkin.isPaused ? 'secondary' : 'outline'} onClick={handlePause}>
            {checkin.isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
          </Button>
          <Button variant="danger" onClick={() => setPanicOpen(true)}>
            <Zap size={16} /> Panic
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <Shield className="text-blue-400" size={24} />
            <div>
              <p className="text-2xl font-bold text-white">{vault.totalItems}</p>
              <p className="text-sm text-gray-400">Vault Items</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Users className="text-purple-400" size={24} />
            <div>
              <p className="text-2xl font-bold text-white">{recipients.total}</p>
              <p className="text-sm text-gray-400">Recipients</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <Clock className="text-green-400" size={24} />
            <div>
              <p className="text-2xl font-bold text-white">{checkin.intervalDays}d</p>
              <p className="text-sm text-gray-400">Check-in Interval</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Delivery Timeline */}
      <DeliveryTimeline checkin={checkin} />

      {/* Recent Deliveries */}
      {recentLogs.length > 0 && (
        <Card>
          <h3 className="font-semibold text-white mb-3">Recent Deliveries</h3>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{log.recipient_name} - {log.item_name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'error' : 'warning'}>
                    {log.status}
                  </Badge>
                  <Badge variant="info">{log.method}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Panic Modal */}
      <Modal open={panicOpen} onClose={() => { setPanicOpen(false); setPanicConfirm(''); }} title="Trigger Delivery">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <AlertTriangle className="text-red-400 shrink-0" size={20} />
            <p className="text-sm text-red-300">
              This will immediately deliver all vault items to all assigned recipients. This action cannot be undone.
            </p>
          </div>
          <Input
            label='Type "DELIVER" to confirm'
            value={panicConfirm}
            onChange={(e) => setPanicConfirm(e.target.value)}
            placeholder="DELIVER"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setPanicOpen(false); setPanicConfirm(''); }}>Cancel</Button>
            <Button variant="danger" onClick={handlePanic} disabled={panicConfirm !== 'DELIVER'}>
              Trigger Delivery
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
