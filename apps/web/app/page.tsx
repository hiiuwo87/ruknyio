import { redirect } from 'next/navigation';

export default function Home() {
  // In production the middleware handles this before we get here.
  // This fallback is only reached on localhost (path-based routing).
  redirect('/app');
}
