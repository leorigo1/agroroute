'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNewAreaSelection } from '@/features/map/NewAreaSelectionContext';

export default function NewArea() {
  const router = useRouter();
  const {
    cancelSelection,
    isSelecting,
    requestUndoPoint,
    saveError,
    saveSelection,
    saveStatus,
    selection,
    startSelection,
  } = useNewAreaSelection();

  useEffect(() => {
    startSelection();

    return () => {
      cancelSelection();
    };
  }, [cancelSelection, startSelection]);

  const canSave = selection?.isClosed && saveStatus !== 'saving';

  return (
    <section className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-950">Nova area</h1>
        <p className="text-sm text-neutral-600">
          {selection?.isClosed
            ? 'Area fechada. Revise a selecao no mapa e salve quando estiver pronta.'
            : 'Clique no mapa para marcar os pontos. Clique no primeiro ponto para fechar a area.'}
        </p>
        {saveError ? <p className="mt-1 text-sm text-red-600">{saveError}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={cancelSelection}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isSelecting && !selection}
        >
          Cancelar selecao
        </button>
        <button
          type="button"
          onClick={requestUndoPoint}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isSelecting}
        >
          Desfazer ponto
        </button>
        <button
          type="button"
          onClick={startSelection}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Nova selecao
        </button>
        <button
          type="button"
          onClick={saveSelection}
          className="rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          disabled={!canSave}
        >
          {saveStatus === 'saving' ? 'Salvando...' : 'Salvar selecao'}
        </button>
        <button
          type="button"
          onClick={() => {router.replace('/');}}
          className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Voltar
        </button>
      </div>
    </section>
  );
}
