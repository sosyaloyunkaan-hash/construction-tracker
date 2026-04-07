'use client';

import { useEffect, useState } from 'react';

interface DailyCount { date: string; count: number }
interface EngineerStat {
  engineer_id: number;
  name: string;
  initials: string;
  avatar_color: string;
  daily_counts: DailyCount[];
  total_14d: number;
  today: number;
}
interface StatsData {
  dates: string[];
  engineers: EngineerStat[];
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function isToday(iso: string) {
  return iso === new Date().toISOString().slice(0, 10);
}

export default function AdminStats() {
  const [data, setData]     = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return null;

  const { dates, engineers } = data;
  // Show last 7 dates for the table (more readable)
  const displayDates = dates.slice(-7);

  const maxCount = Math.max(...engineers.flatMap(e => e.daily_counts.map(d => d.count)), 1);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {engineers.map(eng => (
          <div key={eng.engineer_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: eng.avatar_color }}
              >
                {eng.initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{eng.name.split(' ')[0]}</p>
                <p className="text-xs text-slate-400 truncate">{eng.name.split(' ').slice(1).join(' ') || eng.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-amber-50 rounded-xl p-2">
                <p className="text-lg font-black text-amber-600">{eng.today}</p>
                <p className="text-[10px] text-amber-500 font-medium">Today</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2">
                <p className="text-lg font-black text-slate-600">{eng.total_14d}</p>
                <p className="text-[10px] text-slate-400 font-medium">14 days</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily activity bar chart table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Daily Updates — Last 7 Days</h3>
          <p className="text-xs text-slate-400 mt-0.5">Number of update submissions per engineer per day</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 w-32">Engineer</th>
                {displayDates.map(date => (
                  <th key={date} className={`text-center px-2 py-3 text-xs font-semibold min-w-[60px] ${
                    isToday(date) ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {formatDate(date)}
                    {isToday(date) && <span className="block text-[9px] text-amber-500">Today</span>}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {engineers.map(eng => {
                const displayCounts = eng.daily_counts.slice(-7);
                const weekTotal = displayCounts.reduce((s, d) => s + d.count, 0);
                return (
                  <tr key={eng.engineer_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: eng.avatar_color }}
                        >
                          {eng.initials}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate">{eng.name.split(' ')[0]}</span>
                      </div>
                    </td>
                    {displayCounts.map(({ date, count }) => (
                      <td key={date} className="px-2 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {/* Mini bar */}
                          <div className="w-8 h-10 bg-slate-100 rounded-md flex items-end overflow-hidden">
                            <div
                              className="w-full rounded-md transition-all"
                              style={{
                                height: `${count > 0 ? Math.max(20, (count / maxCount) * 100) : 0}%`,
                                backgroundColor: count > 0
                                  ? (isToday(date) ? '#f59e0b' : eng.avatar_color)
                                  : 'transparent',
                              }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${
                            count === 0 ? 'text-slate-300' : isToday(date) ? 'text-amber-600' : 'text-slate-600'
                          }`}>
                            {count > 0 ? count : '—'}
                          </span>
                        </div>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-black ${weekTotal > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                        {weekTotal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
