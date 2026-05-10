'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNewAreaSelection } from '@/features/map/NewAreaSelectionContext';

export default function NewArea() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [workingWidth, setWorkingWidth] = useState('6');
  const [speedKmh, setSpeedKmh] = useState('8');
  const [fuelPerKm, setFuelPerKm] = useState('2.5');
  const {
    cancelSelection,
    isSelecting,
    requestUndoPoint,
    saveError,
    saveSelection,
    saveStatus,
    selection,
    setWorkingWidthMeters,
    startSelection,
  } = useNewAreaSelection();

  useEffect(() => {
    startSelection();

    return () => {
      cancelSelection();
    };
  }, [cancelSelection, startSelection]);

  const fieldSettings = useMemo(() => ({
    fuel_per_km: Number(fuelPerKm),
    name: name.trim(),
    speed_kmh: Number(speedKmh),
    working_width: Number(workingWidth),
  }), [fuelPerKm, name, speedKmh, workingWidth]);

  useEffect(() => {
    setWorkingWidthMeters(fieldSettings.working_width);
  }, [fieldSettings.working_width, setWorkingWidthMeters]);

  const hasValidSettings =
    fieldSettings.name.length > 0 &&
    fieldSettings.working_width > 0 &&
    fieldSettings.speed_kmh > 0 &&
    fieldSettings.fuel_per_km >= 0;
  const canSave = selection?.isClosed && hasValidSettings && saveStatus !== 'saving';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    void saveSelection(fieldSettings);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-950">Nova area</h1>
        <p className="text-sm text-neutral-600">
          {selection?.isClosed
            ? 'Area fechada. Revise a selecao no mapa e salve quando estiver pronta.'
            : 'Clique no mapa para marcar os pontos. Clique no primeiro ponto para fechar a area.'}
        </p>
        {saveError ? <p className="mt-1 text-sm text-red-600">{saveError}</p> : null}
        {saveStatus === 'saved' ? (
          <p className="mt-1 text-sm text-green-700">Area salva e rota calculada.</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs font-medium text-neutral-700">
          Nome
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-green-700"
            placeholder="Talhao 1"
            required
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Largura (m)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={workingWidth}
            onChange={(event) => setWorkingWidth(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-green-700"
            required
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Velocidade (km/h)
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={speedKmh}
            onChange={(event) => setSpeedKmh(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-green-700"
            required
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Combustivel (L/hr)
          <input
            type="number"
            min="0"
            step="0.1"
            value={fuelPerKm}
            onChange={(event) => setFuelPerKm(event.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-green-700"
            required
          />
        </label>
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
          type="submit"
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
    </form>
  );
}
