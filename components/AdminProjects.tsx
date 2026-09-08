'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: number;
  code: string;
  name: string;
  buildings: number;
  floors: number;
  rooms: number;
  updates: number;
}

interface Props {
  initialProjects: Project[];
}

export default function AdminProjects({ initialProjects }: Props) {
  const router = useRouter();
  const [projects] = useState<Project[]>(initialProjects);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [importing, setImporting] = useState<number | null>(null);
  const [importMsg, setImportMsg] = useState<Record<number, string>>({});
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create project');
      setCode('');
      setName('');
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAddLoading(false);
    }
  }

  async function uploadCsv(projectId: number, file: File) {
    setImportMsg(m => ({ ...m, [projectId]: '' }));
    setImporting(projectId);
    try {
      const text = await file.text();
      const res = await fetch(`/api/admin/projects/${projectId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportMsg(m => ({
        ...m,
        [projectId]: `Added ${data.buildingsAdded} buildings, ${data.floorsAdded} floors, ${data.roomsAdded} rooms.`,
      }));
      router.refresh();
    } catch (err) {
      setImportMsg(m => ({
        ...m,
        [projectId]: err instanceof Error ? err.message : 'Import failed',
      }));
    } finally {
      setImporting(null);
      const input = fileInputs.current[projectId];
      if (input) input.value = '';
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-lg font-bold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-300 hover:text-white text-sm transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to app
            </Link>
            <button
              onClick={handleLogout}
              className="text-slate-300 hover:text-white text-sm transition-colors flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto flex gap-1 mt-3">
          <Link href="/admin/users"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            Users
          </Link>
          <Link href="/admin/projects"
            className="px-4 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg">
            Projects
          </Link>
          <Link href="/admin/stats"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            Stats
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* New project */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4">New project</h2>
          <form onSubmit={createProject} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[8rem]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                placeholder="DMS 444"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-[2] min-w-[12rem]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Marina Towers"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={addLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {addLoading ? 'Adding…' : 'Add project'}
            </button>
          </form>
          {addError && <p className="text-red-600 text-xs mt-2">{addError}</p>}
        </section>

        {/* Existing projects */}
        <section className="space-y-4">
          {projects.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800">{p.code} — {p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {p.buildings} buildings · {p.floors} floors · {p.rooms} rooms · {p.updates} updates
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Import structure — CSV with <code className="bg-slate-100 px-1 rounded">Building,Floor,Room</code> columns
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={el => { fileInputs.current[p.id] = el; }}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    disabled={importing !== null}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) uploadCsv(p.id, f);
                    }}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700 file:cursor-pointer"
                  />
                  {importing === p.id && (
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Importing…
                    </span>
                  )}
                </div>
                {importMsg[p.id] && (
                  <p className={`text-xs mt-2 ${importMsg[p.id].startsWith('Added') ? 'text-green-700' : 'text-red-600'}`}>
                    {importMsg[p.id]}
                  </p>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
