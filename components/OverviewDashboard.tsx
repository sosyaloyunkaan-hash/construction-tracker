'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

/* ── Discipline-wise types ── */
interface RoomData {
  room_id: number;
  room_name: string;
  room_progress: number;
  room_status: string;
  has_update: boolean;
}
interface FloorData {
  floor_id: number;
  floor_name: string;
  floor_number: number;
  total_rooms: number;
  updated_rooms: number;
  floor_progress: number;
  rooms: RoomData[];
}
interface BuildingData {
  building_id: number;
  building_name: string;
  building_progress: number;
  floors: FloorData[];
}
interface ActivityData {
  activity_id: number;
  activity_name: string;
  overall_progress: number;
  buildings: BuildingData[];
}
interface DisciplineData {
  discipline_id: number;
  discipline_name: string;
  activities: ActivityData[];
}

/* ── Building-wise types ── */
interface BActivityData {
  activity_id: number;
  activity_name: string;
  discipline_name: string;
  progress: number;
  status: string;
  has_update: boolean;
}
interface BRoomData {
  room_id: number;
  room_name: string;
  room_progress: number;
  activities: BActivityData[];
}
interface BFloorData {
  floor_id: number;
  floor_name: string;
  floor_progress: number;
  rooms: BRoomData[];
}
interface BBuildingData {
  building_id: number;
  building_name: string;
  building_progress: number;
  floors: BFloorData[];
}

/* ── Shared helpers ── */
const DISC_TABS: Record<string, string> = {
  'MEP':            'border-blue-500 text-blue-600',
  'Finishing':      'border-purple-500 text-purple-600',
  'Civil':          'border-amber-500 text-amber-600',
  'External Works': 'border-green-500 text-green-600',
};
const DISC_DOT: Record<string, string> = {
  'MEP':            'bg-blue-500',
  'Finishing':      'bg-purple-500',
  'Civil':          'bg-amber-500',
  'External Works': 'bg-green-500',
};
const STATUS_DOT: Record<string, string> = {
  notstarted: 'bg-slate-300',
  ongoing:    'bg-amber-500',
  completed:  'bg-green-500',
  hold:       'bg-blue-500',
};
function barColor(p: number) {
  if (p === 100) return 'bg-green-500';
  if (p === 0)   return 'bg-slate-200';
  return 'bg-amber-500';
}
function textColor(p: number) {
  if (p === 100) return 'text-green-600';
  if (p === 0)   return 'text-slate-400';
  return 'text-amber-600';
}

interface Props { refreshTrigger: number }

export default function OverviewDashboard({ refreshTrigger }: Props) {
  const [view, setView] = useState<'discipline' | 'building'>('discipline');

  /* ── Discipline-wise state ── */
  const [discData, setDiscData]   = useState<DisciplineData[]>([]);
  const [discLoading, setDiscLoading] = useState(true);
  const [activeDisc, setActiveDisc]   = useState(0);
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  const [expandedBuildings,  setExpandedBuildings]  = useState<Record<string, boolean>>({});
  const [expandedFloors,     setExpandedFloors]     = useState<Record<string, boolean>>({});

  /* ── Building-wise state ── */
  const [bldData, setBldData]     = useState<BBuildingData[]>([]);
  const [bldLoading, setBldLoading] = useState(true);
  const [expandedBBuildings, setExpandedBBuildings] = useState<Record<number, boolean>>({});
  const [expandedBFloors,    setExpandedBFloors]    = useState<Record<string, boolean>>({});
  const [expandedBRooms,     setExpandedBRooms]     = useState<Record<string, boolean>>({});

  const [exporting, setExporting] = useState(false);

  const fetchDisc = useCallback(async () => {
    setDiscLoading(true);
    try {
      const res = await fetch(`/api/dashboard?t=${Date.now()}`, { cache: 'no-store' });
      setDiscData(await res.json());
    } finally {
      setDiscLoading(false);
    }
  }, []);

  const fetchBuilding = useCallback(async () => {
    setBldLoading(true);
    try {
      const res = await fetch(`/api/dashboard/building?t=${Date.now()}`, { cache: 'no-store' });
      setBldData(await res.json());
    } finally {
      setBldLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisc(); },    [fetchDisc,    refreshTrigger]);
  useEffect(() => { fetchBuilding(); }, [fetchBuilding, refreshTrigger]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `site-progress-${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const loading = view === 'discipline' ? discLoading : bldLoading;

  return (
    <div className="max-w-lg mx-auto">

      {/* Toolbar */}
      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={() => view === 'discipline' ? fetchDisc() : fetchBuilding()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {exporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>

      {/* Selection tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
        <button
          onClick={() => setView('discipline')}
          className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            view === 'discipline' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Discipline Wise
        </button>
        <button
          onClick={() => setView('building')}
          className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            view === 'building' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Building Wise
        </button>
      </div>

      {/* ─────────────── DISCIPLINE WISE ─────────────── */}
      {view === 'discipline' && (
        discLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (() => {
          const discipline = discData[activeDisc];
          if (!discipline) return null;
          const total      = discipline.activities.length;
          const doneCount  = discipline.activities.filter(a => a.overall_progress === 100).length;
          const ongoingCount = discipline.activities.filter(a => a.overall_progress > 0 && a.overall_progress < 100).length;
          const discAvg    = total ? Math.round(discipline.activities.reduce((s, a) => s + a.overall_progress, 0) / total) : 0;
          return (
            <>
              {/* Discipline tabs */}
              <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
                {discData.map((disc, i) => (
                  <button key={disc.discipline_id}
                    onClick={() => setActiveDisc(i)}
                    className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
                      activeDisc === i
                        ? (DISC_TABS[disc.discipline_name] || 'border-slate-500 text-slate-600')
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}>
                    {disc.discipline_name}
                  </button>
                ))}
              </div>

              {/* Discipline summary card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">{discipline.discipline_name}</h2>
                    <p className="text-xs text-slate-400">{total} activities · {discipline.activities[0]?.buildings?.length ?? 0} buildings</p>
                  </div>
                  <span className={`text-2xl font-black ${textColor(discAvg)}`}>{discAvg}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor(discAvg)}`} style={{ width: `${discAvg}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded-xl p-2.5">
                    <p className="text-lg font-black text-green-600">{doneCount}</p>
                    <p className="text-xs text-green-500 font-medium">Completed</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-2.5">
                    <p className="text-lg font-black text-amber-600">{ongoingCount}</p>
                    <p className="text-xs text-amber-500 font-medium">In Progress</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-2.5">
                    <p className="text-lg font-black text-slate-500">{total - doneCount - ongoingCount}</p>
                    <p className="text-xs text-slate-400 font-medium">Not Started</p>
                  </div>
                </div>
              </div>

              {/* Activities list */}
              <div className="space-y-2">
                {discipline.activities.map(activity => {
                  const aOpen = expandedActivities[activity.activity_id];
                  return (
                    <div key={activity.activity_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedActivities(p => ({ ...p, [activity.activity_id]: !p[activity.activity_id] }))}
                        className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{activity.activity_name}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${barColor(activity.overall_progress)}`}
                                style={{ width: `${activity.overall_progress}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-10 text-right ${textColor(activity.overall_progress)}`}>
                              {activity.overall_progress}%
                            </span>
                          </div>
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${aOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {aOpen && (
                        <div className="border-t border-slate-100">
                          {activity.buildings.map(building => {
                            const bKey = `${activity.activity_id}-${building.building_id}`;
                            const bOpen = expandedBuildings[bKey];
                            return (
                              <div key={building.building_id}>
                                <button
                                  onClick={() => setExpandedBuildings(p => ({ ...p, [bKey]: !p[bKey] }))}
                                  className="w-full px-4 py-2.5 flex items-center gap-3 bg-slate-50 border-b border-slate-100 text-left"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[11px] font-black text-white">
                                      {building.building_name.replace('Building ', '')}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-bold text-slate-700">{building.building_name}</span>
                                      <span className={`text-xs font-bold ${textColor(building.building_progress)}`}>
                                        {building.building_progress}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${barColor(building.building_progress)}`}
                                        style={{ width: `${building.building_progress}%` }} />
                                    </div>
                                  </div>
                                  <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${bOpen ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>

                                {bOpen && building.floors.map(floor => {
                                  const fKey = `${bKey}-${floor.floor_id}`;
                                  const fOpen = expandedFloors[fKey];
                                  return (
                                    <div key={floor.floor_id} className="border-b border-slate-50 last:border-b-0">
                                      <button
                                        onClick={() => setExpandedFloors(p => ({ ...p, [fKey]: !p[fKey] }))}
                                        className="w-full px-4 py-2 flex items-center gap-3 bg-white hover:bg-slate-50 text-left"
                                      >
                                        <div className="w-1 h-8 rounded-full bg-slate-200 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold text-slate-600">{floor.floor_name}</span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] text-slate-400">
                                                {floor.updated_rooms}/{floor.total_rooms} rooms
                                              </span>
                                              <span className={`text-xs font-bold ${textColor(floor.floor_progress)}`}>
                                                {floor.floor_progress}%
                                              </span>
                                            </div>
                                          </div>
                                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${barColor(floor.floor_progress)}`}
                                              style={{ width: `${floor.floor_progress}%` }} />
                                          </div>
                                        </div>
                                        <svg className={`w-3 h-3 text-slate-300 flex-shrink-0 transition-transform ${fOpen ? 'rotate-180' : ''}`}
                                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>

                                      {fOpen && (
                                        <div className="bg-slate-50 px-4 pt-1 pb-2 space-y-1">
                                          {floor.rooms.map(room => (
                                            <div key={room.room_id} className="flex items-center gap-2.5 py-1">
                                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[room.room_status] || 'bg-slate-300'}`} />
                                              <span className="text-xs text-slate-600 flex-1 truncate">{room.room_name}</span>
                                              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                                                <div className={`h-full rounded-full ${barColor(room.room_progress)}`}
                                                  style={{ width: `${room.room_progress}%` }} />
                                              </div>
                                              <span className={`text-[11px] font-bold w-8 text-right flex-shrink-0 ${textColor(room.room_progress)}`}>
                                                {room.room_progress}%
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()
      )}

      {/* ─────────────── BUILDING WISE ─────────────── */}
      {view === 'building' && (
        bldLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {bldData.map(building => {
              const bOpen = expandedBBuildings[building.building_id];
              return (
                <div key={building.building_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

                  {/* Building row */}
                  <button
                    onClick={() => setExpandedBBuildings(p => ({ ...p, [building.building_id]: !p[building.building_id] }))}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-white">
                        {building.building_name.replace('Building ', '')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{building.building_name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${barColor(building.building_progress)}`}
                            style={{ width: `${building.building_progress}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${textColor(building.building_progress)}`}>
                          {building.building_progress}%
                        </span>
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${bOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {bOpen && (
                    <div className="border-t border-slate-100">
                      {building.floors.map(floor => {
                        const fKey = `${building.building_id}-${floor.floor_id}`;
                        const fOpen = expandedBFloors[fKey];
                        return (
                          <div key={floor.floor_id} className="border-b border-slate-50 last:border-b-0">

                            {/* Floor row */}
                            <button
                              onClick={() => setExpandedBFloors(p => ({ ...p, [fKey]: !p[fKey] }))}
                              className="w-full px-4 py-2.5 flex items-center gap-3 bg-slate-50 text-left hover:bg-slate-100"
                            >
                              <div className="w-1 h-8 rounded-full bg-slate-300 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700">{floor.floor_name}</span>
                                  <span className={`text-xs font-bold ${textColor(floor.floor_progress)}`}>
                                    {floor.floor_progress}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor(floor.floor_progress)}`}
                                    style={{ width: `${floor.floor_progress}%` }} />
                                </div>
                              </div>
                              <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${fOpen ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {fOpen && floor.rooms.map(room => {
                              const rKey = `${fKey}-${room.room_id}`;
                              const rOpen = expandedBRooms[rKey];
                              const hasAny = room.activities.some(a => a.has_update);
                              return (
                                <div key={room.room_id} className="border-b border-slate-50 last:border-b-0">

                                  {/* Room row */}
                                  <button
                                    onClick={() => setExpandedBRooms(p => ({ ...p, [rKey]: !p[rKey] }))}
                                    className="w-full px-6 py-2 flex items-center gap-3 bg-white hover:bg-slate-50 text-left"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-slate-600">{room.room_name}</span>
                                        <span className={`text-xs font-bold ${hasAny ? textColor(room.room_progress) : 'text-slate-300'}`}>
                                          {hasAny ? `${room.room_progress}%` : '—'}
                                        </span>
                                      </div>
                                      {hasAny && (
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full ${barColor(room.room_progress)}`}
                                            style={{ width: `${room.room_progress}%` }} />
                                        </div>
                                      )}
                                    </div>
                                    <svg className={`w-3 h-3 text-slate-300 flex-shrink-0 transition-transform ${rOpen ? 'rotate-180' : ''}`}
                                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {/* Activities */}
                                  {rOpen && (
                                    <div className="bg-slate-50 px-6 pt-1 pb-2 space-y-1">
                                      {room.activities.map(act => (
                                        <div key={act.activity_id} className="flex items-center gap-2.5 py-1">
                                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${act.has_update ? (DISC_DOT[act.discipline_name] || 'bg-slate-300') : 'bg-slate-200'}`} />
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs text-slate-600 block truncate">{act.activity_name}</span>
                                            <span className="text-[10px] text-slate-400">{act.discipline_name}</span>
                                          </div>
                                          {act.has_update ? (
                                            <>
                                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                                                <div className={`h-full rounded-full ${barColor(act.progress)}`}
                                                  style={{ width: `${act.progress}%` }} />
                                              </div>
                                              <span className={`text-[11px] font-bold w-8 text-right flex-shrink-0 ${textColor(act.progress)}`}>
                                                {act.progress}%
                                              </span>
                                            </>
                                          ) : (
                                            <span className="text-[11px] text-slate-300 w-8 text-right flex-shrink-0">—</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                </div>
                              );
                            })}

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )
      )}

    </div>
  );
}
