import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import AdminLoginForm from '@/components/AdminLoginForm';

export default async function AdminLoginPage() {
  const isAdmin = await verifyAdminToken();
  if (isAdmin) {
    redirect('/admin/users');
  }
  return <AdminLoginForm />;
}
