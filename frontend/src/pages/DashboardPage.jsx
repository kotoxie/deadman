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

// diffMs = eventTime - now  →  positive = future, negative = past
function formatTime(diffMs) {
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;
  if (abs < 60000) return past ? 'just now' : 'soon';
  if (abs < 3600000) { const m = Math.round(abs / 60000); return past ? `${m}m ago` : `in ${m}m`; }
  if (abs < 86400000) { const h = Math.round(abs / 3600000); return past ? `${h}h ago` : `in ${h}h`; }
  const d = Math.round(abs / 86400000);
  return past ? `${d}d ago` : `in ${d}d`;
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DeliveryTimeline({ checkin }) {
  const now = Date.now();
  const lastCheckinTime = new Date(checkin.lastCheckinAt).getTime();
  const deadlineTime   = new Date(checkin.nextDeadlineAt).getTime();
  const graceEndTime   = deadlineTime + checkin.gracePeriodHours * 3600000;

  const totalSpan = graceEndTime - lastCheckinTime;
  const getPos = (t) => Math.max(0, Math.min(100, ((t - lastCheckinTime) / totalSpan) * 100));
  const nowPos = getPos(now);

  const warningEvents = [...(checkin.warningSchedule || [])]
    .sort((a, b) => b - a)
    .map((hours, i) => ({
      time: deadlineTime - hours * 3600000,
      label: `${hours}h reminder`,
      type: 'warning',
      key: `w-${i}`,
    }));

  const events = [
    { time: lastCheckinTime, label: 'Last Check-in', type: 'checkin',  key: 'checkin'  },
    ...warningEvents,
    { time: deadlineTime,   label: 'Deadline',       type: 'deadline', key: 'deadline' },
    { time: graceEndTime,   label: 'Delivery',       type: 'delivery', key: 'delivery' },
  ];

  const cfg = {
    checkin:  { icon: CheckCircle2,  color: 'text-green-400',  dotFill: 'bg-green-500',  ring: 'ring-green-500/40',  iconBg: 'bg-green-500/15'  },
    warning:  { icon: Bell,          color: 'text-yellow-400', dotFill: 'bg-yellow-500', ring: 'ring-yellow-500/40', iconBg: 'bg-yellow-500/15' },
    deadline: { icon: AlertTriangle, color: 'text-orange-400', dotFill: 'bg-orange-500', ring: 'ring-orange-500/40', iconBg: 'bg-orange-500/15' },
    delivery: { icon: Skull,         color: 'text-red-400',    dotFill: 'bg-red-500',    ring: 'ring-red-500/40',   iconBg: 'bg-red-500/15'    },
  };

  const nextEvent = events.find(e => e.time > now);

  // Only 3 anchor labels on the bar — evenly spaced, never overlap
  const anchorLabels = [
    { key: 'checkin',  time: lastCheckinTime, label: 'Check-in', anchor: 'left'  },
    { key: 'deadline', time: deadlineTime,    label: 'Deadline', anchor: 'center' },
    { key: 'delivery', time: graceEndTime,    label: 'Delivery', anchor: 'right' },
  ];

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Timer size={17} className="text-brand" />
          <h3 className="font-semibold text-white">Delivery Timeline</h3>
        </div>
        <span className="text-xs text-gray-500">
          {checkin.intervalDays}d cycle · {checkin.gracePeriodHours}h grace
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="relative" style={{ paddingTop: '28px', paddingBottom: '28px' }}>

        {/* Track background */}
        <div className="relative h-2 rounded-full bg-white/5">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-500/15 via-yellow-500/15 to-red-500/15" />
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(nowPos, 100)}%`,
              background: nowPos < 55
                ? 'linear-gradient(90deg,#22c55e,#eab308)'
                : nowPos < 82
                  ? 'linear-gradient(90deg,#22c55e,#eab308,#f97316)'
                  : 'linear-gradient(90deg,#22c55e,#eab308,#f97316,#ef4444)',
            }}
          />
        </div>

        {/* Event dots */}
        {events.map((ev) => {
          const pos   = getPos(ev.time);
          const past  = now > ev.time;
          const isNxt = ev.key === nextEvent?.key;
          const c     = cfg[ev.type];
          return (
            <div
              key={ev.key}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${pos}%` }}
            >
              <div className={`rounded-full border-2 border-[#0f1117] transition-all ${
                past  ? `w-3 h-3 ${c.dotFill}` :
                isNxt ? `w-4 h-4 bg-[#0f1117] ring-2 ${c.ring}` :
                        'w-3 h-3 bg-[#1e2433] border-white/15'
              }`} />
            </div>
          );
        })}

        {/* NOW pill + stem */}
        {!checkin.isPaused && nowPos > 0 && nowPos < 100 && (
          <div
            className="absolute top-1/2 z-20 -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${nowPos}%` }}
          >
            <div className="mb-0.5 -translate-y-full flex flex-col items-center">
              <span className="bg-white text-black text-[9px] font-black px-2 py-0.5 rounded tracking-widest shadow-xl mb-1 whitespace-nowrap">
                NOW
              </span>
              <div className="w-px h-4 bg-white/50" />
            </div>
          </div>
        )}

        {/* Anchor labels below bar — 3 only, never overlap */}
        {anchorLabels.map((al) => {
          const pos  = getPos(al.time);
          const past = now > al.time;
          const c    = cfg[al.key === 'checkin' ? 'checkin' : al.key === 'deadline' ? 'deadline' : 'delivery'];
          // left-anchor: don't shift; center: shift -50%; right-anchor: shift -100%
          const translateClass = al.anchor === 'left' ? '' : al.anchor === 'right' ? '-translate-x-full' : '-translate-x-1/2';
          const alignClass     = al.anchor === 'left' ? 'items-start' : al.anchor === 'right' ? 'items-end' : 'items-center';
          return (
            <div
              key={`al-${al.key}`}
              className={`absolute top-1/2 flex flex-col ${alignClass} ${translateClass}`}
              style={{ left: `${pos}%` }}
            >
              <div className="w-px h-3 bg-white/10 mt-1" />
              <span className={`whitespace-nowrap text-[10px] font-semibold mt-0.5 ${past ? 'text-gray-600' : c.color}`}>
                {al.label}
              </span>
              <span className={`whitespace-nowrap text-[9px] mt-0.5 ${past ? 'text-gray-700' : 'text-gray-500'}`}>
                {formatTime(al.time - now)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Event list ── */}
      <div className="mt-1 border-t border-white/5 pt-3 space-y-0.5">
        {events.map((ev) => {
          const past  = now > ev.time;
          const isNxt = ev.key === nextEvent?.key;
          const c     = cfg[ev.type];
          const Icon  = c.icon;
          return (
            <div
              key={`row-${ev.key}`}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                isNxt ? 'bg-white/5 border border-white/8' : ''
              }`}
            >
              {/* Icon bubble */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${past ? 'bg-white/5' : c.iconBg}`}>
                <Icon size={12} className={past ? 'text-gray-600' : c.color} />
              </div>

              {/* Label */}
              <span className={`text-sm flex-1 min-w-0 truncate ${past ? 'text-gray-500' : 'text-gray-200'}`}>
                {ev.label}
              </span>

              {/* Date */}
              <span className={`text-xs tabular-nums hidden sm:block ${past ? 'text-gray-700' : 'text-gray-500'}`}>
                {formatDateTime(ev.time)}
              </span>

              {/* Relative time */}
              <span className={`text-xs tabular-nums w-16 text-right font-medium ${past ? 'text-gray-600' : c.color}`}>
                {formatTime(ev.time - now)}
              </span>

              {/* Next badge */}
              {isNxt && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-brand bg-brand/15 px-1.5 py-0.5 rounded whitespace-nowrap">
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
