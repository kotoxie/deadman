import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield, Users, ScrollText, ShieldAlert,
  Skull, LogOut, ArrowUpCircle,
  ShieldCheck, Clock, Bell, Mail, MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getVersion } from '../../services/api.js';

const mainNavItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vault',      icon: Shield,           label: 'Vault' },
  { to: '/recipients', icon: Users,            label: 'Recipients' },
  { to: '/logs',       icon: ScrollText,       label: 'Delivery Logs' },
  { to: '/audit-log',  icon: ShieldAlert,      label: 'Audit Log' },
];

const settingsNavItems = [
  { to: '/settings/security',      icon: ShieldCheck,    label: 'Login & Security' },
  { to: '/settings/checkin',       icon: Clock,          label: 'Check-In Config' },
  { to: '/settings/notifications', icon: Bell,           label: 'Notifications' },
];

const notifNavItems = [
  { to: '/settings/smtp',     icon: Mail,           label: 'SMTP' },
  { to: '/settings/telegram', icon: MessageCircle,  label: 'Telegram' },
];

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function SubNavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 pl-4 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-1 ${
          isActive
            ? 'bg-brand/15 text-brand'
            : 'text-gray-500 hover:text-gray-300 hover:bg-surface-lighter'
        }`
      }
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [version, setVersion] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [latestVersion, setLatestVersion] = useState(null);

  const onSettingsRoute = location.pathname.startsWith('/settings');

  useEffect(() => {
    getVersion().then(v => {
      setVersion(v.version);
      setRepoUrl(v.repoUrl);

      const match = v.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) {
        fetch(`https://api.github.com/repos/${match[1]}/releases/latest`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.tag_name && compareVersions(v.version, data.tag_name) < 0) {
              setLatestVersion(data.tag_name);
            }
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const hasUpdate = latestVersion !== null;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-light border-r border-border flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Skull className="text-brand" size={28} />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Dead Man's</h1>
              <p className="text-xs text-gray-400 -mt-0.5">Switch</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {/* Main items */}
          {mainNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand/15 text-brand'
                    : 'text-gray-400 hover:text-white hover:bg-surface-lighter'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          {/* Settings group */}
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Settings
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>

          {settingsNavItems.map(item => (
            <SubNavItem key={item.to} {...item} />
          ))}

          {/* Notification Settings sub-group */}
          <div className="pt-3 pb-1">
            <div className="flex items-center gap-2 px-3 py-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                Notification Settings
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>

          {notifNavItems.map(item => (
            <SubNavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-2">
          {version && (
            <a
              href={hasUpdate ? `${repoUrl}/releases/tag/${latestVersion}` : `${repoUrl}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                hasUpdate
                  ? 'text-green-400 bg-green-400/10 hover:bg-green-400/20'
                  : 'text-gray-500 hover:text-gray-400 hover:bg-surface-lighter'
              }`}
              title={hasUpdate ? `Update available: ${latestVersion}` : 'View releases on GitHub'}
            >
              {hasUpdate && <ArrowUpCircle size={14} className="shrink-0" />}
              <span className="font-mono">v{version}</span>
              {hasUpdate && <span className="text-green-400/70 ml-auto">{latestVersion} available</span>}
            </a>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-lighter w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
