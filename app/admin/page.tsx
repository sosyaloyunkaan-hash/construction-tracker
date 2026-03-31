import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';

export default async function AdminPage() {
  const isAdmin = await verifyAdminToken();
  if (!isAdmin) {
    redirect('/admin/login');
  }
  redirect('/admin/users');
}
