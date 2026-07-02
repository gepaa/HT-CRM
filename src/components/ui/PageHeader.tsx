import React from 'react';

export interface PageHeaderProps {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  icon: Icon,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-800/80 ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3">
        {Icon && (
          <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0 shadow-inner">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <p className="text-sm text-surface-400 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
