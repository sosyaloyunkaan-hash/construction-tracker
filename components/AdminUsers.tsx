'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const COLOR_PRESETS = [
  '#0EA5E9',
  '#EC4899',
  '#F97316',
  '#8B5CF6',
  '#22C55E',
  '#EF4444',
  '#F59E0B',
  '#14B8A6',
];

const DISCIPLINE_STYLES: Record<string, string> = {
  MEP: 'bg-blue-100 text-blue-700',
  Finishing: 'bg-purple-100 text-purple-700',
  Civil: 'bg-amber-100 text-amber-700',
  'External Works': 'bg-green-100 text-green-700',
};

interface Discipline {
  id: number;
  name: string;
}

interface Engineer {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
  disciplines: Discipline[];
}

interface Props {
  initialEngineers: Engineer[];
  allDisciplines: Discipline[];
}

function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const EMPTY_FORM = {
  name: '',
  password: '',
  initials: '',
  avatar_color: COLOR_PRESETS[0],
  discipline_ids: [] as number[],
};

export default function AdminUsers({ initialEngineers, allDisciplines }: Props) {
  const router = useRouter();
  const [engineers, setEngineers] = useState<Engineer[]>(initialEngineers);
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  async function refreshEngineers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setEngineers(data);
    }
  }

  function handleAddNameChange(name: string) {
    setAddForm(prev => ({
      ...prev,
      name,
      initials: getInitialsFromName(name),
    }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setAddForm({ ...EMPTY_FORM });
        await refreshEngineers();
      } else {
        const data = await res.json();
        setAddError(data.error || 'Failed to create engineer');
      }
    } catch {
      setAddError('Network error. Please try again.');
    } finally {
      setAddLoading(false);
    }
  }

  function openEdit(eng: Engineer) {
    setEditingId(eng.id);
    setEditForm({
      name: eng.name,
      password: '',
      initials: eng.initials,
      avatar_color: eng.avatar_color,
      discipline_ids: eng.disciplines.map(d => d.id),
    });
    setEditError('');
  }

  function handleEditNameChange(name: string) {
    setEditForm(prev => ({
      ...prev,
      name,
      initials: getInitialsFromName(name),
    }));
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setEditError('');
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        await refreshEngineers();
      } else {
        const data = await res.json();
        setEditError(data.error || 'Failed to update engineer');
      }
    } catch {
      setEditError('Network error. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeletingId(null);
        await refreshEngineers();
      }
    } catch {
      // silently fail, user can retry
    }
  }

  function toggleDiscipline(disciplineId: number, form: typeof EMPTY_FORM, setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>) {
    setForm(prev => ({
      ...prev,
      discipline_ids: prev.discipline_ids.includes(disciplineId)
        ? prev.discipline_ids.filter(id => id !== disciplineId)
        : [...prev.discipline_ids, disciplineId],
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Admin nav tabs */}
        <div className="max-w-4xl mx-auto flex gap-1 mt-3">
          <Link href="/admin/users"
            className="px-4 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg">
            Users
          </Link>
          <Link href="/admin/stats"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            Stats
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Add Engineer Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-5">Add New Engineer</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={e => handleAddNameChange(e.target.value)}
                  required
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    value={addForm.password}
                    onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    placeholder="Set password"
                    className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button type="button" onClick={() => setShowAddPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showAddPassword
                      ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Initials</label>
                <input
                  type="text"
                  value={addForm.initials}
                  onChange={e => setAddForm(prev => ({ ...prev, initials: e.target.value.toUpperCase().slice(0, 2) }))}
                  required
                  maxLength={2}
                  placeholder="e.g. AA"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Avatar Color</label>
                <div className="flex gap-2 flex-wrap pt-0.5">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAddForm(prev => ({ ...prev, avatar_color: color }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: color,
                        borderColor: addForm.avatar_color === color ? '#1e293b' : 'transparent',
                        transform: addForm.avatar_color === color ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Disciplines</label>
              <div className="flex flex-wrap gap-3">
                {allDisciplines.map(disc => (
                  <label key={disc.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addForm.discipline_ids.includes(disc.id)}
                      onChange={() => toggleDiscipline(disc.id, addForm, setAddForm as React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>)}
                      className="w-4 h-4 rounded accent-slate-700"
                    />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DISCIPLINE_STYLES[disc.name] || 'bg-slate-100 text-slate-600'}`}>
                      {disc.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {addError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                {addError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addLoading}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addLoading ? 'Adding…' : 'Add Engineer'}
              </button>
            </div>
          </form>
        </div>

        {/* Engineers List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">
              Engineers
              <span className="ml-2 text-sm font-normal text-slate-400">({engineers.length})</span>
            </h2>
          </div>

          {engineers.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">
              No engineers yet. Add one above.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {engineers.map(eng => (
                <li key={eng.id}>
                  {/* Normal row */}
                  {editingId !== eng.id && (
                    <div className="px-6 py-4 flex items-center gap-4">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: eng.avatar_color }}
                      >
                        {eng.initials}
                      </div>

                      {/* Name + disciplines */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{eng.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {eng.disciplines.length === 0 ? (
                            <span className="text-xs text-slate-400">No disciplines</span>
                          ) : (
                            eng.disciplines.map(d => (
                              <span
                                key={d.id}
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${DISCIPLINE_STYLES[d.name] || 'bg-slate-100 text-slate-600'}`}
                              >
                                {d.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openEdit(eng)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingId(eng.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit inline form */}
                  {editingId === eng.id && (
                    <div className="px-6 py-5 bg-slate-50">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">Editing: {eng.name}</h3>
                      <form onSubmit={handleEdit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => handleEditNameChange(e.target.value)}
                              required
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                            <div className="relative">
                              <input
                                type={showEditPassword ? 'text' : 'password'}
                                value={editForm.password}
                                onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="Leave blank to keep current password"
                                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-xl text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                              />
                              <button type="button" onClick={() => setShowEditPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showEditPassword
                                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                }
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Initials</label>
                            <input
                              type="text"
                              value={editForm.initials}
                              onChange={e => setEditForm(prev => ({ ...prev, initials: e.target.value.toUpperCase().slice(0, 2) }))}
                              required
                              maxLength={2}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Avatar Color</label>
                            <div className="flex gap-2 flex-wrap pt-0.5">
                              {COLOR_PRESETS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setEditForm(prev => ({ ...prev, avatar_color: color }))}
                                  className="w-7 h-7 rounded-full border-2 transition-all"
                                  style={{
                                    backgroundColor: color,
                                    borderColor: editForm.avatar_color === color ? '#1e293b' : 'transparent',
                                    transform: editForm.avatar_color === color ? 'scale(1.2)' : 'scale(1)',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-2">Disciplines</label>
                          <div className="flex flex-wrap gap-3">
                            {allDisciplines.map(disc => (
                              <label key={disc.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editForm.discipline_ids.includes(disc.id)}
                                  onChange={() => toggleDiscipline(disc.id, editForm, setEditForm as React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>)}
                                  className="w-4 h-4 rounded accent-slate-700"
                                />
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DISCIPLINE_STYLES[disc.name] || 'bg-slate-100 text-slate-600'}`}>
                                  {disc.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {editError && (
                          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                            {editError}
                          </div>
                        )}

                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editLoading}
                            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {editLoading ? 'Saving…' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deletingId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete Engineer</h3>
                <p className="text-sm text-slate-500">
                  Delete <span className="font-medium">{engineers.find(e => e.id === deletingId)?.name}</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
