import React, { forwardRef } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-surface-900 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
      secondary: 'bg-surface-800 hover:bg-surface-700 text-surface-200 border border-surface-700 shadow-sm',
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
      ghost: 'hover:bg-surface-800 text-surface-200',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
      md: 'px-4 py-2 text-sm rounded-lg gap-2',
      lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" className="shrink-0 text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
