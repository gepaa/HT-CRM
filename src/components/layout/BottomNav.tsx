import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, CheckSquare, Settings as SettingsIcon } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/dashboard', label: 'Dash', icon: LayoutDashboard },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/pipeline', label: 'Pipeline', icon: Kanban },
    { to: '/tasks', label: 'Tasks', icon: CheckSquare },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-950/95 backdrop-blur-xl border-t border-surface-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.5)]">
      <div className="flex justify-around items-center h-[72px] px-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const active = isActive || (item.to === '/dashboard' && window.location.pathname === '/');
                return `flex flex-col items-center justify-center w-full h-full min-h-[48px] space-y-1 transition-colors ${
                  active ? 'text-brand-400' : 'text-surface-400 hover:text-surface-200'
                }`;
              }}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
