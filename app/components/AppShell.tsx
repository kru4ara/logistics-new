import { getSessionContext } from '../../lib/session';
import { cookies } from 'next/headers';
import AppShellClient from './AppShellClient';

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const { role } = await getSessionContext();
  const cookieStore = await cookies();

  const rawName = cookieStore.get('user_name')?.value;
  const userName = rawName ? decodeURIComponent(rawName) : '';

  return (
    <AppShellClient role={role} userName={userName}>
      {children}
    </AppShellClient>
  );
}
