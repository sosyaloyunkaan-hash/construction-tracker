'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface UpdateRecord {
  id: number;
  engineer_name: string;
  initials: string;
  avatar_color: string;
  building_name: string;
  floor_name: string;
  room_name: string;
  discipline_name: string;
  activity_name: string;
  status: 'notstarted' | 'ongoing' | 'completed' | 'hold';
  progress: number;
  remarks: string;
  created_at: string;
}

const STATUS_CONFIG = {
  notstarted: { label: 'Not Started', bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' },
  ongoing:    { label: 'Ongoing',     bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  completed:  { label: 'Completed',   bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
  hold:       { label: 'On Hold',     bg: 'bg-blue-100',  text: 'text-blue-700',  bar: 'bg-blue-500' },
};

const DISC_COLORS: Record<string, string> = {
  'MEP':            'bg-blue-100 text-blue-700',
  'Finishing':      'bg-purple-100 text-purple-700',
  'Civil':          'bg-amber-100 text-amber-700',
  'External Works': 'bg-green-100 text-green-700',
};

function formatDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  refreshTrigger: number;
}

export default function UpdateLog({ refreshTrigger }: Props) {
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      setUpdates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates, refreshTrigger]);

  const disciplines = useMemo(() => Array.from(new Set(updates.map(u => u.discipline_name))), [updates]);

  const filtered = updates.filter(u => {
    const q = filter.toLowerCase();
    const matchText = !q || [
      u.engineer_name, u.building_name, u.floor_name,
      u.room_name, u.activity_name, u.remarks
    ].some(s => s?.toLowerCase().includes(q));
    const matchDisc = !disciplineFilter || u.discipline_name === disciplineFilter;
    return matchText && matchDisc;
  });

  return (
    <div className="max-w-lg mx-auto">
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <select
          value={disciplineFilter}
          onChange={e => setDisciplineFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none"
        >
          <option value="">All disciplines</option>
          {disciplines.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">{filter || disciplineFilter ? 'No results found' : 'No updates yet'}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(u => {
          const cfg = STATUS_CONFIG[u.status];
          return (
            <div key={u.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: u.avatar_color }}>
                  {u.initials}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{u.engineer_name}</span>
                    <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                  </div>

                  {/* Discipline + location */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DISC_COLORS[u.discipline_name] || 'bg-slate-100 text-slate-600'}`}>
                      {u.discipline_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {u.building_name} · {u.floor_name} · {u.room_name}
                    </span>
                  </div>

                  {/* Activity */}
                  <p className="text-sm text-slate-700 mt-1 font-medium">{u.activity_name}</p>

                  {/* Progress bar + status */}
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${u.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8 text-right">{u.progress}%</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Remarks */}
                  {u.remarks && (
                    <p className="text-xs text-slate-500 mt-1.5 italic">&ldquo;{u.remarks}&rdquo;</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-4">
          Showing {filtered.length} update{filtered.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
