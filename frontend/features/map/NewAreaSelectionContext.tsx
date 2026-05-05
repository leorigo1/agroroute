'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { calculateRoute, createField, RouteResponse } from '@/features/fields/fieldService';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AreaSelection {
  coordinates: number[][];
  pointCount: number;
  isClosed: boolean;
}

interface NewAreaSelectionContextValue {
  cancelToken: number;
  isSelecting: boolean;
  resetToken: number;
  route: RouteResponse | null;
  saveError: string | null;
  saveStatus: SaveStatus;
  selection: AreaSelection | null;
  undoToken: number;
  cancelSelection: () => void;
  requestUndoPoint: () => void;
  saveSelection: () => Promise<void>;
  setSelection: (selection: AreaSelection | null) => void;
  startSelection: () => void;
}

const NewAreaSelectionContext = createContext<NewAreaSelectionContextValue | null>(null);

export function NewAreaSelectionProvider({ children }: { children: ReactNode }) {
  const [cancelToken, setCancelToken] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selection, setSelectionState] = useState<AreaSelection | null>(null);
  const [undoToken, setUndoToken] = useState(0);

  const setSelection = useCallback((nextSelection: AreaSelection | null) => {
    setSelectionState(nextSelection);
    setSaveError(null);
    setSaveStatus('idle');
  }, []);

  const startSelection = useCallback(() => {
    setRoute(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectionState(null);
    setIsSelecting(true);
    setResetToken((token) => token + 1);
  }, []);

  const cancelSelection = useCallback(() => {
    setRoute(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectionState(null);
    setIsSelecting(false);
    setCancelToken((token) => token + 1);
  }, []);

  const requestUndoPoint = useCallback(() => {
    setUndoToken((token) => token + 1);
  }, []);

  const saveSelection = useCallback(async () => {
    if (!selection?.isClosed || !selection.coordinates.length) return;

    const selectedPoints = selection.coordinates.slice(0, -1);
    window.alert(JSON.stringify(selectedPoints, null, 2));

    setSaveStatus('saving');
    setSaveError(null);

    try {
      const field = await createField({
        name: `Area ${new Date().toISOString()}`,
        coordinates: selection.coordinates,
        working_width: 6,
        speed_kmh: 8,
        fuel_per_km: 2.5,
      });
      const calculatedRoute = await calculateRoute(field.id);

      setRoute(calculatedRoute);
      setSaveStatus('saved');
      setIsSelecting(false);
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar selecao.');
    }
  }, [selection]);

  const value = useMemo(
    () => ({
      cancelToken,
      cancelSelection,
      isSelecting,
      requestUndoPoint,
      resetToken,
      route,
      saveError,
      saveSelection,
      saveStatus,
      selection,
      setSelection,
      startSelection,
      undoToken,
    }),
    [
      cancelToken,
      cancelSelection,
      isSelecting,
      requestUndoPoint,
      resetToken,
      route,
      saveError,
      saveSelection,
      saveStatus,
      selection,
      setSelection,
      startSelection,
      undoToken,
    ],
  );

  return (
    <NewAreaSelectionContext.Provider value={value}>
      {children}
    </NewAreaSelectionContext.Provider>
  );
}

export function useNewAreaSelection() {
  const context = useContext(NewAreaSelectionContext);

  if (!context) {
    throw new Error('useNewAreaSelection deve ser usado dentro de NewAreaSelectionProvider.');
  }

  return context;
}
