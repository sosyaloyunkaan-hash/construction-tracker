'use client';

import { useState, useEffect } from 'react';

interface Engineer {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
  disciplines: { id: number; name: string }[];
}
interface Item { id: number; name: string }
interface Discipline extends Item { authorized: number }

const STATUS_CONFIG = {
  notstarted: { label: 'Not Started', bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', bar: 'bg-slate-400' },
  ongoing:    { label: 'Ongoing',     bg: 'bg-amber-100 dark:bg-amber-900',  text: 'text-amber-700 dark:text-amber-300',  bar: 'bg-amber-500' },
  completed:  { label: 'Completed',   bg: 'bg-green-100 dark:bg-green-900',  text: 'text-green-700 dark:text-green-300',  bar: 'bg-green-500' },
  hold:       { label: 'On Hold',     bg: 'bg-blue-100 dark:bg-blue-900',    text: 'text-blue-700 dark:text-blue-300',    bar: 'bg-blue-500' },
};

const DISC_COLORS: Record<string, string> = {
  'MEP':            'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'Finishing':      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  'Civil':          'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'External Works': 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

function computeStatus(progress: number, isHold: boolean) {
  if (progress === 100) return 'completed' as const;
  if (isHold) return 'hold' as const;
  if (progress === 0) return 'notstarted' as const;
  return 'ongoing' as const;
}

const STEPS = ['Building', 'Floor', 'Discipline', 'Activity', 'Rooms', 'Update'];

interface Props {
  engineer: Engineer;
  onUpdateSubmitted: () => void;
}

export default function BulkUpdateForm({ engineer, onUpdateSubmitted }: Props) {
  const [step, setStep] = useState(1);

  const [buildings, setBuildings]     = useState<Item[]>([]);
  const [floors, setFloors]           = useState<Item[]>([]);
  const [rooms, setRooms]             = useState<Item[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [activities, setActivities]   = useState<Item[]>([]);

  const [buildingId, setBuildingId]   = useState<number | null>(null);
  const [floorId, setFloorId]         = useState<number | null>(null);
  const [disciplineId, setDisciplineId] = useState<number | null>(null);
  const [activityId, setActivityId]   = useState<number | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Set<number>>(new Set());

  const [progress, setProgress]       = useState(0);
  const [isHold, setIsHold]           = useState(false);
  const [remarks, setRemarks]         = useState('');

  const [submitting, setSubmitting]   = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetch('/api/buildings').then(r => r.json()).then(setBuildings);
    fetch('/api/disciplines').then(r => r.json()).then(setDisciplines);
  }, []);

  useEffect(() => {
    if (buildingId == null) return;
    fetch(`/api/floors?buildingId=${buildingId}`).then(r => r.json()).then(setFloors);
  }, [buildingId]);

  useEffect(() => {
    if (floorId == null) return;
    fetch(`/api/rooms?floorId=${floorId}`).then(r => r.json()).then(setRooms);
  }, [floorId]);

  useEffect(() => {
    if (disciplineId == null) return;
    fetch(`/api/activities?disciplineId=${disciplineId}`).then(r => r.json()).then(setActivities);
  }, [disciplineId]);

  // Auto-select single discipline
  useEffect(() => {
    if (step === 3 && engineer.disciplines.length === 1) {
      setDisciplineId(engineer.disciplines[0].id);
      setStep(4);
    }
  }, [step, engineer.disciplines]);

  function reset() {
    setStep(1);
    setBuildingId(null); setFloorId(null); setDisciplineId(null); setActivityId(null);
    setFloors([]); setRooms([]); setActivities([]);
    setSelectedRooms(new Set());
    setProgress(0); setIsHold(false); setRemarks('');
    setSubmitSuccess(null); setSubmitError('');
  }

  function toggleRoom(id: number) {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() { setSelectedRooms(new Set(rooms.map(r => r.id))); }
  function clearAll()  { setSelectedRooms(new Set()); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRooms.size === 0) return;
    setSubmitting(true); setSubmitError('');
    try {
      const res = await fetch('/api/updates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildingId, floorId,
          roomIds: Array.from(selectedRooms),
          disciplineId, activityId, progress, isHold, remarks,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmitSuccess(data.count);
        setTimeout(() => setSubmitSuccess(null), 4000);
        onUpdateSubmitted();
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Submit failed');
      }
    } catch {
      setSubmitError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const status = computeStatus(progress, isHold);
  const statusCfg = STATUS_CONFIG[status];
  const selectedBuilding  = buildings.find(b => b.id === buildingId);
  const selectedFloor     = floors.find(f => f.id === floorId);
  const selectedDisc      = disciplines.find(d => d.id === disciplineId);
  const selectedActivity  = activities.find(a => a.id === activityId);

  const cardCls = 'bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5';
  const btnCls  = 'p-3 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-600 hover:border-amber-300 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm text-left transition-all active:scale-95';

  return (
    <div className="max-w-lg mx-auto">
      {/* Step progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => {
            const num = i + 1;
            const active = num === step;
            const done = num < step;
            return (
              <div key={s} className="flex flex-col items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done ? 'bg-amber-500 text-white' : active ? 'bg-slate-800 dark:bg-slate-200 dark:text-slate-800 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}>
                  {done ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : num}
                </div>
                <span className={`text-[10px] mt-1 font-medium hidden sm:block ${active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{s}</span>
              </div>
            );
          })}
        </div>
        <div className="flex h-1 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${((step - 1) / 5) * 100}%` }} />
        </div>
      </div>

      {/* Breadcrumb */}
      {step > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedBuilding && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">{selectedBuilding.name}</span>}
          {selectedFloor    && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">{selectedFloor.name}</span>}
          {selectedDisc     && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${DISC_COLORS[selectedDisc.name] || 'bg-slate-100 text-slate-600'}`}>{selectedDisc.name}</span>}
          {selectedActivity && <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-medium">{selectedActivity.name}</span>}
          {selectedRooms.size > 0 && <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full text-xs font-semibold">{selectedRooms.size} rooms</span>}
        </div>
      )}

      {/* Step 1: Building */}
      {step === 1 && (
        <div className={cardCls}>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Building</h2>
          <div className="grid grid-cols-2 gap-3">
            {buildings.map(b => (
              <button key={b.id} onClick={() => { setBuildingId(b.id); setFloorId(null); setFloors([]); setRooms([]); setSelectedRooms(new Set()); setStep(2); }}
                className={btnCls + ' flex flex-col items-start'}>
                <span className="text-2xl mb-1">🏗️</span>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Floor */}
      {step === 2 && (
        <div className={cardCls}>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Floor</h2>
          <div className="grid grid-cols-2 gap-2">
            {floors.map(f => (
              <button key={f.id} onClick={() => { setFloorId(f.id); setRooms([]); setSelectedRooms(new Set()); setStep(3); }}
                className={btnCls}>{f.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Discipline */}
      {step === 3 && (
        <div className={cardCls}>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Discipline</h2>
          <div className="flex flex-col gap-2">
            {disciplines.map(d => {
              const auth = d.authorized === 1;
              return (
                <button key={d.id} onClick={() => { if (!auth) return; setDisciplineId(d.id); setActivities([]); setActivityId(null); setStep(4); }}
                  className={`${btnCls} flex items-center justify-between ${!auth ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <span>{d.name}</span>
                  {!auth && <span className="text-xs text-slate-400 font-normal">No access</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 4: Activity */}
      {step === 4 && (
        <div className={cardCls}>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Select Activity</h2>
          {selectedDisc && <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{selectedDisc.name}</p>}
          <div className="flex flex-col gap-2">
            {activities.map(a => (
              <button key={a.id} onClick={() => { setActivityId(a.id); setStep(5); }}
                className={btnCls}>{a.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Select multiple rooms */}
      {step === 5 && (
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Select Rooms</h2>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline">All</button>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <button onClick={clearAll} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">Clear</button>
            </div>
          </div>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {rooms.map(r => {
              const checked = selectedRooms.has(r.id);
              return (
                <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  checked
                    ? 'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-900/30'
                    : 'border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 hover:border-amber-200 dark:hover:border-amber-600'
                }`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleRoom(r.id)}
                    className="w-4 h-4 rounded accent-amber-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.name}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selectedRooms.size} of {rooms.length} selected
            </span>
            <button
              onClick={() => setStep(6)}
              disabled={selectedRooms.size === 0}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Set progress and submit */}
      {step === 6 && (
        <form onSubmit={handleSubmit} className={cardCls + ' space-y-5'}>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Set Progress</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Applying to <span className="font-semibold text-amber-600">{selectedRooms.size} rooms</span>
              {selectedActivity && <> · {selectedActivity.name}</>}
            </p>
          </div>

          {/* Status display */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {(['notstarted', 'ongoing', 'completed'] as const).map(s => (
                <div key={s} className={`px-2 py-2.5 rounded-xl text-xs font-semibold text-center border-2 ${
                  status === s ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-current` : 'bg-slate-50 dark:bg-slate-700 text-slate-400 border-slate-100 dark:border-slate-600'
                }`}>{STATUS_CONFIG[s].label}</div>
              ))}
              <button type="button" onClick={() => { if (progress < 100) setIsHold(h => !h); }}
                className={`px-2 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                  isHold ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300' : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                } ${progress === 100 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={progress === 100}>Hold</button>
            </div>
          </div>

          {/* Progress slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={100} value={progress}
                  onChange={e => { const v = Math.max(0, Math.min(100, Number(e.target.value))); setProgress(isNaN(v) ? 0 : v); if (v === 100) setIsHold(false); }}
                  className={`w-16 text-center text-lg font-bold border-2 rounded-lg py-0.5 focus:outline-none focus:border-amber-400 dark:bg-slate-700 dark:text-slate-100 border-slate-200 dark:border-slate-600 ${statusCfg.text}`}
                />
                <span className={`text-lg font-bold ${statusCfg.text}`}>%</span>
              </div>
            </div>
            <div className="relative">
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
                <div className={`h-full rounded-full transition-all ${statusCfg.bar}`} style={{ width: `${progress}%` }} />
              </div>
              <input type="range" min={0} max={100} value={progress}
                onChange={e => { const v = Number(e.target.value); setProgress(v); if (v === 100) setIsHold(false); }}
                style={{ background: 'transparent' }} className="w-full -mt-4 relative z-10" />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              {['0%','25%','50%','75%','100%'].map(l => <span key={l}>{l}</span>)}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Remarks <span className="font-normal">(optional)</span>
            </label>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
              placeholder="Add any notes…"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>

          {submitError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm px-3 py-2.5 rounded-lg">{submitError}</div>
          )}
          {submitSuccess !== null && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-sm px-3 py-2.5 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {submitSuccess} rooms updated successfully!
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={reset}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm">
              Start Over
            </button>
            <button type="submit" disabled={submitting || selectedRooms.size === 0}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm">
              {submitting ? 'Submitting…' : `Update ${selectedRooms.size} Rooms`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
