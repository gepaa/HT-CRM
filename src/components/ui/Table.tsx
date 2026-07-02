import React from 'react';
import { ChevronUp, ChevronDown, Inbox } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

export interface Column<T> {
  key: string;
  title: string | React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T, index: number) => string;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  className?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There is currently no data matching this view.',
  onRowClick,
  rowClassName,
  sortKey,
  sortOrder,
  onSort,
  className = '',
}: TableProps<T>) {
  return (
    <div
      className={`bg-surface-900/90 backdrop-blur-md border border-surface-800/80 rounded-2xl overflow-hidden shadow-xl ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-950/80 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase tracking-wider">
              {columns.map((col) => {
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';
                return (
                  <th
                    key={col.key}
                    onClick={() => {
                      if (col.sortable && onSort) onSort(col.key);
                    }}
                    className={`py-3.5 px-4 ${alignClass} ${
                      col.sortable && onSort
                        ? 'cursor-pointer hover:text-white transition-colors select-none'
                        : ''
                    } ${col.className || ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end w-full' : ''
                      }`}
                    >
                      <span>{col.title}</span>
                      {col.sortable && sortKey === col.key && (
                        <span className="text-brand-400">
                          {sortOrder === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800/60 text-sm">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Spinner size="md" className="text-brand-500" />
                    <span className="text-xs font-medium text-surface-400">
                      Loading table data...
                    </span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-6">
                  <EmptyState
                    icon={Inbox}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const customRowClass = rowClassName ? rowClassName(item, index) : '';
                return (
                  <tr
                    key={(item.id as string) || index}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={`hover:bg-surface-800/50 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${customRowClass}`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                      const cellContent = col.render
                        ? col.render(item, index)
                        : item[col.key];
                      return (
                        <td key={col.key} className={`py-3.5 px-4 ${alignClass}`}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
