import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Wrench,
  LayoutDashboard,
  Users,
  Kanban,
  CheckSquare,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  ShieldAlert,
  Database,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const Sidebar: React.FC = () => {
  const auth = useAuth();
  const user = auth?.user;
  const crmUser = auth?.crmUser;
  const logout = auth?.logout;

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: false },
    { to: '/leads', label: 'Leads', icon: Users, exact: false },
    { to: '/pipeline', label: 'Pipeline', icon: Kanban, exact: false },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare, exact: false },
    { to: '/reports', label: 'Reports', icon: BarChart3, exact: false },
    { to: '/settings', label: 'Settings', icon: SettingsIcon, exact: false },
    { to: '/sql-connect', label: 'SQL Connect', icon: Database, exact: false },
  ];

  return (
    <aside className="w-64 fixed inset-y-0 left-0 h-screen bg-surface-950/95 backdrop-blur-xl border-r border-surface-800/80 flex flex-col justify-between z-40 shadow-2xl">
      {/* Top Header & Brand */}
      <div>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-800/80 bg-gradient-to-r from-surface-950 to-surface-900">
          <div className="p-2.5 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl border border-brand-400/40 shadow-lg shadow-brand-500/20">
            <Wrench className="w-6 h-6 text-white shrink-0" />
          </div>
          <div>
            <span className="text-base font-black text-white tracking-wider block leading-none">
              GAS <span className="text-brand-400 font-extrabold">CRM</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-surface-400 mt-1 block">
              Hot Lead War Room
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => {
                  // Check if root '/' should highlight Dashboard
                  const active = isActive || (item.to === '/dashboard' && window.location.pathname === '/');
                  return `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-gradient-to-r from-brand-600/30 to-brand-500/10 text-brand-400 border border-brand-500/30 shadow-md shadow-brand-500/5 translate-x-1'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800/60 border border-transparent hover:translate-x-0.5'
                  }`;
                }}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* SLA / War Room Status Widget in Sidebar */}
      <div className="px-4 py-2">
        <div className="p-3.5 rounded-xl bg-surface-900/80 border border-surface-800/80 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
            <span>SLA WAR ROOM</span>
          </div>
          <p className="text-[11px] text-surface-400 leading-relaxed">
            Target response: <strong className="text-white">&lt; 15 mins</strong>. Prioritize HOT commercial lift inquiries.
          </p>
        </div>
      </div>

      {/* Bottom User Section */}
      <div className="p-4 border-t border-surface-800/80 bg-surface-950/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
              {crmUser?.role?.replace('_', ' ') || 'Team Member'}
            </p>
            <p className="text-sm font-bold text-white truncate" title={user?.email || ''}>
              {crmUser?.displayName || user?.email || 'admin@garageautosupplies.com'}
            </p>
          </div>
          {logout && (
            <button
              onClick={() => logout()}
              className="p-2.5 text-surface-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 focus:outline-none shrink-0"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
