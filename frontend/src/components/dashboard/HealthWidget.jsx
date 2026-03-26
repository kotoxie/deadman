import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../ui/Card.jsx';
import {
  CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight,
  ArrowRight, Shield, ShieldAlert, Users, Bell, Lock, Clock, Mail, Circle,
  Package, Send,
} from 'lucide-react';

// ── Config maps ────────────────────────────────────────────────────────────
const SEVERITY = {
  critical: {
    label: 'Critical',
    Icon: XCircle,
    color: 'text-red-400',
    headerBg: 'bg-red-500/10',
    headerBorder: 'border-red-500/25',
    badge: 'bg-red-500/20 text-red-300',
    rowBg: 'bg-red-500/5',
    rowBorder: 'border-red-500/20',
    rowHover: 'hover:bg-red-500/10',
  },
  warning: {
    label: 'Warnings',
    Icon: AlertTriangle,
    color: 'text-yellow-400',
    headerBg: 'bg-yellow-500/10',
    headerBorder: 'border-yellow-500/25',
    badge: 'bg-yellow-500/20 text-yellow-300',
    rowBg: 'bg-yellow-500/5',
    rowBorder: 'border-yellow-500/20',
    rowHover: 'hover:bg-yellow-500/10',
  },
  info: {
    label: 'Suggestions',
    Icon: Info,
    color: 'text-blue-400',
    headerBg: 'bg-blue-500/10',
    headerBorder: 'border-blue-500/25',
    badge: 'bg-blue-500/20 text-blue-300',
    rowBg: 'bg-blue-500/5',
    rowBorder: 'border-blue-500/20',
    rowHover: 'hover:bg-blue-500/10',
  },
};

const CATEGORY_ICONS = {
  delivery:      Send,
  vault:         Package,
  recipients:    Users,
  notifications: Bell,
  security:      Lock,
  checkin:       Clock,
};

// ── Sub-components ─────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const cls =
    score === 100 ? 'text-green-400 bg-green-500/15 ring-green-500/30' :
    score >= 70   ? 'text-yellow-400 bg-yellow-500/15 ring-yellow-500/30' :
                    'text-red-400 bg-red-500/15 ring-red-500/30';
  return (
    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ring-1 ${cls}`}>
      {score}%
    </span>
  );
}

function SetupChecklist({ setup }) {
  const { completed, total, steps } = setup;
  const pct = Math.round((completed / total) * 100);
  const barColor =
    pct === 100 ? 'from-green-500 to-green-400' :
    pct >= 60   ? 'from-yellow-600 to-yellow-400' :
                  'from-red-600 to-red-400';

  const pendingSteps = steps.filter(s => !s.done);
  const doneSteps    = steps.filter(s => s.done);

  return (
    <div className="mb-5 pb-5 border-b border-white/5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-200">Setup Progress</span>
        <span className="text-xs text-gray-500">{completed} / {total} steps complete</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Pending steps */}
      {pendingSteps.length > 0 && (
        <div className="space-y-1 mb-3">
          {pendingSteps.map(step => (
            <div
              key={step.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Circle size={14} className="text-gray-600 shrink-0" />
              <span className="flex-1 text-sm text-gray-300">{step.label}</span>
              <Link
                to={step.link}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-white transition-colors whitespace-nowrap"
              >
                {step.action}
                <ArrowRight size={11} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Completed steps — collapsed summary */}
      {doneSteps.length > 0 && (
        <div className="space-y-1">
          {doneSteps.map(step => (
            <div
              key={step.id}
              className="flex items-center gap-2.5 px-2 py-1.5 opacity-50"
            >
              <CheckCircle2 size={14} className="text-green-400 shrink-0" />
              <span className="flex-1 text-xs text-gray-500 line-through">{step.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IssueRow({ item }) {
  const sev  = SEVERITY[item.severity];
  const CatIcon = CATEGORY_ICONS[item.category] || Info;

  return (
    <Link
      to={item.link}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors group
        ${sev.rowBg} ${sev.rowBorder} ${sev.rowHover}`}
    >
      {/* Category icon */}
      <CatIcon size={15} className={`${sev.color} shrink-0 mt-0.5`} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{item.message}</p>
        {item.detail && (
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.detail}</p>
        )}
      </div>

      {/* Action badge + arrow */}
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        <span className={`hidden sm:inline text-xs font-medium px-2 py-0.5 rounded ${sev.badge}`}>
          {item.action}
        </span>
        <ArrowRight size={13} className="text-gray-600 group-hover:text-white transition-colors" />
      </div>
    </Link>
  );
}

function IssueGroup({ severity, items, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const sev = SEVERITY[severity];
  const { Icon } = sev;

  if (items.length === 0) return null;

  return (
    <div className={`rounded-lg border overflow-hidden ${sev.headerBorder}`}>
      {/* Accordion header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 transition-opacity hover:opacity-90 ${sev.headerBg}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className={sev.color} />
          <span className={`text-sm font-semibold ${sev.color}`}>{sev.label}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${sev.badge}`}>
            {items.length}
          </span>
        </div>
        {open
          ? <ChevronDown size={14} className="text-gray-500" />
          : <ChevronRight size={14} className="text-gray-500" />
        }
      </button>

      {/* Issue rows */}
      {open && (
        <div className="p-2 space-y-2 bg-black/10">
          {items.map((item, i) => <IssueRow key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function HealthWidget({ health }) {
  if (!health) return null;

  const { score = 100, warnings = [], setup } = health;

  const critical = warnings.filter(w => w.severity === 'critical');
  const warning  = warnings.filter(w => w.severity === 'warning');
  const info     = warnings.filter(w => w.severity === 'info');

  // Fully healthy state
  if (warnings.length === 0 && (!setup || setup.score === 100)) {
    return (
      <Card className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <CheckCircle2 size={17} className="text-green-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">System healthy</p>
          <p className="text-xs text-gray-500 mt-0.5">All checks passed · fully configured</p>
        </div>
        <span className="text-sm font-bold text-green-400 bg-green-500/15 ring-1 ring-green-500/30 px-2.5 py-0.5 rounded-full">
          100%
        </span>
      </Card>
    );
  }

  const showSetup  = setup && setup.score < 100;
  const hasIssues  = warnings.length > 0;
  const hasCritical = critical.length > 0;

  return (
    <Card>
      {/* ── Widget header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className={hasCritical ? 'text-red-400' : 'text-yellow-400'} />
          <h3 className="font-semibold text-white">System Health</h3>
          {hasCritical && (
            <span className="text-xs font-bold text-red-300 bg-red-500/15 px-2 py-0.5 rounded-full">
              Action required
            </span>
          )}
        </div>
        <ScoreBadge score={score} />
      </div>

      {/* ── Setup checklist ── */}
      {showSetup && <SetupChecklist setup={setup} />}

      {/* ── Issue groups ── */}
      {hasIssues && (
        <div className="space-y-2">
          <IssueGroup severity="critical" items={critical} defaultOpen={true} />
          <IssueGroup
            severity="warning"
            items={warning}
            defaultOpen={critical.length === 0}
          />
          <IssueGroup
            severity="info"
            items={info}
            defaultOpen={critical.length === 0 && warning.length === 0}
          />
        </div>
      )}
    </Card>
  );
}
