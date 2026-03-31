'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UpdateForm from './UpdateForm';
import UpdateLog from './UpdateLog';
import OverviewDashboard from './OverviewDashboard';

interface Engineer {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
  disciplines: { id: number; name: string }[];
}

interface Props {
  user: { id: number; name: string; initials: string; avatar_color: string };
}

export default function Dashboard({ user }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'update' | 'log' | 'overview'>('update');
  const [engineer, setEngineer] = useState<Engineer | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (data.error) { router.push('/login'); return; }
      setEngineer(data);
    });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  function handleUpdateSubmitted() {
    setRefreshKey(k => k + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Site Progress</h1>
              <p className="text-xs text-slate-400 leading-tight">Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: user.avatar_color }}>
                {user.initials}
              </div>
              <span className="text-sm font-medium hidden sm:block">{user.name.split(' ')[0]}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-lg mx-auto px-4 flex border-t border-slate-800">
          <button
            onClick={() => setActiveTab('update')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'update' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Update
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'log' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Log
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Overview
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-5">
        {!engineer ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'update' ? (
          <UpdateForm engineer={engineer} onUpdateSubmitted={handleUpdateSubmitted} />
        ) : activeTab === 'log' ? (
          <UpdateLog refreshTrigger={refreshKey} />
        ) : (
          <OverviewDashboard refreshTrigger={refreshKey} />
        )}
      </main>
    </div>
  );
}
