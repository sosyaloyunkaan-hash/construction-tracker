'use client';

import { useEffect, useState, useCallback } from 'react';

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

const DISC_TABS: Record<string, string> = {
  'MEP':            'border-blue-500 text-blue-600',
  'Finishing':      'border-purple-500 text-purple-600',
  'Civil':          'border-amber-500 text-amber-600',
  'External Works': 'border-green-500 text-green-600',
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
  const [data, setData] = useState<DisciplineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeDisc, setActiveDisc] = useState(0);
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

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

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const discipline = data[activeDisc];
  if (!discipline) return null;

  const total = discipline.activities.length;
  const doneCount = discipline.activities.filter(a => a.overall_progress === 100).length;
  const ongoingCount = discipline.activities.filter(a => a.overall_progress > 0 && a.overall_progress < 100).length;
  const discAvg = total ? Math.round(discipline.activities.reduce((s, a) => s + a.overall_progress, 0) / total) : 0;

  return (
    <div className="max-w-lg mx-auto">

      {/* Export button */}
      <div className="flex justify-end mb-3">
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

      {/* Discipline tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
        {data.map((disc, i) => (
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

      {/* Discipline summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{discipline.discipline_name}</h2>
            <p className="text-xs text-slate-400">{total} activities · 4 buildings · 10 floors</p>
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

              {/* ── Activity row ── */}
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

                        {/* ── Building row (grouping 1) ── */}
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

                              {/* ── Floor row (grouping 2) ── */}
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

                              {/* ── Room rows (grouping 3) — always visible when floor open ── */}
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
    </div>
  );
}
