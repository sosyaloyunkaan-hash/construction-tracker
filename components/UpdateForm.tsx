'use client';

import { useState, useEffect, useCallback } from 'react';
import CommentsThread from './CommentsThread';

interface Engineer {
  id: number;
  name: string;
  initials: string;
  avatar_color: string;
  disciplines: { id: number; name: string }[];
}

interface Item { id: number; name: string }
interface Discipline extends Item { authorized: number }

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

function computeStatus(progress: number, isHold: boolean): 'notstarted' | 'ongoing' | 'completed' | 'hold' {
  if (progress === 100) return 'completed';
  if (isHold) return 'hold';
  if (progress === 0) return 'notstarted';
  return 'ongoing';
}

function formatDate(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  engineer: Engineer;
  onUpdateSubmitted: () => void;
}

const STEPS = ['Building', 'Floor', 'Room', 'Discipline', 'Activity', 'Update'];

export default function UpdateForm({ engineer, onUpdateSubmitted }: Props) {
  const [step, setStep] = useState(1);

  const [buildings, setBuildings] = useState<Item[]>([]);
  const [floors, setFloors] = useState<Item[]>([]);
  const [rooms, setRooms] = useState<Item[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [activities, setActivities] = useState<Item[]>([]);

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [floorId, setFloorId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [disciplineId, setDisciplineId] = useState<number | null>(null);
  const [activityId, setActivityId] = useState<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [isHold, setIsHold] = useState(false);

  const [latestUpdate, setLatestUpdate] = useState<UpdateRecord | null>(null);
  const [latestFetched, setLatestFetched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const disciplineUnauthorized = disciplineId !== null &&
    disciplines.find(d => d.id === disciplineId)?.authorized === 0;

  // Load buildings on mount
  useEffect(() => {
    fetch('/api/buildings').then(r => r.json()).then(setBuildings);
    fetch('/api/disciplines').then(r => r.json()).then(setDisciplines);
  }, []);

  // Load floors when building selected
  useEffect(() => {
    if (buildingId == null) return;
    fetch(`/api/floors?buildingId=${buildingId}`).then(r => r.json()).then(setFloors);
  }, [buildingId]);

  // Load rooms when floor selected
  useEffect(() => {
    if (floorId == null) return;
    fetch(`/api/rooms?floorId=${floorId}`).then(r => r.json()).then(setRooms);
  }, [floorId]);

  // Load activities when discipline selected
  useEffect(() => {
    if (disciplineId == null) return;
    fetch(`/api/activities?disciplineId=${disciplineId}`).then(r => r.json()).then(setActivities);
  }, [disciplineId]);

  // Fetch latest update when activity is selected (step 6)
  const fetchLatest = useCallback(async () => {
    if (!buildingId || !floorId || !roomId || !disciplineId || !activityId) return;
    const res = await fetch(
      `/api/updates/latest?buildingId=${buildingId}&floorId=${floorId}&roomId=${roomId}&disciplineId=${disciplineId}&activityId=${activityId}`
    );
    const data = await res.json();
    setLatestUpdate(data);
    setLatestFetched(true);
    // Pre-populate form with latest values
    if (data) {
      setProgress(data.progress);
      setIsHold(data.status === 'hold');
    }
  }, [buildingId, floorId, roomId, disciplineId, activityId]);

  useEffect(() => {
    if (step === 6) fetchLatest();
  }, [step, fetchLatest]);

  // Auto-select discipline if engineer has exactly 1
  useEffect(() => {
    if (step === 4 && engineer.disciplines.length === 1) {
      setDisciplineId(engineer.disciplines[0].id);
      setStep(5);
    }
  }, [step, engineer.disciplines]);

  function selectBuilding(id: number) {
    setBuildingId(id);
    setFloorId(null); setRoomId(null); setDisciplineId(null); setActivityId(null);
    setFloors([]); setRooms([]); setActivities([]);
    setStep(2);
  }

  function selectFloor(id: number) {
    setFloorId(id);
    setRoomId(null); setActivityId(null);
    setRooms([]); setActivities([]);
    setStep(3);
  }

  function selectRoom(id: number) {
    setRoomId(id);
    setActivityId(null); setActivities([]);
    setStep(4);
  }

  function selectDiscipline(id: number) {
    setDisciplineId(id);
    setActivityId(null); setActivities([]);
    setStep(5);
  }

  function selectActivity(id: number) {
    setActivityId(id);
    setLatestFetched(false);
    setProgress(0); setIsHold(false); // will be overwritten by fetchLatest if update exists
    setStep(6);
  }

  function handleProgressChange(val: number) {
    setProgress(val);
    if (val === 100) setIsHold(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, floorId, roomId, disciplineId, activityId, progress, isHold, remarks: '' }),
      });
      if (res.ok) {
        const newUpdate = await res.json();
        setLatestUpdate(newUpdate);
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 4000);
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

  function resetForm() {
    setStep(1);
    setBuildingId(null); setFloorId(null); setRoomId(null);
    setDisciplineId(null); setActivityId(null);
    setProgress(0); setIsHold(false);
    setLatestUpdate(null); setLatestFetched(false);
    setSubmitSuccess(false);
  }

  const status = computeStatus(progress, isHold);
  const statusCfg = STATUS_CONFIG[status];

  const selectedBuilding = buildings.find(b => b.id === buildingId);
  const selectedFloor = floors.find(f => f.id === floorId);
  const selectedRoom = rooms.find(r => r.id === roomId);
  const selectedDiscipline = disciplines.find(d => d.id === disciplineId);
  const selectedActivity = activities.find(a => a.id === activityId);

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
                  done ? 'bg-amber-500 text-white' : active ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : num}
                </div>
                <span className={`text-[10px] mt-1 font-medium hidden sm:block ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex h-1 rounded-full overflow-hidden bg-slate-200">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((step - 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Breadcrumb summary */}
      {step > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {selectedBuilding && (
            <button onClick={() => { setBuildingId(null); setFloorId(null); setRoomId(null); setDisciplineId(null); setActivityId(null); setStep(1); }}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors">
              {selectedBuilding.name} ×
            </button>
          )}
          {selectedFloor && (
            <button onClick={() => { setFloorId(null); setRoomId(null); setDisciplineId(null); setActivityId(null); setStep(2); }}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors">
              {selectedFloor.name} ×
            </button>
          )}
          {selectedRoom && (
            <button onClick={() => { setRoomId(null); setDisciplineId(null); setActivityId(null); setStep(3); }}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors">
              {selectedRoom.name} ×
            </button>
          )}
          {selectedDiscipline && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${DISC_COLORS[selectedDiscipline.name] || 'bg-slate-100 text-slate-600'}`}>
              {selectedDiscipline.name}
            </span>
          )}
          {selectedActivity && (
            <button onClick={() => { setActivityId(null); setStep(5); }}
              className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors">
              {selectedActivity.name} ×
            </button>
          )}
        </div>
      )}

      {/* Step 1: Building */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Building</h2>
          <div className="grid grid-cols-2 gap-3">
            {buildings.map(b => (
              <button key={b.id} onClick={() => selectBuilding(b.id)}
                className="p-4 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-600 hover:border-amber-300 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 font-semibold text-sm transition-all active:scale-95">
                <div className="text-2xl mb-1">🏗️</div>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Floor */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Floor</h2>
          <div className="grid grid-cols-2 gap-2">
            {floors.map(f => (
              <button key={f.id} onClick={() => selectFloor(f.id)}
                className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-600 hover:border-amber-300 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm transition-all active:scale-95">
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Room */}
      {step === 3 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Room</h2>
          <div className="flex flex-col gap-2">
            {rooms.map(r => (
              <button key={r.id} onClick={() => selectRoom(r.id)}
                className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-600 hover:border-amber-300 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm text-left transition-all active:scale-95">
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Discipline */}
      {step === 4 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4">Select Discipline</h2>
          <div className="flex flex-col gap-2">
            {disciplines.map(d => {
              const isAuthorized = d.authorized === 1;
              return (
                <button key={d.id} onClick={() => selectDiscipline(d.id)}
                  className={`p-4 border-2 rounded-xl text-sm font-semibold text-left flex items-center justify-between transition-all active:scale-95 ${
                    isAuthorized
                      ? 'bg-slate-50 hover:bg-amber-50 hover:border-amber-300 border-slate-100 text-slate-800'
                      : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}>
                  <span>{d.name}</span>
                  {!isAuthorized && (
                    <span className="text-xs text-slate-400 font-normal">No access</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 5: Activity */}
      {step === 5 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Select Activity</h2>
          {selectedDiscipline && (
            <p className="text-xs text-slate-500 mb-4">{selectedDiscipline.name}</p>
          )}
          {disciplineUnauthorized ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              You are not assigned to this discipline. Contact your planning engineer to request access.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activities.map(a => (
                <button key={a.id} onClick={() => selectActivity(a.id)}
                  className="p-3 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-slate-600 hover:border-amber-300 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-200 font-medium text-sm text-left transition-all active:scale-95">
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 6: Update */}
      {step === 6 && (
        <div className="space-y-4">
          {/* Discipline restriction warning */}
          {disciplineUnauthorized && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              You are not assigned to this discipline. Contact your planning engineer to request access.
            </div>
          )}

          {/* Latest update card */}
          {latestFetched && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Last Recorded Update
              </h3>
              {latestUpdate ? (
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: latestUpdate.avatar_color }}>
                      {latestUpdate.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{latestUpdate.engineer_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(latestUpdate.created_at)}</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[latestUpdate.status].bg} ${STATUS_CONFIG[latestUpdate.status].text}`}>
                        {STATUS_CONFIG[latestUpdate.status].label}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${STATUS_CONFIG[latestUpdate.status].bar}`}
                        style={{ width: `${latestUpdate.progress}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 w-10 text-right">{latestUpdate.progress}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No previous update recorded for this activity.</p>
              )}
            </div>
          )}

          {!disciplineUnauthorized && (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
              <h3 className="text-base font-semibold text-slate-800">Submit New Update</h3>

              {/* Status buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['notstarted', 'ongoing', 'completed'] as const).map(s => (
                    <div key={s} className={`px-2 py-2.5 rounded-xl text-xs font-semibold text-center border-2 ${
                      status === s
                        ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].text} border-current`
                        : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {STATUS_CONFIG[s].label}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { if (progress < 100) setIsHold(h => !h); }}
                    className={`px-2 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                      isHold
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300'
                    } ${progress === 100 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    disabled={progress === 100}
                  >
                    Hold
                  </button>
                </div>
              </div>

              {/* Progress slider + manual input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progress}
                      onChange={e => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value)));
                        handleProgressChange(isNaN(val) ? 0 : val);
                      }}
                      className={`w-16 text-center text-lg font-bold border-2 rounded-lg py-0.5 focus:outline-none focus:border-amber-400 ${STATUS_CONFIG[status].text} border-slate-200`}
                    />
                    <span className={`text-lg font-bold ${STATUS_CONFIG[status].text}`}>%</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${STATUS_CONFIG[status].bar}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={e => handleProgressChange(Number(e.target.value))}
                    style={{ background: 'transparent' }}
                    className="w-full -mt-4 relative z-10"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5 rounded-lg">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2.5 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update submitted successfully!
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  New Update
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 text-sm"
                >
                  {submitting ? 'Submitting…' : 'Submit Update'}
                </button>
              </div>
            </form>
          )}

          {/* Comments thread — always visible at bottom of step 6 */}
          {buildingId && floorId && roomId && activityId && (
            <CommentsThread
              buildingId={buildingId}
              floorId={floorId}
              roomId={roomId}
              activityId={activityId}
              currentUser={engineer}
            />
          )}
        </div>
      )}
    </div>
  );
}
