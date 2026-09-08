'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  id: number;
  code: string;
  name: string;
  buildings: number;
  rooms: number;
}

interface Props {
  user: { name: string; initials: string; avatar_color: string };
  projects: Project[];
}

export default function ProjectSelect({ user, projects }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function pick(id: number) {
    setError('');
    setBusyId(id);
    try {
      const res = await fetch('/api/projects/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not select project');
      }
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-slate-900 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.initials}
            </div>
            <span>{user.name.split(' ')[0]}</span>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-white text-xs transition-colors">
            Sign out
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 mb-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Select a project</h1>
          <p className="text-slate-400 text-sm mt-1">Choose which site you are working on</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2.5 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              disabled={busyId !== null}
              className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-4 flex items-center gap-4 hover:ring-2 hover:ring-amber-500 transition-all disabled:opacity-60"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {p.code.split(' ')[1] || p.code.slice(0, 3)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {p.code} — {p.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {p.buildings > 0
                    ? `${p.buildings} building${p.buildings === 1 ? '' : 's'} · ${p.rooms} rooms`
                    : 'No data yet'}
                </div>
              </div>
              {busyId === p.id ? (
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Need a new project? Ask an admin to create it in the admin panel.
        </p>
      </div>
    </div>
  );
}
