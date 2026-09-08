import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentProject } from '@/lib/project';
import Dashboard from '@/components/Dashboard';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const project = await getCurrentProject();
  if (!project) redirect('/projects');

  return <Dashboard user={user} project={project} />;
}
