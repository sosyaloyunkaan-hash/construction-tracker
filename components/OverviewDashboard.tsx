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

const DISC_COLORS: Record<string, { tab: string; inactive: string }> = {
  'MEP':            { tab: 'border-blue-500 text-blue-600',    inactive: 'border-transparent text-slate-400' },
  'Finishing':      { tab: 'border-purple-500 text-purple-600', inactive: 'border-transparent text-slate-400' },
  'Civil':          { tab: 'border-amber-500 text-amber-600',  inactive: 'border-transparent text-slate-400' },
  'External Works': { tab: 'border-green-500 text-green-600',  inactive: 'border-transparent text-slate-400' },
};

const STATUS_COLORS: Record<string, { bar: string; text: string; dot: string }> = {
  notstarted: { bar: 'bg-slate-300', text: 'text-slate-400', dot: 'bg-slate-300' },
  ongoing:    { bar: 'bg-amber-500', text: 'text-amber-600', dot: 'bg-amber-500' },
  completed:  { bar: 'bg-green-500', text: 'text-green-600', dot: 'bg-green-500' },
  hold:       { bar: 'bg-blue-500',  text: 'text-blue-600',  dot: 'bg-blue-500'  },
};

function progressBar(p: number) {
  if (p === 100) return 'bg-green-500';
  if (p === 0)   return 'bg-slate-300';
  return 'bg-amber-500';
}
function progressText(p: number) {
  if (p === 100) return 'text-green-600';
  if (p === 0)   return 'text-slate-400';
  return 'text-amber-600';
}

interface Props { refreshTrigger: number }

export default function OverviewDashboard({ refreshTrigger }: Props) {
  const [data, setData] = useState<DisciplineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDisc, setActiveDisc] = useState(0);
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const discipline = data[activeDisc];
  if (!discipline) return null;

  const totalActivities = discipline.activities.length;
  const completed = discipline.activities.filter(a => a.overall_progress === 100).length;
  const inProgress = discipline.activities.filter(a => a.overall_progress > 0 && a.overall_progress < 100).length;
  const discAvg = totalActivities
    ? Math.round(discipline.activities.reduce((s, a) => s + a.overall_progress, 0) / totalActivities)
    : 0;

  return (
    <div className="max-w-lg mx-auto">
      {/* Discipline tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
        {data.map((disc, i) => {
          const colors = DISC_COLORS[disc.discipline_name] || { tab: 'border-slate-500 text-slate-600', inactive: 'border-transparent text-slate-400' };
          return (
            <button key={disc.discipline_id}
              onClick={() => setActiveDisc(i)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${activeDisc === i ? colors.tab : colors.inactive}`}>
              {disc.discipline_name}
            </button>
          );
        })}
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">{discipline.discipline_name}</h2>
            <p className="text-xs text-slate-400">{totalActivities} activities · 4 buildings · 10 floors</p>
          </div>
          <span className={`text-2xl font-black ${progressText(discAvg)}`}>{discAvg}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all duration-500 ${progressBar(discAvg)}`}
            style={{ width: `${discAvg}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-green-600">{completed}</p>
            <p className="text-xs text-green-500 font-medium">Completed</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-amber-600">{inProgress}</p>
            <p className="text-xs text-amber-500 font-medium">In Progress</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-lg font-black text-slate-500">{totalActivities - completed - inProgress}</p>
            <p className="text-xs text-slate-400 font-medium">Not Started</p>
          </div>
        </div>
      </div>

      {/* Activities */}
      <div className="space-y-2">
        {discipline.activities.map(activity => {
          const aExpanded = expandedActivities[activity.activity_id];
          return (
            <div key={activity.activity_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Activity header */}
              <button onClick={() => setExpandedActivities(p => ({ ...p, [activity.activity_id]: !p[activity.activity_id] }))}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{activity.activity_name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${progressBar(activity.overall_progress)}`}
                        style={{ width: `${activity.overall_progress}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${progressText(activity.overall_progress)}`}>
                      {activity.overall_progress}%
                    </span>
                  </div>
                </div>
                <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${aExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Buildings */}
              {aExpanded && (
                <div className="border-t border-slate-100">
                  {activity.buildings.map(building => {
                    const bKey = `${activity.activity_id}-${building.building_id}`;
                    const bExpanded = expandedBuildings[bKey];
                    return (
                      <div key={building.building_id} className="border-b border-slate-50 last:border-b-0">
                        {/* Building row */}
                        <button onClick={() => setExpandedBuildings(p => ({ ...p, [bKey]: !p[bKey] }))}
                          className="w-full px-4 py-2.5 flex items-center gap-3 bg-slate-50 text-left">
                          <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-black text-slate-600">
                              {building.building_name.replace('Building ', '')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">{building.building_name}</span>
                              <span className={`text-xs font-bold ml-2 ${progressText(building.building_progress)}`}>
                                {building.building_progress}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                              <div className={`h-full rounded-full ${progressBar(building.building_progress)}`}
                                style={{ width: `${building.building_progress}%` }} />
                            </div>
                          </div>
                          <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${bExpanded ? 'rotate-180' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Floors */}
                        {bExpanded && (
                          <div className="divide-y divide-slate-50">
                            {building.floors.map(floor => {
                              const fKey = `${bKey}-${floor.floor_id}`;
                              const fExpanded = expandedFloors[fKey];
                              return (
                                <div key={floor.floor_id}>
                                  {/* Floor row */}
                                  <button onClick={() => setExpandedFloors(p => ({ ...p, [fKey]: !p[fKey] }))}
                                    className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-50">
                                    <span className="text-xs text-slate-600 font-medium w-24 flex-shrink-0 truncate">{floor.floor_name}</span>
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${progressBar(floor.floor_progress)}`}
                                        style={{ width: `${floor.floor_progress}%` }} />
                                    </div>
                                    <span className={`text-xs font-bold w-8 text-right flex-shrink-0 ${progressText(floor.floor_progress)}`}>
                                      {floor.floor_progress}%
                                    </span>
                                    <span className="text-[10px] text-slate-400 w-14 text-right flex-shrink-0">
                                      {floor.updated_rooms}/{floor.total_rooms}
                                    </span>
                                    <svg className={`w-3 h-3 text-slate-300 flex-shrink-0 transition-transform ${fExpanded ? 'rotate-180' : ''}`}
                                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {/* Rooms */}
                                  {fExpanded && (
                                    <div className="bg-slate-50 px-4 py-2 space-y-1.5">
                                      {floor.rooms.map(room => {
                                        const sc = STATUS_COLORS[room.room_status] || STATUS_COLORS.notstarted;
                                        return (
                                          <div key={room.room_id} className="flex items-center gap-2.5">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                                            <span className="text-xs text-slate-600 flex-1 truncate">{room.room_name}</span>
                                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                                              <div className={`h-full rounded-full ${sc.bar}`}
                                                style={{ width: `${room.room_progress}%` }} />
                                            </div>
                                            <span className={`text-[11px] font-bold w-7 text-right flex-shrink-0 ${sc.text}`}>
                                              {room.room_progress}%
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
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
