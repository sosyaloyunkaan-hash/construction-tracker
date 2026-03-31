'use client';

import { useEffect, useState, useCallback } from 'react';

interface FloorData {
  floor_id: number;
  floor_name: string;
  floor_number: number;
  total_rooms: number;
  updated_rooms: number;
  floor_progress: number;
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

const DISC_COLORS: Record<string, { tab: string; active: string; tag: string }> = {
  'MEP':            { tab: 'border-blue-500 text-blue-600',   active: 'bg-blue-500',   tag: 'bg-blue-100 text-blue-700' },
  'Finishing':      { tab: 'border-purple-500 text-purple-600', active: 'bg-purple-500', tag: 'bg-purple-100 text-purple-700' },
  'Civil':          { tab: 'border-amber-500 text-amber-600', active: 'bg-amber-500',   tag: 'bg-amber-100 text-amber-700' },
  'External Works': { tab: 'border-green-500 text-green-600', active: 'bg-green-500',   tag: 'bg-green-100 text-green-700' },
};

function progressColor(p: number) {
  if (p === 100) return 'bg-green-500';
  if (p === 0)   return 'bg-slate-300';
  return 'bg-amber-500';
}

function progressTextColor(p: number) {
  if (p === 100) return 'text-green-600';
  if (p === 0)   return 'text-slate-400';
  return 'text-amber-600';
}

function statusLabel(p: number) {
  if (p === 100) return 'Completed';
  if (p === 0)   return 'Not started';
  return `${p}%`;
}

interface Props { refreshTrigger: number }

export default function OverviewDashboard({ refreshTrigger }: Props) {
  const [data, setData] = useState<DisciplineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDisc, setActiveDisc] = useState(0);
  const [expandedActivities, setExpandedActivities] = useState<Record<number, boolean>>({});
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshTrigger]);

  function toggleActivity(id: number) {
    setExpandedActivities(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleBuilding(key: string) {
    setExpandedBuildings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const discipline = data[activeDisc];

  // Summary stats for current discipline
  const totalActivities = discipline?.activities.length || 0;
  const completed = discipline?.activities.filter(a => a.overall_progress === 100).length || 0;
  const inProgress = discipline?.activities.filter(a => a.overall_progress > 0 && a.overall_progress < 100).length || 0;
  const discAvg = totalActivities
    ? Math.round(discipline.activities.reduce((s, a) => s + a.overall_progress, 0) / totalActivities)
    : 0;

  return (
    <div className="max-w-lg mx-auto">
      {/* Discipline tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
        {data.map((disc, i) => {
          const colors = DISC_COLORS[disc.discipline_name] || { tab: 'border-slate-500 text-slate-600', active: 'bg-slate-500', tag: '' };
          return (
            <button key={disc.discipline_id}
              onClick={() => setActiveDisc(i)}
              className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeDisc === i ? colors.tab : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              {disc.discipline_name}
            </button>
          );
        })}
      </div>

      {discipline && (
        <>
          {/* Discipline summary card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">{discipline.discipline_name}</h2>
                <p className="text-xs text-slate-400">{totalActivities} activities across 4 buildings</p>
              </div>
              <span className={`text-2xl font-black ${progressTextColor(discAvg)}`}>{discAvg}%</span>
            </div>
            {/* Overall bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all duration-500 ${progressColor(discAvg)}`}
                style={{ width: `${discAvg}%` }} />
            </div>
            {/* Stats row */}
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

          {/* Activities list */}
          <div className="space-y-2">
            {discipline.activities.map(activity => {
              const isExpanded = expandedActivities[activity.activity_id];
              return (
                <div key={activity.activity_id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Activity header — tap to expand */}
                  <button
                    onClick={() => toggleActivity(activity.activity_id)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{activity.activity_name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${progressColor(activity.overall_progress)}`}
                            style={{ width: `${activity.overall_progress}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-12 text-right ${progressTextColor(activity.overall_progress)}`}>
                          {statusLabel(activity.overall_progress)}
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Buildings breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {activity.buildings.map(building => {
                        const bKey = `${activity.activity_id}-${building.building_id}`;
                        const bExpanded = expandedBuildings[bKey];
                        return (
                          <div key={building.building_id} className="border-b border-slate-50 last:border-b-0">
                            {/* Building row */}
                            <button
                              onClick={() => toggleBuilding(bKey)}
                              className="w-full px-4 py-2.5 flex items-center gap-3 bg-slate-50 text-left"
                            >
                              <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-black text-slate-600">
                                  {building.building_name.replace('Building ', '')}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-700">{building.building_name}</span>
                                  <span className={`text-xs font-bold ml-2 ${progressTextColor(building.building_progress)}`}>
                                    {building.building_progress}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                                  <div className={`h-full rounded-full ${progressColor(building.building_progress)}`}
                                    style={{ width: `${building.building_progress}%` }} />
                                </div>
                              </div>
                              <svg className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${bExpanded ? 'rotate-180' : ''}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>

                            {/* Floors breakdown */}
                            {bExpanded && (
                              <div className="px-4 py-2 space-y-2">
                                {building.floors.map(floor => (
                                  <div key={floor.floor_id} className="flex items-center gap-3">
                                    <span className="text-xs text-slate-500 w-24 flex-shrink-0 truncate">{floor.floor_name}</span>
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-500 ${progressColor(floor.floor_progress)}`}
                                        style={{ width: `${floor.floor_progress}%` }} />
                                    </div>
                                    <span className={`text-xs font-bold w-10 text-right flex-shrink-0 ${progressTextColor(floor.floor_progress)}`}>
                                      {floor.floor_progress}%
                                    </span>
                                    <span className="text-[10px] text-slate-400 w-12 text-right flex-shrink-0">
                                      {floor.updated_rooms}/{floor.total_rooms} rooms
                                    </span>
                                  </div>
                                ))}
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
        </>
      )}
    </div>
  );
}
