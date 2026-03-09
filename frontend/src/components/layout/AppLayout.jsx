import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Shield, Users, ScrollText, ShieldAlert, Settings, Skull, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vault', icon: Shield, label: 'Vault' },
  { to: '/recipients', icon: Users, label: 'Recipients' },
  { to: '/logs', icon: ScrollText, label: 'Delivery Logs' },
  { to: '/audit-log', icon: ShieldAlert, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-light border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Skull className="text-brand" size={28} />
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Dead Man's</h1>
              <p className="text-xs text-gray-400 -mt-0.5">Switch</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
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
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-lighter w-full transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
