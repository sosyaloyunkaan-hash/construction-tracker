'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface CommentRow {
  id: number;
  message: string;
  created_at: string;
  engineer_name: string;
  initials: string;
  avatar_color: string;
  building_name: string;
  floor_name: string;
  room_name: string;
  activity_name: string;
  discipline_name: string;
  building_id: number;
  floor_id: number;
  room_id: number;
  activity_id: number;
}

interface ThreadKey {
  building_id: number;
  floor_id: number;
  room_id: number;
  activity_id: number;
  building_name: string;
  floor_name: string;
  room_name: string;
  activity_name: string;
  discipline_name: string;
}

interface Thread extends ThreadKey {
  key: string;
  comments: CommentRow[];
  latest: string;
}

const DISC_COLORS: Record<string, string> = {
  'MEP':            'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'Finishing':      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'Civil':          'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'External Works': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function formatTime(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

interface Props {
  currentUser: { name: string; initials: string; avatar_color: string };
}

export default function DiscussionView({ currentUser }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText]   = useState<Record<string, string>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments/all?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setComments(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Group comments into threads by room+activity
  const threads = useMemo<Thread[]>(() => {
    const map: Record<string, Thread> = {};
    for (const c of comments) {
      const key = `${c.building_id}-${c.floor_id}-${c.room_id}-${c.activity_id}`;
      if (!map[key]) {
        map[key] = {
          key,
          building_id: c.building_id,
          floor_id: c.floor_id,
          room_id: c.room_id,
          activity_id: c.activity_id,
          building_name: c.building_name,
          floor_name: c.floor_name,
          room_name: c.room_name,
          activity_name: c.activity_name,
          discipline_name: c.discipline_name,
          latest: c.created_at,
          comments: [],
        };
      }
      map[key].comments.push(c);
      if (c.created_at > map[key].latest) map[key].latest = c.created_at;
    }
    // Sort threads by latest comment desc; comments inside each thread asc
    return Object.values(map)
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .map(t => ({ ...t, comments: [...t.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  }, [comments]);

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.room_name.toLowerCase().includes(q) ||
      t.activity_name.toLowerCase().includes(q) ||
      t.building_name.toLowerCase().includes(q) ||
      t.floor_name.toLowerCase().includes(q) ||
      t.discipline_name.toLowerCase().includes(q) ||
      t.comments.some(c => c.message.toLowerCase().includes(q) || c.engineer_name.toLowerCase().includes(q))
    );
  }, [threads, search]);

  async function handleReply(thread: Thread) {
    const key = thread.key;
    const msg = replyText[key]?.trim();
    if (!msg) return;
    setSendingKey(key);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId: thread.building_id,
          floorId: thread.floor_id,
          roomId: thread.room_id,
          activityId: thread.activity_id,
          message: msg,
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, {
          ...newComment,
          building_name: thread.building_name,
          floor_name: thread.floor_name,
          room_name: thread.room_name,
          activity_name: thread.activity_name,
          discipline_name: thread.discipline_name,
          building_id: thread.building_id,
          floor_id: thread.floor_id,
          room_id: thread.room_id,
          activity_id: thread.activity_id,
        }]);
        setReplyText(prev => ({ ...prev, [key]: '' }));
      }
    } finally {
      setSendingKey(null);
    }
  }

  const totalComments = comments.length;

  return (
    <div className="max-w-lg mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} thread{filtered.length !== 1 ? 's' : ''}
            {totalComments > 0 && ` · ${totalComments} comment${totalComments !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search rooms, activities, comments…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-3 py-2.5 mb-4 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
      />

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">{search ? 'No matching discussions' : 'No comments yet'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(thread => {
          const isOpen = expanded[thread.key];
          const lastComment = thread.comments[thread.comments.length - 1];
          return (
            <div key={thread.key} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">

              {/* Thread header — always visible */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [thread.key]: !p[thread.key] }))}
                className="w-full px-4 py-3.5 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {/* Location */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${DISC_COLORS[thread.discipline_name] || 'bg-slate-100 text-slate-600'}`}>
                      {thread.discipline_name}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {thread.building_name} · {thread.floor_name}
                    </span>
                  </div>

                  {/* Room + Activity */}
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                    {thread.room_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{thread.activity_name}</p>

                  {/* Preview of latest comment */}
                  {!isOpen && lastComment && (
                    <div className="flex items-center gap-2 mt-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ backgroundColor: lastComment.avatar_color }}
                      >
                        {lastComment.initials}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic">
                        &ldquo;{lastComment.message}&rdquo;
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                        {formatTime(lastComment.created_at)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <span className="bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                    {thread.comments.length}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded: full thread + reply box */}
              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {/* Comments */}
                  <div className="px-4 py-3 space-y-3 max-h-72 overflow-y-auto">
                    {thread.comments.map(c => {
                      const isMe = c.engineer_name === currentUser.name;
                      return (
                        <div key={c.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: c.avatar_color }}
                          >
                            {c.initials}
                          </div>
                          <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {isMe ? 'You' : c.engineer_name.split(' ')[0]}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {formatTime(c.created_at)}
                              </span>
                            </div>
                            <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                              isMe
                                ? 'bg-amber-500 text-white rounded-tr-sm'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 rounded-tl-sm'
                            }`}>
                              {c.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply input */}
                  <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 flex gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: currentUser.avatar_color }}
                    >
                      {currentUser.initials}
                    </div>
                    <input
                      type="text"
                      value={replyText[thread.key] ?? ''}
                      onChange={e => setReplyText(p => ({ ...p, [thread.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(thread); }}}
                      placeholder="Reply…"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleReply(thread)}
                      disabled={sendingKey === thread.key || !replyText[thread.key]?.trim()}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
