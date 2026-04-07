import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import AdminStats from '@/components/AdminStats';
import Link from 'next/link';

export default async function AdminStatsPage() {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold">Activity Stats</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-slate-300 hover:text-white text-sm transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Users
            </Link>
            <Link href="/" className="text-slate-300 hover:text-white text-sm transition-colors">
              Back to app
            </Link>
          </div>
        </div>

        {/* Admin nav tabs */}
        <div className="max-w-4xl mx-auto flex gap-1 mt-3">
          <Link href="/admin/users"
            className="px-4 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            Users
          </Link>
          <Link href="/admin/stats"
            className="px-4 py-1.5 text-xs font-semibold bg-slate-700 text-white rounded-lg">
            Stats
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <AdminStats />
      </div>
    </div>
  );
}
