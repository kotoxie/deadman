import { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { ShieldAlert, Info, AlertTriangle, XOctagon } from 'lucide-react';
import { format } from 'date-fns';

const severityConfig = {
  info: { variant: 'info', icon: Info, color: 'text-blue-400' },
  warning: { variant: 'warning', icon: AlertTriangle, color: 'text-yellow-400' },
  critical: { variant: 'error', icon: XOctagon, color: 'text-red-400' },
};

const categoryColors = {
  auth: 'text-purple-400',
  vault: 'text-emerald-400',
  recipient: 'text-cyan-400',
  delivery: 'text-orange-400',
  settings: 'text-gray-400',
  checkin: 'text-brand',
  system: 'text-pink-400',
};

export default function AuditLogPage() {
  const [data, setData] = useState({ logs: [], total: 0 });
  const [filter, setFilter] = useState({ category: '', severity: '' });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = async () => {
    setLoading(true);
    try {
      const result = await getAuditLogs({ ...filter, limit, offset: page * limit });
      setData(result);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setPage(0); }, [filter.category, filter.severity]);
  useEffect(() => { load(); }, [filter.category, filter.severity, page]);

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-brand" size={28} />
        <h2 className="text-2xl font-bold text-white">Audit Log</h2>
        <span className="text-sm text-gray-500 ml-auto">{data.total} total entries</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          className="rounded-lg border border-border bg-surface-light px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All categories</option>
          <option value="auth">Auth</option>
          <option value="vault">Vault</option>
          <option value="recipient">Recipient</option>
          <option value="delivery">Delivery</option>
          <option value="checkin">Check-in</option>
          <option value="settings">Settings</option>
          <option value="system">System</option>
        </select>
        <select
          value={filter.severity}
          onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          className="rounded-lg border border-border bg-surface-light px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Table */}
      {loading ? <p className="text-gray-400">Loading...</p> : data.logs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No audit log entries found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-1.5">
            {data.logs.map(log => {
              const sev = severityConfig[log.severity] || severityConfig.info;
              const SevIcon = sev.icon;
              const catColor = categoryColors[log.category] || 'text-gray-400';

              return (
                <Card key={log.id} className="flex items-start gap-3 !py-2.5 !px-4">
                  <SevIcon size={16} className={`${sev.color} mt-0.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{log.action}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{format(new Date(log.created_at + 'Z'), 'MMM d, yyyy HH:mm:ss')}</span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                      {log.details && (
                        <span className="text-gray-600 truncate max-w-xs" title={log.details}>
                          {log.details}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${catColor}`}>{log.category}</span>
                    <Badge variant={sev.variant}>{log.severity}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm rounded-lg border border-border text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm rounded-lg border border-border text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
