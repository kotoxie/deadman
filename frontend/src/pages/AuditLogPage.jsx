import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuditLogs } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { ShieldAlert, Info, AlertTriangle, XOctagon, Search, ChevronDown, ChevronRight } from 'lucide-react';
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

function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityConfig[log.severity] || severityConfig.info;
  const SevIcon = sev.icon;
  const catColor = categoryColors[log.category] || 'text-gray-400';
  const hasDetails = !!log.details;

  return (
    <Card
      className={`!py-2.5 !px-4 ${hasDetails ? 'cursor-pointer hover:bg-surface-light/50' : ''}`}
      onClick={() => hasDetails && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <SevIcon size={16} className={`${sev.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">{log.action}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{format(new Date(log.created_at + 'Z'), 'MMM d, yyyy HH:mm:ss')}</span>
            {log.ip_address && <span>IP: {log.ip_address}</span>}
            {hasDetails && !expanded && (
              <span className="text-gray-600 truncate max-w-xs">{log.details}</span>
            )}
          </div>
          {expanded && hasDetails && (() => {
            const changes = tryParseChanges(log.details);
            if (changes) return <ChangesTable changes={changes} />;
            return (
              <pre className="mt-2 text-xs text-gray-400 bg-black/30 rounded-lg p-3 whitespace-pre-wrap break-all overflow-x-auto max-h-64 overflow-y-auto">
                {tryFormatJson(log.details)}
              </pre>
            );
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium ${catColor}`}>{log.category}</span>
          <Badge variant={sev.variant}>{log.severity}</Badge>
          {hasDetails && (
            expanded
              ? <ChevronDown size={14} className="text-gray-500" />
              : <ChevronRight size={14} className="text-gray-500" />
          )}
        </div>
      </div>
    </Card>
  );
}

function tryParseChanges(str) {
  try {
    const parsed = JSON.parse(str);
    if (parsed.changes && Array.isArray(parsed.changes)) return parsed.changes;
  } catch {}
  return null;
}

function tryFormatJson(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function ChangesTable({ changes }) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-black/30 text-gray-400">
            <th className="text-left px-3 py-1.5 font-medium">Setting</th>
            <th className="text-left px-3 py-1.5 font-medium">Old Value</th>
            <th className="text-left px-3 py-1.5 font-medium">New Value</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="px-3 py-1.5 text-gray-300 font-mono">{c.key}</td>
              <td className="px-3 py-1.5 text-red-400/80 font-mono">{formatValue(c.from)}</td>
              <td className="px-3 py-1.5 text-green-400/80 font-mono">{formatValue(c.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (v === null || v === undefined) return '(empty)';
  return String(v);
}

export default function AuditLogPage() {
  const [data, setData] = useState({ logs: [], total: 0 });
  const [filter, setFilter] = useState({ category: '', severity: '', search: '' });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 50;
  const debounceRef = useRef(null);

  const load = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const params = { ...f, limit, offset: p * limit };
      if (!params.search) delete params.search;
      if (!params.category) delete params.category;
      if (!params.severity) delete params.severity;
      const result = await getAuditLogs(params);
      setData(result);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filter.category, filter.severity]);

  // Load on page or dropdown filter change
  useEffect(() => { load(filter, page); }, [filter.category, filter.severity, page]);

  // Debounced search
  const handleSearchChange = (value) => {
    setFilter(f => ({ ...f, search: value }));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      load({ ...filter, search: value }, 0);
    }, 300);
  };

  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <ShieldAlert className="text-brand" size={28} />
        <h2 className="text-2xl font-bold text-white">Audit Log</h2>
        <span className="text-sm text-gray-500 ml-auto">{data.total} total entries</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search actions, details, IPs..."
            value={filter.search}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-light pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
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

      {/* Logs */}
      {loading ? <p className="text-gray-400">Loading...</p> : data.logs.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No audit log entries found</p>
        </Card>
      ) : (
        <>
          <div className="space-y-1.5">
            {data.logs.map(log => <AuditRow key={log.id} log={log} />)}
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
