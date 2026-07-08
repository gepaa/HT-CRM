import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

export const AppLayout: React.FC = () => {
  const location = useLocation();

  const getPageInfo = (pathname: string): { title: string; breadcrumb?: string } => {
    if (pathname === '/' || pathname === '/dashboard') return { title: 'Hot Lead War Room', breadcrumb: 'Executive Dashboard' };
    if (pathname.startsWith('/leads')) return { title: 'Lead Intelligence & Tiers', breadcrumb: 'Inquiries & Qualification' };
    if (pathname.startsWith('/pipeline')) return { title: 'High-Ticket Deal Pipeline', breadcrumb: 'Revenue Tracking' };
    if (pathname.startsWith('/tasks')) return { title: 'SLA Tasks & Follow-Ups', breadcrumb: 'Action Items' };
    if (pathname.startsWith('/reports')) return { title: 'Conversion Analytics & SLA', breadcrumb: 'Performance Reports' };
    if (pathname.startsWith('/settings')) return { title: 'System & Team Settings', breadcrumb: 'Configuration' };
    return { title: 'Garage Auto Supplies CRM', breadcrumb: 'War Room' };
  };

  const { title, breadcrumb } = getPageInfo(location.pathname);

  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex selection:bg-brand-500/30 selection:text-white relative overflow-x-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full pb-20 lg:pb-0">
        <Topbar title={title} breadcrumb={breadcrumb} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default AppLayout;
