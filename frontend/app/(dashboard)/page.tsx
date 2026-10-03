import LocateMeButton from '@/features/map/LocateMeButton';
import Link from 'next/link';
import PremiumAccessNotice from '@/features/subscriptions/PremiumAccessNotice';
import LogoutButton from '@/features/auth/LogoutButton';

export default function Dashboard() {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold text-neutral-950">AgroRoute</h1>
            <PremiumAccessNotice />
          </div>
          <p className="text-sm text-neutral-600">Visao geral</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LocateMeButton />
          <Link
            href="/subscription"
            className="rounded border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-50"
          >
            Minha assinatura
          </Link>
          <a
            href="/new/area"
            className="rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
          >
            Nova area
          </a>
          <LogoutButton />
        </div>
      </div>
    </section>
  );
}
