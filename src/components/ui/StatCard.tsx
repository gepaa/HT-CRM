import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: {
    value: string;
    isUp: boolean;
  };
  color?: 'brand' | 'success' | 'danger' | 'warning' | 'purple' | 'default';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'brand',
  onClick,
  className = '',
}) => {
  const colorStyles: Record<string, { iconBg: string; borderHover: string; glow: string }> = {
    brand: {
      iconBg: 'bg-brand-500/15 text-brand-400 border border-brand-500/30',
      borderHover: 'hover:border-brand-500/50',
      glow: 'shadow-brand-500/5 hover:shadow-brand-500/10',
    },
    success: {
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      borderHover: 'hover:border-emerald-500/50',
      glow: 'shadow-emerald-500/5 hover:shadow-emerald-500/10',
    },
    danger: {
      iconBg: 'bg-red-500/15 text-red-400 border border-red-500/30',
      borderHover: 'hover:border-red-500/50',
      glow: 'shadow-red-500/5 hover:shadow-red-500/10',
    },
    warning: {
      iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      borderHover: 'hover:border-amber-500/50',
      glow: 'shadow-amber-500/5 hover:shadow-amber-500/10',
    },
    purple: {
      iconBg: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
      borderHover: 'hover:border-purple-500/50',
      glow: 'shadow-purple-500/5 hover:shadow-purple-500/10',
    },
    default: {
      iconBg: 'bg-surface-800 text-surface-400 border border-surface-700',
      borderHover: 'hover:border-surface-600',
      glow: 'shadow-surface-900/10',
    },
  };

  const currentTheme = colorStyles[color] || colorStyles.default;

  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 transition-all duration-200 shadow-lg ${currentTheme.glow} ${currentTheme.borderHover} ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-surface-400 font-medium">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${currentTheme.iconBg} shrink-0`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-surface-800/80 flex items-center gap-1.5 text-xs font-semibold">
          {trend.isUp ? (
            <span className="inline-flex items-center gap-0.5 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-red-400">
              <TrendingDown className="w-3.5 h-3.5" />
              {trend.value}
            </span>
          )}
          <span className="text-surface-500 font-normal">vs. previous period</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
