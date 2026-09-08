import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCurrentProjectId } from '@/lib/project';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const projectId = await getCurrentProjectId();
  redirect(projectId ? '/dashboard' : '/projects');
}
