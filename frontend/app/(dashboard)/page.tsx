import LocateMeButton from '@/features/map/LocateMeButton';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-950">AgroRoute</h1>
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
      </div>
    </section>
  );
}
