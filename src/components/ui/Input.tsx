import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ElementType;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const baseStyles =
      'w-full bg-surface-800 border rounded-lg px-3 py-2 text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    
    const borderStyles = error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-surface-700 focus:ring-brand-500 focus:border-brand-500';

    const iconPadding = Icon ? 'pl-10' : '';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-surface-200 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-surface-400">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseStyles} ${borderStyles} ${iconPadding} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
