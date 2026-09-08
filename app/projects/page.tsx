import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import ProjectSelect from '@/components/ProjectSelect';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { rows } = await query(`
    SELECT
      p.id, p.code, p.name,
      (SELECT COUNT(*)::int FROM buildings b WHERE b.project_id = p.id) AS buildings,
      (SELECT COUNT(*)::int FROM rooms r
         JOIN floors f ON f.id = r.floor_id
         JOIN buildings b ON b.id = f.building_id WHERE b.project_id = p.id) AS rooms
    FROM projects p
    ORDER BY p.code
  `);

  return <ProjectSelect user={user} projects={rows} />;
}
