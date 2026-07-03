import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Zap, Terminal, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLeads } from '../../hooks/useLeads';
import { getInitials } from '../../lib/formatters';
import { Modal } from '../ui/Modal';
import { LeadForm } from '../leads/LeadForm';
import { firebaseRuntime } from '../../config/firebase';
import { useToast } from '../ui/Toast';
import type { LeadFormData } from '../../types/lead';

export interface TopbarProps {
  title?: string | React.ReactNode;
  breadcrumb?: string | React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ title = 'War Room', breadcrumb }) => {
  const { user, crmUser, logout } = useAuth();
  const { leads, createLead } = useLeads();
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Derive overdue/urgent task count for notification badge
  const overdueTaskCount = leads.filter((l) => l.slaStatus === 'overdue').length;

  // Derive user display details
  const displayName = crmUser?.displayName || user?.displayName || 'Garage Admin';
  const parts = displayName.split(' ');
  const firstName = parts[0] || 'G';
  const lastName = parts.length > 1 ? parts[1] : 'A';
  const initials = getInitials(firstName, lastName);

  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const envLabel = firebaseRuntime.useEmulators
    ? 'FIREBASE EMULATORS'
    : isLocalhost
    ? 'LOCAL + PROD FIREBASE'
    : 'PRODUCTION FIREBASE';
  const envBadge = firebaseRuntime.useEmulators ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold tracking-wide select-none">
      <Zap className="w-3.5 h-3.5 animate-pulse" />
      <span>{envLabel}</span>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide select-none">
      <Terminal className="w-3.5 h-3.5" />
      <span>{envLabel}</span>
    </div>
  );

  // Quick search filter
  const searchResults = searchTerm.trim()
    ? leads.filter(
        (l) =>
          `${l.firstName} ${l.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (l.company && l.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
          l.productCategory.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5)
    : [];

  // Handle Quick Add Lead
  const handleQuickAddLead = async (formData: LeadFormData) => {
    if (formData.honeypot && formData.honeypot.trim() !== '') {
      setIsAddLeadModalOpen(false);
      return;
    }

    setCreating(true);
    try {
      const leadId = await createLead({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone?.trim() || undefined,
        company: formData.company?.trim() || undefined,
        deliveryZip: formData.deliveryZip?.trim() || undefined,
        productCategory: formData.productCategory,
        productTitle: formData.productTitle?.trim() || undefined,
        productPrice: formData.productPrice,
        quantity: formData.quantity || 1,
        targetBudget: formData.targetBudget.trim(),
        timeline: formData.timeline?.trim() || undefined,
        projectDetails: formData.projectDetails?.trim() || undefined,
        source: formData.source || { utm_source: 'quick_add' },
        formType: formData.formType || 'quote',
        assignedTo: crmUser?.id || null,
      });

      success('Lead created.');
      setIsAddLeadModalOpen(false);
      navigate(`/leads/${leadId}`);
    } catch (err) {
      console.error('Error creating quick lead:', err);
      error('Failed to create lead. Check console or permissions.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <header className="glass-header px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title & Breadcrumbs */}
        <div className="flex items-center gap-4">
          <div>
            {breadcrumb && (
              <div className="text-xs text-surface-400 mb-0.5 font-semibold tracking-wide uppercase">
                {breadcrumb}
              </div>
            )}
            {typeof title === 'string' ? (
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>{title}</span>
              </h1>
            ) : (
              <div>{title}</div>
            )}
          </div>
          <div className="hidden lg:block">{envBadge}</div>
        </div>

        {/* Center: Search Bar */}
        <div className="relative flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search leads, companies, equipment..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-10 pr-4 py-2 bg-surface-900/90 border border-surface-700/80 rounded-xl text-xs text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-inner"
            />
          </div>

          {/* Search Autocomplete Results Dropdown */}
          {isSearchOpen && searchTerm.trim() !== '' && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="p-2 text-xs font-semibold text-surface-400 bg-surface-950 border-b border-surface-800">
                Quick Search Results
              </div>
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-surface-400">
                  No leads found matching "{searchTerm}"
                </div>
              ) : (
                <div className="divide-y divide-surface-800">
                  {searchResults.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchTerm('');
                        navigate(`/leads/${lead.id}`);
                      }}
                      className="p-3 hover:bg-surface-800 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <p className="text-xs text-surface-400">
                          {lead.company || lead.email} • {lead.productCategory}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lead.tier === 'hot' ? 'bg-red-500/20 text-red-400' : lead.tier === 'warm' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {lead.tier}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions: Quick Add Lead & Profile */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden">{envBadge}</div>

          {/* Quick Add Lead Button */}
          <button
            onClick={() => setIsAddLeadModalOpen(true)}
            className="btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="font-bold">Add Lead</span>
          </button>

          {/* Notification Bell — navigates to overdue tasks */}
          <button
            onClick={() => navigate('/tasks')}
            className="relative p-2 rounded-xl bg-surface-800/80 text-surface-300 hover:text-white hover:bg-surface-800 transition-all border border-surface-700/60 focus:outline-none"
            title={overdueTaskCount > 0 ? `${overdueTaskCount} overdue lead${overdueTaskCount === 1 ? '' : 's'} — view tasks` : 'Tasks'}
            aria-label="View tasks"
          >
            <Bell className="w-5 h-5" />
            {overdueTaskCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full ring-2 ring-surface-900 animate-pulse flex items-center justify-center text-[9px] font-black text-white">
                {overdueTaskCount > 9 ? '9+' : overdueTaskCount}
              </span>
            )}
          </button>

          {/* User Profile Menu Trigger */}
          <div className="relative pl-2 border-l border-surface-800">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-surface-800/60 transition-colors focus:outline-none"
            >
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 border border-brand-400/40 flex items-center justify-center text-white font-bold text-sm shadow-md"
                title={user?.email || 'User Avatar'}
              >
                {initials}
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-white leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-brand-400 font-semibold leading-tight capitalize">
                  {crmUser?.role?.replace('_', ' ') || 'Administrator'}
                </p>
              </div>
            </button>

            {/* Dropdown Profile Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl overflow-hidden z-50 py-1">
                <div className="px-4 py-3 border-b border-surface-800 bg-surface-950/50">
                  <p className="text-xs font-semibold text-surface-400">Signed in as</p>
                  <p className="text-sm font-bold text-white truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium text-surface-300 hover:text-white hover:bg-surface-800 flex items-center gap-2"
                  >
                    <User className="w-4 h-4 text-brand-400" />
                    <span>User Settings</span>
                  </button>
                  {logout && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isAddLeadModalOpen}
        onClose={() => setIsAddLeadModalOpen(false)}
        title="Quick Add Lead Inquiry"
        size="lg"
      >
        <LeadForm onSubmit={handleQuickAddLead} loading={creating} />
      </Modal>
    </>
  );
};

export default Topbar;
