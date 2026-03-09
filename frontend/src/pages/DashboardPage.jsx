import { useState, useEffect, useCallback } from 'react';
import { getDashboard, checkIn, togglePause, triggerPanic } from '../services/api.js';
import { useCountdown } from '../hooks/useCountdown.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';
import { Shield, Users, Clock, AlertTriangle, Play, Pause, Zap } from 'lucide-react';

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
