import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';
import AdminProjects from '@/components/AdminProjects';

export const dynamic = 'force-dynamic';

export default async function AdminProjectsPage() {
  if (!(await verifyAdminToken())) redirect('/admin/login');

  const { rows } = await query(`
    SELECT
      p.id, p.code, p.name,
      (SELECT COUNT(*)::int FROM buildings b WHERE b.project_id = p.id) AS buildings,
      (SELECT COUNT(*)::int FROM floors f
         JOIN buildings b ON b.id = f.building_id WHERE b.project_id = p.id) AS floors,
      (SELECT COUNT(*)::int FROM rooms r
         JOIN floors f ON f.id = r.floor_id
         JOIN buildings b ON b.id = f.building_id WHERE b.project_id = p.id) AS rooms,
      (SELECT COUNT(*)::int FROM updates u WHERE u.project_id = p.id) AS updates
    FROM projects p
    ORDER BY p.code
  `);

  return <AdminProjects initialProjects={rows} />;
}
