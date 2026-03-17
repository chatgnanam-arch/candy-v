import { startTransition, useEffect, useRef, useState } from 'react';
import { createBoard, DEFAULT_GAME_CONFIG, getValidMoves, shuffleBoard as shuffleEngineBoard, trySwap } from '../game/engine';
import type { BoardState, GameConfig, PersistedProfile, Position, ResolveResult, ResolveStep, Swap } from '../game/types';
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

export type RunJournalEntry = {
  id: string;
  tone: 'spotlight' | 'strategy' | 'warning' | 'finish';
  title: string;
  detail: string;
  stat: string;
};

export type RunStats = {
  turnsPlayed: number;
  successfulTurns: number;
  hintsUsed: number;
  shufflesUsed: number;
  invalidSwaps: number;
  highestCascade: number;
  stripedMinted: number;
  prismsMinted: number;
  bestTurnScore: number;
};

type ControllerState = {
  board: BoardState;
  profile: PersistedProfile;
  effects: BurstEffect[];
  journal: RunJournalEntry[];
  runStats: RunStats;
  hintPositions: Position[];
  showTutorial: boolean;
  showSettings: boolean;
  isBusy: boolean;
  statusMessage: string | null;
};

export type GameController = ControllerState & {
  selectTile: (position: Position) => void;
  restartGame: () => void;
  shuffleBoard: () => void;
  showHint: () => void;
  dismissTutorial: () => void;
  openTutorial: () => void;
  toggleSettings: () => void;
  setPreference: (update: Partial<PersistedProfile>) => void;
};

export function useGameController(config: Partial<GameConfig> = {}): GameController {
  const configRef = useRef(config);
  const runIdRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);
  const journalIdRef = useRef(0);
  const [profile, setProfile] = useState<PersistedProfile>(() => loadProfile());
  const [board, setBoard] = useState<BoardState>(() => createFreshBoard(configRef.current));
  const [effects, setEffects] = useState<BurstEffect[]>([]);
  const [journal, setJournal] = useState<RunJournalEntry[]>(() => [createJournalEntry('spotlight', 'Fresh Tray', 'A new candy run is ready. Open the center of the board and start building specials.', 'Ready')]);
  const [runStats, setRunStats] = useState<RunStats>(() => createInitialRunStats());
  const [hintPositions, setHintPositions] = useState<Position[]>([]);
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

  function createJournalEntry(
    tone: RunJournalEntry['tone'],
    title: string,
    detail: string,
    stat: string,
  ): RunJournalEntry {
    journalIdRef.current += 1;
    return {
      id: `journal-${journalIdRef.current}`,
      tone,
      title,
      detail,
      stat,
    };
  }

  function pushJournal(entry: RunJournalEntry): void {
    setJournal((current) => [entry, ...current].slice(0, 4));
  }

  function restartGame(): void {
    const freshBoard = createFreshBoard(configRef.current);
    runIdRef.current += 1;
    setEffects([]);
    setHintPositions([]);
    setIsBusy(false);
    setShowSettings(false);
    setStatusMessage(null);
    setRunStats(createInitialRunStats());
    commitBoard(freshBoard);
    pushJournal(
      createJournalEntry(
        'spotlight',
        'Fresh Tray',
        'A brand-new candy board is on deck. Use early turns to open the center and spot your first special.',
        `${freshBoard.movesRemaining} moves`,
      ),
    );
  }

  function shuffleBoard(): void {
    if (isBusy) {
      return;
    }

    runIdRef.current += 1;
    setEffects([]);
    setHintPositions([]);
    setIsBusy(false);
    setShowTutorial(false);
    setRunStats((current) => ({
      ...current,
      shufflesUsed: current.shufflesUsed + 1,
    }));
    const shuffledBoard = shuffleEngineBoard(boardRef.current);
    commitBoard(shuffledBoard);
    pushJournal(
      createJournalEntry(
        'strategy',
        'Tray Remixed',
        'The candies were reshuffled to reopen new scoring lanes and cleaner special setups.',
        `${getValidMoves(shuffledBoard).length} swaps`,
      ),
    );
    showStatus('Board shuffled for a new combo path.');
  }

  function showHint(): void {
    const current = boardRef.current;
    if (isBusy || current.result) {
      return;
    }

    setRunStats((stats) => ({
      ...stats,
      hintsUsed: stats.hintsUsed + 1,
    }));

    const validMoves = getValidMoves(current);
    if (validMoves.length === 0) {
      setHintPositions([]);
      pushJournal(
        createJournalEntry(
          'warning',
          'Hint Blocked',
          'There is no legal move to highlight right now, so a shuffle is the quickest way to reopen the tray.',
          '0 swaps',
        ),
      );
      showStatus('No hint available right now. Try a shuffle to refresh the tray.');
      return;
    }

    const hint = validMoves[0];
    setHintPositions([hint.from, hint.to]);
    pushJournal(
      createJournalEntry(
        'strategy',
        'Hint Lit',
        `A scoring lane is highlighted from row ${hint.from.row + 1}, column ${hint.from.col + 1}.`,
        formatLaneLabel(hint),
      ),
    );
    showStatus(`Hint ready: try row ${hint.from.row + 1}, column ${hint.from.col + 1}.`);
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

    setHintPositions([]);

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
    setHintPositions([]);
    setIsBusy(true);
    commitBoard(swapAttempt.previewBoard);

    void playSwapSequence(runId, swapAttempt, {
      from: currentlySelected,
      to: position,
    });
  }

  async function playSwapSequence(
    runId: number,
    swapAttempt: ReturnType<typeof trySwap>,
    swap: Swap,
  ): Promise<void> {
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
      pushJournal(
        createJournalEntry(
          'warning',
          'Swap Bounced',
          'That move did not create a match. Try a center-board turn or tap Hint for a quick nudge.',
          'No score',
        ),
      );
      setRunStats((current) => ({
        ...current,
        invalidSwaps: current.invalidSwaps + 1,
      }));
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

    const resolveResult = swapAttempt.resolveResult;
    commitBoard(resolveResult.board);
    const resolveSummary = getResolveSummary(resolveResult);
    pushJournal(summarizeResolveResult(createJournalEntry, resolveResult, swap, resolveSummary));
    setRunStats((current) => ({
      ...current,
      turnsPlayed: current.turnsPlayed + 1,
      successfulTurns: current.successfulTurns + 1,
      highestCascade: Math.max(current.highestCascade, resolveSummary.highestCascade),
      stripedMinted: current.stripedMinted + resolveSummary.stripedMinted,
      prismsMinted: current.prismsMinted + resolveSummary.prismsMinted,
      bestTurnScore: Math.max(current.bestTurnScore, resolveResult.totalScore),
    }));
    if (resolveResult.autoShuffled) {
      pushJournal(
        createJournalEntry(
          'warning',
          'Auto Shuffle',
          'No legal swaps remained after the turn, so the tray was refreshed automatically.',
          `${getValidMoves(resolveResult.board).length} swaps`,
        ),
      );
      showStatus('No moves left, so the board was shuffled automatically.');
    }
    if (resolveResult.board.result) {
      pushJournal(
        createJournalEntry(
          'finish',
          resolveResult.board.result.outcome === 'won' ? 'Target Cracked' : 'Run Closed',
          resolveResult.board.result.outcome === 'won'
            ? 'You cleared the score gate before the jar ran dry.'
            : 'The move jar is empty, but the next tray is ready when you are.',
          `${resolveResult.board.result.finalScore.toLocaleString()} pts`,
        ),
      );
    }
    setIsBusy(false);
  }

  return {
    board,
    profile,
    effects,
    journal,
    runStats,
    hintPositions,
    showTutorial,
    showSettings,
    isBusy,
    statusMessage,
    selectTile,
    restartGame,
    shuffleBoard,
    showHint,
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

function createInitialRunStats(): RunStats {
  return {
    turnsPlayed: 0,
    successfulTurns: 0,
    hintsUsed: 0,
    shufflesUsed: 0,
    invalidSwaps: 0,
    highestCascade: 0,
    stripedMinted: 0,
    prismsMinted: 0,
    bestTurnScore: 0,
  };
}

function getResolveSummary(result: ResolveResult): {
  stripedMinted: number;
  prismsMinted: number;
  highestCascade: number;
} {
  const matchedGroups = result.steps.flatMap((step) => step.matchedGroups);

  return {
    stripedMinted: matchedGroups.filter(
      (group) => group.createdSpecial === 'stripedH' || group.createdSpecial === 'stripedV',
    ).length,
    prismsMinted: matchedGroups.filter((group) => group.createdSpecial === 'colorBomb').length,
    highestCascade: Math.max(...result.steps.map((step) => step.cascade), 0),
  };
}

function summarizeResolveResult(
  createEntry: (
    tone: RunJournalEntry['tone'],
    title: string,
    detail: string,
    stat: string,
  ) => RunJournalEntry,
  result: ResolveResult,
  swap: Swap,
  resolveSummary: {
    stripedMinted: number;
    prismsMinted: number;
    highestCascade: number;
  },
): RunJournalEntry {
  const firstSwap = inferSwapLane(swap);

  if (resolveSummary.prismsMinted > 0) {
    return createEntry(
      'finish',
      'Prism Crafted',
      `A five-match landed and created a prism candy. This is a great time to save it for a crowded board swing.`,
      `${result.totalScore.toLocaleString()} pts`,
    );
  }

  if (resolveSummary.stripedMinted > 0) {
    return createEntry(
      'spotlight',
      'Stripe Minted',
      `A four-match paid off and built a striped candy. ${firstSwap ? `The winning turn started on ${firstSwap}.` : 'The lane is open for a follow-up clear.'}`,
      `${result.steps.length} cascade${result.steps.length === 1 ? '' : 's'}`,
    );
  }

  if (result.steps.length > 1) {
    return createEntry(
      'strategy',
      'Cascade Chain',
      `That swap rolled into ${result.steps.length} clears in a row, which is exactly the kind of gravity turn that snowballs a run.`,
      `+${result.totalScore.toLocaleString()}`,
    );
  }

  return createEntry(
    'spotlight',
    'Clean Clear',
    `A steady scoring turn landed${firstSwap ? ` on ${firstSwap}` : ''}. Keep the center loose and the next special will be easier to spot.`,
    `+${result.totalScore.toLocaleString()}`,
  );
}

function formatLaneLabel(swap: Swap): string {
  if (swap.from.row === swap.to.row) {
    return `R${swap.from.row + 1} C${Math.min(swap.from.col, swap.to.col) + 1}-${Math.max(swap.from.col, swap.to.col) + 1}`;
  }

  return `C${swap.from.col + 1} R${Math.min(swap.from.row, swap.to.row) + 1}-${Math.max(swap.from.row, swap.to.row) + 1}`;
}

function inferSwapLane(swap: Swap): string {
  if (swap.from.row === swap.to.row) {
    return `row ${swap.from.row + 1}`;
  }

  return `column ${swap.from.col + 1}`;
}
