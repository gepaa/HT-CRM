import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Menu, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      {/* Mobile Menu Toggle & Overlay */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-3.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-full shadow-2xl border border-brand-400/40 flex items-center justify-center focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-surface-950/90 backdrop-blur-md flex">
          <div onClick={() => setMobileMenuOpen(false)} className="w-full h-full relative">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full">
        <Topbar title={title} breadcrumb={breadcrumb} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
