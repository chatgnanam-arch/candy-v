import { startTransition, useEffect, useRef, useState } from 'react';
import { createBoard, DEFAULT_GAME_CONFIG, shuffleBoard as shuffleEngineBoard, trySwap } from '../game/engine';
import type { BoardState, GameConfig, PersistedProfile, Position, ResolveStep } from '../game/types';
import { loadProfile, saveProfile } from '../lib/storage';

const SWAP_DURATION_MS = 220;
const CLEAR_DURATION_MS = 180;
const SETTLE_DURATION_MS = 240;
const INVALID_SWAP_DURATION_MS = 180;

export type BurstEffect = {
  key: string;
  row: number;
  col: number;
  color: string;
  special: string | null;
  cascade: number;
};

type ControllerState = {
  board: BoardState;
  profile: PersistedProfile;
  effects: BurstEffect[];
  showTutorial: boolean;
  showSettings: boolean;
  isBusy: boolean;
  statusMessage: string | null;
};

export type GameController = ControllerState & {
  selectTile: (position: Position) => void;
  restartGame: () => void;
  shuffleBoard: () => void;
  dismissTutorial: () => void;
  openTutorial: () => void;
  toggleSettings: () => void;
  setPreference: (update: Partial<PersistedProfile>) => void;
};

export function useGameController(config: Partial<GameConfig> = {}): GameController {
  const configRef = useRef(config);
  const runIdRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);
  const [profile, setProfile] = useState<PersistedProfile>(() => loadProfile());
  const [board, setBoard] = useState<BoardState>(() => createFreshBoard(configRef.current));
  const [effects, setEffects] = useState<BurstEffect[]>([]);
  const [showTutorial, setShowTutorial] = useState(() => !loadProfile().tutorialDismissed);
  const [showSettings, setShowSettings] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const boardRef = useRef(board);
  const profileRef = useRef(profile);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    profileRef.current = profile;
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (board.score > profile.bestScore) {
      setProfile((current) => ({
        ...current,
        bestScore: board.score,
      }));
    }
  }, [board.score, profile.bestScore]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
      runIdRef.current += 1;
    };
  }, []);

  function commitBoard(nextBoard: BoardState): void {
    boardRef.current = nextBoard;
    startTransition(() => {
      setBoard(nextBoard);
    });
  }

  function patchBoard(update: Partial<BoardState>): void {
    const current = boardRef.current;
    commitBoard({
      ...current,
      ...update,
      grid: update.grid ? update.grid.map((row) => row.slice()) : current.grid.map((row) => row.slice()),
      palette: update.palette ? [...update.palette] : [...current.palette],
    });
  }

  function showStatus(message: string): void {
    setStatusMessage(message);
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
    }, 1800);
  }

  function restartGame(): void {
    runIdRef.current += 1;
    setEffects([]);
    setIsBusy(false);
    setShowSettings(false);
    setStatusMessage(null);
    commitBoard(createFreshBoard(configRef.current));
  }

  function shuffleBoard(): void {
    if (isBusy) {
      return;
    }

    runIdRef.current += 1;
    setEffects([]);
    setIsBusy(false);
    setShowTutorial(false);
    commitBoard(shuffleEngineBoard(boardRef.current));
    showStatus('Board shuffled for a new combo path.');
  }

  function dismissTutorial(): void {
    setShowTutorial(false);
    setProfile((current) => ({
      ...current,
      tutorialDismissed: true,
    }));
  }

  function openTutorial(): void {
    setShowSettings(false);
    setShowTutorial(true);
  }

  function toggleSettings(): void {
    setShowTutorial(false);
    setShowSettings((current) => !current);
  }

  function setPreference(update: Partial<PersistedProfile>): void {
    setProfile((current) => ({
      ...current,
      ...update,
    }));
  }

  function selectTile(position: Position): void {
    const current = boardRef.current;

    if (isBusy || current.result) {
      return;
    }

    const currentlySelected = current.selected;
    if (!currentlySelected) {
      patchBoard({ selected: position });
      return;
    }

    if (currentlySelected.row === position.row && currentlySelected.col === position.col) {
      patchBoard({ selected: null });
      return;
    }

    if (!isAdjacent(currentlySelected, position)) {
      patchBoard({ selected: position });
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    const swapAttempt = trySwap(current, {
      from: currentlySelected,
      to: position,
    });

    setEffects([]);
    setIsBusy(true);
    commitBoard(swapAttempt.previewBoard);

    void playSwapSequence(runId, swapAttempt);
  }

  async function playSwapSequence(runId: number, swapAttempt: ReturnType<typeof trySwap>): Promise<void> {
    const motionScale = profileRef.current.reducedMotion ? 0.4 : 1;
    await delay(SWAP_DURATION_MS * motionScale);

    if (runId !== runIdRef.current) {
      return;
    }

    if (!swapAttempt.valid || !swapAttempt.resolveResult) {
      if (swapAttempt.revertBoard) {
        commitBoard(swapAttempt.revertBoard);
      }
      await delay(INVALID_SWAP_DURATION_MS * motionScale);
      if (runId !== runIdRef.current) {
        return;
      }
      setIsBusy(false);
      return;
    }

    let visibleBoard = swapAttempt.previewBoard;
    for (const step of swapAttempt.resolveResult.steps) {
      if (runId !== runIdRef.current) {
        return;
      }

      setEffects(buildEffects(visibleBoard, step));
      await delay(CLEAR_DURATION_MS * motionScale);

      if (runId !== runIdRef.current) {
        return;
      }

      commitBoard(step.board);
      visibleBoard = step.board;
      setEffects([]);
      await delay(SETTLE_DURATION_MS * motionScale);
    }

    if (runId !== runIdRef.current) {
      return;
    }

    commitBoard(swapAttempt.resolveResult.board);
    if (swapAttempt.resolveResult.autoShuffled) {
      showStatus('No moves left, so the board was shuffled automatically.');
    }
    setIsBusy(false);
  }

  return {
    board,
    profile,
    effects,
    showTutorial,
    showSettings,
    isBusy,
    statusMessage,
    selectTile,
    restartGame,
    shuffleBoard,
    dismissTutorial,
    openTutorial,
    toggleSettings,
    setPreference,
  };
}

function createFreshBoard(config: Partial<GameConfig>): BoardState {
  return createBoard({
    ...DEFAULT_GAME_CONFIG,
    ...config,
    seed: Date.now() >>> 0,
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function isAdjacent(from: Position, to: Position): boolean {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
}

function buildEffects(board: BoardState, step: ResolveStep): BurstEffect[] {
  return step.clearedPositions.map((position) => {
    const tile = board.grid[position.row][position.col];
    return {
      key: `${step.cascade}-${position.row}-${position.col}`,
      row: position.row,
      col: position.col,
      color: tile?.color ?? 'prism',
      special: tile?.special ?? null,
      cascade: step.cascade,
    };
  });
}
