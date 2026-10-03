'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('agroroute_token');
    window.dispatchEvent(new Event('agroroute-auth-change'));
    router.replace('/login');
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
    >
      Sair
    </button>
  );
}
