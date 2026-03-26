import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard, checkIn, togglePause, triggerPanic } from '../services/api.js';
import { useCountdown } from '../hooks/useCountdown.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import HealthWidget from '../components/dashboard/HealthWidget.jsx';
import toast from 'react-hot-toast';
import {
  Shield, Users, Clock, AlertTriangle, Play, Pause, Zap, CheckCircle2,
  Bell, Skull, Timer, ShieldAlert, ChevronDown, ChevronUp, X,
} from 'lucide-react';

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

// ── Health drawer button (nudges when score < 100) ─────────────────────────
function HealthButton({ health, onClick }) {
  if (!health) return null;
  const { score = 100, warnings = [] } = health;
  const critical = warnings.some(w => w.severity === 'critical');
  const healthy  = score === 100;

  const color = critical ? 'text-red-400 bg-red-500/10 border-red-500/40 hover:bg-red-500/20'
              : !healthy  ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40 hover:bg-yellow-500/20'
                          : 'text-green-400 bg-green-500/10 border-green-500/40 hover:bg-green-500/20';
  const Icon = critical ? ShieldAlert : healthy ? CheckCircle2 : ShieldAlert;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${color}`}
    >
      {/* Pulse ring when not healthy */}
      {!healthy && (
        <span className="absolute -inset-0.5 rounded-lg animate-ping opacity-20 bg-current pointer-events-none" />
      )}
      <Icon size={15} />
      <span>Health</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
        critical ? 'bg-red-500/25 text-red-300' :
        !healthy  ? 'bg-yellow-500/25 text-yellow-300' :
                    'bg-green-500/25 text-green-300'
      }`}>{score}%</span>
    </button>
  );
}

// ── Health flyout drawer ───────────────────────────────────────────────────
function HealthDrawer({ health, open, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-md bg-surface border-l border-border shadow-2xl
          flex flex-col transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-brand" />
            <span className="font-semibold text-white">System Health</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-surface-lighter transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Drawer body — scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <HealthWidget health={health} />
        </div>
      </div>
    </>
  );
}

// ── Delivery timeline (compact by default, expandable) ─────────────────────
function DeliveryTimeline({ checkin }) {
  const [expanded, setExpanded] = useState(false);
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

  const anchorLabels = [
    { key: 'checkin',  time: lastCheckinTime, label: 'Check-in', anchor: 'left'   },
    { key: 'deadline', time: deadlineTime,    label: 'Deadline', anchor: 'center' },
    { key: 'delivery', time: graceEndTime,    label: 'Delivery', anchor: 'right'  },
  ];

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-brand" />
          <h3 className="font-semibold text-white text-sm">Delivery Timeline</h3>
          <span className="text-xs text-gray-500">{checkin.intervalDays}d cycle · {checkin.gracePeriodHours}h grace</span>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
        >
          {expanded ? <><ChevronUp size={13} /> Collapse</> : <><ChevronDown size={13} /> Details</>}
        </button>
      </div>

      {/* ── Progress bar ── */}
      <div className="relative" style={{ paddingTop: '26px', paddingBottom: expanded ? '26px' : '22px' }}>
        {/* Track */}
        <div className="relative h-1.5 rounded-full bg-white/5">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-500/15 via-yellow-500/15 to-red-500/15" />
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
          const pos  = getPos(ev.time);
          const past = now > ev.time;
          const isNxt = ev.key === nextEvent?.key;
          const c    = cfg[ev.type];
          return (
            <div key={ev.key} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${pos}%` }}>
              <div className={`rounded-full border-2 border-[#0f1117] transition-all ${
                past  ? `w-2.5 h-2.5 ${c.dotFill}` :
                isNxt ? `w-3.5 h-3.5 bg-[#0f1117] ring-2 ${c.ring}` :
                        'w-2.5 h-2.5 bg-[#1e2433] border-white/15'
              }`} />
            </div>
          );
        })}

        {/* NOW pill */}
        {!checkin.isPaused && nowPos > 0 && nowPos < 100 && (
          <div className="absolute top-1/2 z-20 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left: `${nowPos}%` }}>
            <div className="mb-0.5 -translate-y-full flex flex-col items-center">
              <span className="bg-white text-black text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest shadow-xl mb-1 whitespace-nowrap">NOW</span>
              <div className="w-px h-3 bg-white/50" />
            </div>
          </div>
        )}

        {/* Anchor labels */}
        {anchorLabels.map((al) => {
          const pos  = getPos(al.time);
          const past = now > al.time;
          const c    = cfg[al.key === 'checkin' ? 'checkin' : al.key === 'deadline' ? 'deadline' : 'delivery'];
          const translateClass = al.anchor === 'left' ? '' : al.anchor === 'right' ? '-translate-x-full' : '-translate-x-1/2';
          const alignClass     = al.anchor === 'left' ? 'items-start' : al.anchor === 'right' ? 'items-end' : 'items-center';
          return (
            <div key={`al-${al.key}`} className={`absolute top-1/2 flex flex-col ${alignClass} ${translateClass}`} style={{ left: `${pos}%` }}>
              <div className="w-px h-2.5 bg-white/10 mt-0.5" />
              <span className={`whitespace-nowrap text-[9px] font-semibold mt-0.5 ${past ? 'text-gray-600' : c.color}`}>{al.label}</span>
              <span className={`whitespace-nowrap text-[8px] mt-0.5 ${past ? 'text-gray-700' : 'text-gray-500'}`}>{formatTime(al.time - now)}</span>
            </div>
          );
        })}
      </div>

      {/* ── Expanded event list ── */}
      {expanded && (
        <div className="mt-1 border-t border-white/5 pt-2 space-y-0.5">
          {events.map((ev) => {
            const past  = now > ev.time;
            const isNxt = ev.key === nextEvent?.key;
            const c     = cfg[ev.type];
            const Icon  = c.icon;
            return (
              <div
                key={`row-${ev.key}`}
                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors ${isNxt ? 'bg-white/5 border border-white/8' : ''}`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${past ? 'bg-white/5' : c.iconBg}`}>
                  <Icon size={11} className={past ? 'text-gray-600' : c.color} />
                </div>
                <span className={`text-xs flex-1 min-w-0 truncate ${past ? 'text-gray-500' : 'text-gray-200'}`}>{ev.label}</span>
                <span className={`text-xs tabular-nums hidden sm:block ${past ? 'text-gray-700' : 'text-gray-500'}`}>{formatDateTime(ev.time)}</span>
                <span className={`text-xs tabular-nums w-14 text-right font-medium ${past ? 'text-gray-600' : c.color}`}>{formatTime(ev.time - now)}</span>
                {isNxt && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-brand bg-brand/15 px-1.5 py-0.5 rounded whitespace-nowrap">Next</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [panicOpen, setPanicOpen] = useState(false);
  const [panicConfirm, setPanicConfirm] = useState('');
  const [healthOpen, setHealthOpen] = useState(false);

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

  const { checkin, vault, recipients, deliveryStats, recentLogs, health } = data;

  const timerColor = countdown.isExpired
    ? 'text-red-500'
    : countdown.days < 1
      ? 'text-yellow-400'
      : 'text-green-400';

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <HealthButton health={health} onClick={() => setHealthOpen(true)} />
      </div>

      {/* ── Compact timer + stats ── */}
      <Card>
        <div className="flex items-center gap-5">
          {/* Timer + actions */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">
              {checkin.isPaused ? 'Status' : 'Time Until Delivery'}
            </p>
            {checkin.isPaused ? (
              <div className="text-2xl font-bold text-yellow-400">PAUSED</div>
            ) : (
              <div className={`text-3xl font-mono font-bold tabular-nums leading-none ${timerColor}`}>
                {String(countdown.days).padStart(2, '0')}:{String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </div>
            )}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button size="sm" onClick={handleCheckin}>
                <Clock size={13} /> Check In
              </Button>
              <Button size="sm" variant={checkin.isPaused ? 'secondary' : 'outline'} onClick={handlePause}>
                {checkin.isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPanicOpen(true)}>
                <Zap size={12} /> Panic
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch bg-white/8" />

          {/* Mini stats */}
          <div className="hidden sm:flex gap-6 shrink-0">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{vault.totalItems}</p>
              <div className="flex items-center gap-1 justify-center mt-0.5">
                <Shield size={10} className="text-blue-400" />
                <span className="text-[10px] text-gray-500">Vault</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{recipients.total}</p>
              <div className="flex items-center gap-1 justify-center mt-0.5">
                <Users size={10} className="text-purple-400" />
                <span className="text-[10px] text-gray-500">Recipients</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{checkin.intervalDays}d</p>
              <div className="flex items-center gap-1 justify-center mt-0.5">
                <Clock size={10} className="text-green-400" />
                <span className="text-[10px] text-gray-500">Interval</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Delivery Timeline (compact, expandable) ── */}
      <DeliveryTimeline checkin={checkin} />

      {/* ── Recent Deliveries ── */}
      {recentLogs.length > 0 && (
        <Card>
          <h3 className="font-semibold text-white text-sm mb-3">Recent Deliveries</h3>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300 text-xs">{log.recipient_name} — {log.item_name}</span>
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

      {/* ── Health drawer ── */}
      <HealthDrawer health={health} open={healthOpen} onClose={() => setHealthOpen(false)} />

      {/* ── Panic modal ── */}
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
