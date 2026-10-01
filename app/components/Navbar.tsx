import { cookies } from 'next/headers';
import NavbarClient from './NavbarClient';

export default function Navbar() {
  const cookieStore = cookies();

  const role = cookieStore.get('role')?.value ?? null;
  const rawName = cookieStore.get('user_name')?.value;
  const userName = rawName ? decodeURIComponent(rawName) : '';

  return <NavbarClient role={role} userName={userName} />;
}
