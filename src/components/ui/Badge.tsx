import React from 'react';

export type BadgeVariant =
  | 'hot'
  | 'warm'
  | 'cold'
  | 'qualified'
  | 'bad_fit'
  | 'bad-fit'
  | 'success'
  | 'danger'
  | 'warning'
  | 'urgent'
  | 'info'
  | 'default';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant | string;
  size?: BadgeSize;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  pulse = false,
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full transition-all select-none whitespace-nowrap tracking-wide';

  const variants: Record<string, string> = {
    hot: 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10',
    warm: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10',
    cold: 'bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10',
    qualified: 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-sm shadow-purple-500/10',
    bad_fit: 'bg-surface-800 text-surface-400 border border-surface-700',
    'bad-fit': 'bg-surface-800 text-surface-400 border border-surface-700',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10',
    danger: 'bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10',
    urgent: 'bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-sm shadow-orange-500/20',
    info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    default: 'bg-surface-800 text-surface-300 border border-surface-700/80',
  };

  const sizes: Record<BadgeSize, string> = {
    sm: 'px-2.5 py-0.5 text-[11px] gap-1',
    md: 'px-3 py-1 text-xs gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm gap-2',
  };

  const variantClass = variants[variant] || variants.default;
  const isPulsing = pulse || variant === 'hot' || variant === 'urgent';

  return (
    <span
      className={`${baseStyles} ${variantClass} ${sizes[size]} ${className}`}
      {...props}
    >
      {isPulsing && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
      )}
      {children}
    </span>
  );
};

export default Badge;
