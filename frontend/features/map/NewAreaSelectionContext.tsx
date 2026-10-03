'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  calculateRoute,
  createField,
  CreateFieldPayload,
  RouteResponse,
} from '@/features/fields/fieldService';
import { buildInnerBoundaryCoordinates } from '@/features/coverage/headland';
import { calculateAreaHectares } from '@/features/map/geographicArea';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type FieldSettings = Omit<CreateFieldPayload, 'coordinates'>;

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
  areaHectares: number | null;
  saveError: string | null;
  saveStatus: SaveStatus;
  selection: AreaSelection | null;
  undoToken: number;
  workingWidthMeters: number;
  cancelSelection: () => void;
  requestUndoPoint: () => void;
  saveSelection: (fieldSettings: FieldSettings) => Promise<void>;
  setSelection: (selection: AreaSelection | null) => void;
  setWorkingWidthMeters: (workingWidthMeters: number) => void;
  startSelection: () => void;
}

const NewAreaSelectionContext = createContext<NewAreaSelectionContextValue | null>(null);

export function NewAreaSelectionProvider({ children }: { children: ReactNode }) {
  const [cancelToken, setCancelToken] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [areaHectares, setAreaHectares] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selection, setSelectionState] = useState<AreaSelection | null>(null);
  const [undoToken, setUndoToken] = useState(0);
  const [workingWidthMeters, setWorkingWidthMeters] = useState(6);

  const setSelection = useCallback((nextSelection: AreaSelection | null) => {
    setSelectionState(nextSelection);
    setAreaHectares(
      nextSelection?.isClosed
        ? calculateAreaHectares(nextSelection.coordinates)
        : null,
    );
    setSaveError(null);
    setSaveStatus('idle');
  }, []);

  const startSelection = useCallback(() => {
    setRoute(null);
    setAreaHectares(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectionState(null);
    setIsSelecting(true);
    setResetToken((token) => token + 1);
  }, []);

  const cancelSelection = useCallback(() => {
    setRoute(null);
    setAreaHectares(null);
    setSaveError(null);
    setSaveStatus('idle');
    setSelectionState(null);
    setIsSelecting(false);
    setCancelToken((token) => token + 1);
  }, []);

  const requestUndoPoint = useCallback(() => {
    setUndoToken((token) => token + 1);
  }, []);

  const saveSelection = useCallback(async (fieldSettings: FieldSettings) => {
    if (!selection?.isClosed || !selection.coordinates.length) return;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      const innerBoundaryCoordinates = buildInnerBoundaryCoordinates(
        selection.coordinates,
        fieldSettings.working_width,
      );

      if (!innerBoundaryCoordinates) {
        throw new Error('A bordadura consumiu toda a area selecionada. Reduza a largura de trabalho ou aumente o talhao.');
      }

      const field = await createField({
        ...fieldSettings,
        coordinates: innerBoundaryCoordinates,
        original_coordinates: selection.coordinates,
      });
      if (typeof field.area_hectares === 'number') {
        setAreaHectares(field.area_hectares);
      }
      const calculatedRoute = await calculateRoute(field.id);

      setRoute({
        ...calculatedRoute,
        original_coordinates: selection.coordinates,
        planning_coordinates: innerBoundaryCoordinates ?? undefined,
        working_width: fieldSettings.working_width,
      });
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
      areaHectares,
      saveError,
      saveSelection,
      saveStatus,
      selection,
      setSelection,
      setWorkingWidthMeters,
      startSelection,
      undoToken,
      workingWidthMeters,
    }),
    [
      cancelToken,
      cancelSelection,
      isSelecting,
      requestUndoPoint,
      resetToken,
      route,
      areaHectares,
      saveError,
      saveSelection,
      saveStatus,
      selection,
      setSelection,
      startSelection,
      undoToken,
      workingWidthMeters,
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
