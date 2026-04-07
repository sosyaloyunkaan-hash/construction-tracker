'use client';

import { useEffect, useState, useRef } from 'react';

interface Comment {
  id: number;
  message: string;
  created_at: string;
  engineer_name: string;
  initials: string;
  avatar_color: string;
}

interface Props {
  buildingId: number;
  floorId: number;
  roomId: number;
  activityId: number;
  currentUser: { name: string; initials: string; avatar_color: string };
}

function formatTime(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function CommentsThread({ buildingId, floorId, roomId, activityId, currentUser }: Props) {
  const [comments, setComments]   = useState<Comment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const [open, setOpen]           = useState(true);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  async function fetchComments() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/comments?buildingId=${buildingId}&floorId=${floorId}&roomId=${roomId}&activityId=${activityId}`
      );
      if (res.ok) setComments(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) fetchComments();
  }, [open, buildingId, floorId, roomId, activityId]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, floorId, roomId, activityId, message }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, newComment]);
        setMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Comments
            {comments.length > 0 && (
              <span className="ml-2 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {comments.length}
              </span>
            )}
          </span>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          {/* Comments list */}
          <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4 italic">
                No comments yet. Be the first to add one.
              </p>
            ) : (
              comments.map(c => {
                const isMe = c.engineer_name === currentUser.name;
                return (
                  <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: c.avatar_color }}
                    >
                      {c.initials}
                    </div>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {isMe ? 'You' : c.engineer_name.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatTime(c.created_at)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-xs text-slate-700 dark:text-slate-100 leading-relaxed ${
                        isMe
                          ? 'bg-amber-500 text-white dark:bg-amber-600 rounded-tr-sm'
                          : 'bg-slate-100 dark:bg-slate-700 rounded-tl-sm'
                      }`}>
                        {c.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
