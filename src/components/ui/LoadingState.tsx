import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  variant?: 'page' | 'card' | 'table' | 'inline';
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  variant = 'card',
  rows = 3,
  className = '',
}) => {
  if (variant === 'page') {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[60vh] text-center p-8 ${className}`}>
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
          <div className="absolute inset-0 rounded-full bg-brand-500/10 blur-xl animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-surface-200">{message}</p>
        <p className="text-xs text-surface-400 mt-1">Syncing War Room telemetry...</p>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-3 p-4 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl bg-surface-900/60 border border-surface-800/60 animate-pulse"
          >
            <div className="flex items-center gap-3 w-1/3">
              <div className="w-8 h-8 rounded-full bg-surface-800 shrink-0" />
              <div className="space-y-1.5 w-full">
                <div className="h-4 bg-surface-800 rounded w-3/4" />
                <div className="h-3 bg-surface-800/60 rounded w-1/2" />
              </div>
            </div>
            <div className="h-4 bg-surface-800 rounded w-1/5" />
            <div className="h-6 bg-surface-800 rounded-full w-16" />
            <div className="h-4 bg-surface-800 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`inline-flex items-center gap-2 text-xs text-surface-400 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  // default card
  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] text-center p-8 bg-surface-900/40 border border-dashed border-surface-800 rounded-2xl ${className}`}>
      <Loader2 className="w-7 h-7 text-brand-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-surface-300">{message}</p>
    </div>
  );
};

export default LoadingState;
