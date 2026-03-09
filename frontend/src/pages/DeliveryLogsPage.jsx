import { useState, useEffect } from 'react';
import { getDeliveryLogs, retryDelivery } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { RotateCw } from 'lucide-react';
import { format } from 'date-fns';

const statusVariant = {
  success: 'success',
  failed: 'error',
  pending: 'warning',
  retrying: 'warning',
};

export default function DeliveryLogsPage() {
  const [data, setData] = useState({ logs: [], total: 0 });
  const [filter, setFilter] = useState({ status: '', method: '' });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const result = await getDeliveryLogs(filter);
      setData(result);
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter.status, filter.method]);

  const handleRetry = async (id) => {
    try {
      await retryDelivery(id);
      toast.success('Retry queued');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Retry failed'); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-white">Delivery Logs</h2>

      <div className="flex gap-3">
        <select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-border bg-surface-light px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={filter.method}
          onChange={e => setFilter(f => ({ ...f, method: e.target.value }))}
          className="rounded-lg border border-border bg-surface-light px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All methods</option>
          <option value="email">Email</option>
          <option value="telegram">Telegram</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>

      {loading ? <p className="text-gray-400">Loading...</p> : data.logs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No delivery logs yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.logs.map(log => (
            <Card key={log.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{log.recipient_name} - {log.item_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format(new Date(log.created_at + 'Z'), 'MMM d, yyyy HH:mm')} | {log.triggered_by}
                  {log.error_message && <span className="text-red-400 ml-2">{log.error_message}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="info">{log.method}</Badge>
                <Badge variant={statusVariant[log.status]}>{log.status}</Badge>
                {(log.status === 'failed' || log.status === 'retrying') && (
                  <Button variant="ghost" size="sm" onClick={() => handleRetry(log.id)}>
                    <RotateCw size={14} />
                  </Button>
                )}
              </div>
            </Card>
          ))}
          <p className="text-xs text-gray-500 text-center">{data.total} total entries</p>
        </div>
      )}
    </div>
  );
}
