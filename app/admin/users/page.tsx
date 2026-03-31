import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import { query } from '@/lib/db';
import AdminUsers from '@/components/AdminUsers';

export default async function AdminUsersPage() {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const engineersResult = await query(`
    SELECT
      e.id,
      e.name,
      e.initials,
      e.avatar_color,
      COALESCE(
        json_agg(
          json_build_object('id', d.id, 'name', d.name)
          ORDER BY d.name
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'
      ) AS disciplines
    FROM engineers e
    LEFT JOIN engineer_disciplines ed ON e.id = ed.engineer_id
    LEFT JOIN disciplines d ON ed.discipline_id = d.id
    GROUP BY e.id, e.name, e.initials, e.avatar_color
    ORDER BY e.name
  `);

  const disciplinesResult = await query('SELECT id, name FROM disciplines ORDER BY name');

  return (
    <AdminUsers
      initialEngineers={engineersResult.rows}
      allDisciplines={disciplinesResult.rows}
    />
  );
}
