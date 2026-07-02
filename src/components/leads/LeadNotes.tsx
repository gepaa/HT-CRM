import React, { useState } from 'react';
import { MessageSquare, Send, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../lib/formatters';
import type { Note } from '../../types/note';

export interface LeadNotesProps {
  notes: Note[] | any[];
  onAddNote: (content: string) => Promise<void> | void;
  className?: string;
}

export const LeadNotes: React.FC<LeadNotesProps> = ({ notes = [], onAddNote, className = '' }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onAddNote(content.trim());
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Add Note Form */}
      <form onSubmit={handleSubmit} className="bg-surface-900 p-4 rounded-xl border border-surface-800 space-y-3">
        <label htmlFor="note-content" className="block text-xs font-semibold text-surface-300 uppercase tracking-wider">
          Add a Note
        </label>
        <textarea
          id="note-content"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type internal notes, customer preferences, or call details..."
          className="w-full bg-surface-800 border border-surface-700 rounded-lg p-3 text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors resize-y min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!content.trim() || submitting}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post Note</span>
          </Button>
        </div>
      </form>

      {/* Notes List */}
      <div className="space-y-3">
        {!notes || notes.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-dashed border-surface-800 bg-surface-900/30">
            <MessageSquare className="w-8 h-8 text-surface-500 mx-auto mb-2 opacity-60" />
            <p className="text-sm text-surface-400">No notes added to this lead yet.</p>
          </div>
        ) : (
          notes.map((note, idx) => (
            <div
              key={note.id || idx}
              className="bg-surface-900/80 p-4 rounded-xl border border-surface-800 space-y-2 hover:border-surface-700 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-surface-400 pb-2 border-b border-surface-800/60">
                <div className="flex items-center gap-1.5 font-medium text-surface-300">
                  <div className="w-5 h-5 rounded-full bg-surface-800 flex items-center justify-center text-brand-400">
                    <User className="w-3 h-3" />
                  </div>
                  <span>{note.createdBy || 'Staff Member'}</span>
                </div>
                <time
                  dateTime={
                    note.createdAt instanceof Date
                      ? note.createdAt.toISOString()
                      : String(note.createdAt)
                  }
                >
                  {formatRelativeTime(note.createdAt || new Date())}
                </time>
              </div>
              <p className="text-sm text-surface-100 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LeadNotes;
