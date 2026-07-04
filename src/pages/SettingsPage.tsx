// ─────────────────────────────────────────────────────────────
// SettingsPage – System Settings & Integration Configuration
// ─────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  Clock,
  Shield,
  Package,
  Plug,
  Users,
  ShoppingBag,
  BarChart2,
  Mail,
  Phone,
  Sparkles,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SLA_CONFIG,
  PRODUCT_CATEGORIES,
  CATEGORY_TIERS,
} from '../lib/constants';
import { useSettings } from '../hooks/useSettings';

const INTEGRATIONS_LIST = [
  {
    id: 'shopify',
    name: 'Shopify E-Commerce',
    description: 'Sync draft orders, product inventory, and customer accounts in real time.',
    icon: ShoppingBag,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'google_ads',
    name: 'Google Ads & GA4',
    description: 'Track paid traffic UTM attribution, gclid parameters, and offline conversion uploads.',
    icon: BarChart2,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email API',
    description: 'Automate transactional quote emails, follow-up sequences, and open tracking.',
    icon: Mail,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    id: 'twilio',
    name: 'Twilio SMS & Voice',
    description: 'Enable instant SMS SLA alerts, 2-way text messaging, and call logging.',
    icon: Phone,
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
  },
  {
    id: 'gemini',
    name: 'Google Gemini 1.5 Flash (Free Tier)',
    description: 'Ultra-fast, free tier AI assistant generating automated executive lead summaries, next actions, and quote emails.',
    icon: Sparkles,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
];

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const [hotMinutes, setHotMinutes] = useState(DEFAULT_SLA_CONFIG.hotLeadMinutes);
  const [warmMinutes, setWarmMinutes] = useState(DEFAULT_SLA_CONFIG.warmLeadMinutes);
  const [coldMinutes, setColdMinutes] = useState(DEFAULT_SLA_CONFIG.coldLeadMinutes);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.sla) {
      if (settings.sla.hotLeadMinutes !== undefined) setHotMinutes(settings.sla.hotLeadMinutes);
      if (settings.sla.warmLeadMinutes !== undefined) setWarmMinutes(settings.sla.warmLeadMinutes);
      if (settings.sla.coldLeadMinutes !== undefined) setColdMinutes(settings.sla.coldLeadMinutes);
    }
  }, [settings]);

  const handleSaveSLA = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      sla: {
        hotLeadMinutes: hotMinutes,
        warmLeadMinutes: warmMinutes,
        coldLeadMinutes: coldMinutes,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-8 pb-16 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="border-b border-surface-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          System Settings & Configuration
        </h1>
        <p className="text-sm text-surface-400 mt-1">
          Configure SLA targets, operating hours, product catalogue tiers, and third-party API integrations.
        </p>
      </div>

      {/* 1. SLA CONFIGURATION */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-surface-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">SLA Response Time Targets</h2>
              <p className="text-xs text-surface-400">
                Define required contact SLAs by lead temperature tier. Timers pause outside business hours.
              </p>
            </div>
          </div>
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings Saved</span>
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSLA} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 bg-surface-950 rounded-xl border border-red-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-red-400 tracking-wider">
                  Hot Tier SLA
                </span>
                <Badge variant="danger" className="text-[10px]">Score ≥ 75</Badge>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={hotMinutes}
                  onChange={(e) => setHotMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-sm text-surface-300 font-medium">Minutes (30m default)</span>
              </div>
            </div>

            <div className="p-4 bg-surface-950 rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-amber-400 tracking-wider">
                  Warm Tier SLA
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Score 30–49
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="60"
                  step="60"
                  value={warmMinutes}
                  onChange={(e) => setWarmMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-sm text-surface-300 font-medium">Minutes (24h = 1440m)</span>
              </div>
            </div>

            <div className="p-4 bg-surface-950 rounded-xl border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-blue-400 tracking-wider">
                  Cold Tier SLA
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Score 15–29
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="60"
                  step="60"
                  value={coldMinutes}
                  onChange={(e) => setColdMinutes(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-surface-900 border border-surface-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-surface-300 font-medium">Minutes (8h = 480m)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Save SLA Configuration</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. BUSINESS HOURS */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-surface-800 pb-4">
          <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Operating Business Hours</h2>
            <p className="text-xs text-surface-400">
              Timezone: <strong className="text-surface-200">{DEFAULT_BUSINESS_HOURS.timezone}</strong> (Mon-Fri 9:00 AM - 6:00 PM ET)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {DEFAULT_BUSINESS_HOURS.schedule.map((dayItem: any) => (
            <div
              key={dayItem.day}
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                dayItem.enabled
                  ? 'bg-surface-950 border-surface-800 text-surface-100'
                  : 'bg-surface-950/40 border-surface-850 text-surface-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">{dayItem.day}</span>
                <span
                  className={`w-2 h-2 rounded-full ${dayItem.enabled ? 'bg-emerald-400' : 'bg-surface-600'}`}
                />
              </div>
              <div className="text-sm font-mono mt-2 font-semibold">
                {dayItem.enabled ? `${dayItem.start} - ${dayItem.end}` : 'Closed'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. PRODUCT CATEGORIES */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-surface-800 pb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Product Catalogue Categories & Tiers</h2>
            <p className="text-xs text-surface-400">
              High-value equipment lines receive Tier 1 scoring boosts to automatically elevate lead temperature.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {PRODUCT_CATEGORIES.map((cat) => {
            const tierNum = CATEGORY_TIERS[cat] || 4;
            const tierColor =
              tierNum === 1
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : tierNum === 2
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-surface-800 text-surface-400 border-surface-700';

            return (
              <div
                key={cat}
                className="p-3 bg-surface-950 border border-surface-800 rounded-lg flex items-center justify-between gap-2 hover:border-surface-700 transition-colors"
              >
                <span className="text-xs font-semibold text-surface-200 truncate">{cat}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${tierColor}`}>
                  Tier {tierNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. INTEGRATIONS */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-surface-800 pb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Third-Party API Integrations</h2>
            <p className="text-xs text-surface-400">
              Connect external e-commerce, advertising, communication, and AI platforms to the CRM engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS_LIST.map((item) => {
            const IconComponent = item.icon;
            const isShopify = item.id === 'shopify';
            const isGemini = item.id === 'gemini';
            return (
              <div
                key={item.id}
                className="p-5 bg-surface-950 border border-surface-800 rounded-xl flex flex-col justify-between space-y-4 hover:border-surface-750 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      {isShopify ? (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Active — Webhook Live
                        </span>
                      ) : isGemini ? (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          Active — Gemini 1.5 Flash Live
                        </span>
                      ) : (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-850 text-surface-400 border border-surface-800">
                          Not Connected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-surface-400 leading-relaxed">
                  {item.description}
                </p>

                {isShopify ? (
                  <div className="pt-2 border-t border-surface-850 space-y-2">
                    <p className="text-[10px] text-surface-500 font-mono break-all">
                      Webhook URL: https://your-domain.vercel.app/api/shopifyWebhook
                    </p>
                    <p className="text-[10px] text-surface-500 font-mono break-all">
                      Topics: customers/create · draft_orders/create · orders/create
                    </p>
                  </div>
                ) : isGemini ? (
                  <div className="pt-2 border-t border-surface-850 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      Free Tier Enabled
                    </span>
                    <span className="text-[10px] text-surface-400 font-medium font-mono">
                      model: gemini-1.5-flash
                    </span>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-surface-850 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded">
                      Coming Soon
                    </span>
                    <button
                      type="button"
                      disabled
                      className="px-4 py-1.5 rounded-lg bg-surface-800 text-surface-500 text-xs font-semibold cursor-not-allowed border border-surface-750"
                    >
                      Connect
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. TEAM PLACEHOLDER */}
      <div className="bg-surface-900 border border-surface-800 rounded-xl p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mx-auto mb-3">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Team & Role Management Coming Soon</h3>
        <p className="text-xs text-surface-400 max-w-md mx-auto mt-1 leading-relaxed">
          Admin tools to invite sales representatives, assign regional territories, set commission tiers, and manage RBAC permissions will be released in Antigravity 2.0.
        </p>
      </div>
    </div>
  );
}
