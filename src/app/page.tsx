import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/permissions';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  } else {
    redirect('/dashboard');
  }
}
