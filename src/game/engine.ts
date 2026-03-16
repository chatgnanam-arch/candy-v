import type {
  BoardState,
  GameConfig,
  GameResult,
  MatchGroup,
  MatchOrientation,
  NormalTileColor,
  Position,
  ResolveResult,
  ResolveStep,
  SpecialTileType,
  Swap,
  SwapAttempt,
  Tile,
} from './types';

const DEFAULT_PALETTE: NormalTileColor[] = [
  'strawberry',
  'tangerine',
  'blueberry',
  'mint',
  'grape',
  'peach',
];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  rows: 8,
  columns: 8,
  startingMoves: 24,
  targetScore: 4200,
  palette: DEFAULT_PALETTE,
  seed: 1,
};

type ResolvedConfig = GameConfig;

type ResolveContext = {
  triggerSwap?: Swap;
  forcedClearPositions?: Position[];
};

type SpawnInstruction = {
  position: Position;
  special: SpecialTileType;
  color: NormalTileColor;
};

type RandomResult<T> = {
  value: T;
  seed: number;
};

export function createBoard(config: Partial<GameConfig> = {}): BoardState {
  const resolved = resolveConfig(config);
  let seed = resolved.seed;
  let nextTileId = 1;

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const grid: BoardState['grid'] = Array.from({ length: resolved.rows }, () =>
      Array.from({ length: resolved.columns }, () => null),
    );

    for (let row = 0; row < resolved.rows; row += 1) {
      for (let col = 0; col < resolved.columns; col += 1) {
        const blockedColors = new Set<NormalTileColor>();

        if (
          col >= 2 &&
          grid[row][col - 1]?.color === grid[row][col - 2]?.color &&
          grid[row][col - 1]?.color !== 'prism'
        ) {
          blockedColors.add(grid[row][col - 1]!.color as NormalTileColor);
        }

        if (
          row >= 2 &&
          grid[row - 1][col]?.color === grid[row - 2][col]?.color &&
          grid[row - 1][col]?.color !== 'prism'
        ) {
          blockedColors.add(grid[row - 1][col]!.color as NormalTileColor);
        }

        const availableColors = resolved.palette.filter((color) => !blockedColors.has(color));
        const choice = pickRandom(availableColors.length > 0 ? availableColors : resolved.palette, seed);
        seed = choice.seed;
        grid[row][col] = createTile(choice.value, null, nextTileId);
        nextTileId += 1;
      }
    }

    const board = makeBoardState({
      grid,
      rows: resolved.rows,
      columns: resolved.columns,
      score: 0,
      movesRemaining: resolved.startingMoves,
      targetScore: resolved.targetScore,
      phase: 'ready',
      selected: null,
      result: null,
      palette: resolved.palette,
      seed,
      nextTileId,
    });

    if (getValidMoves(board).length > 0) {
      return board;
    }
  }

  throw new Error('Unable to generate a playable board.');
}

export function getValidMoves(board: BoardState): Swap[] {
  const validMoves: Swap[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.columns; col += 1) {
      const from = { row, col };

      for (const to of [
        { row, col: col + 1 },
        { row: row + 1, col },
      ]) {
        if (!isInside(board, to)) {
          continue;
        }

        const attempt = simulateSwap(board, { from, to });
        if (attempt) {
          validMoves.push({ from, to });
        }
      }
    }
  }

  return validMoves;
}

export function trySwap(board: BoardState, swap: Swap): SwapAttempt {
  if (!isInside(board, swap.from) || !isInside(board, swap.to) || !isAdjacent(swap.from, swap.to)) {
    return {
      valid: false,
      previewBoard: cloneBoard(board, { phase: 'ready', selected: null }),
      revertBoard: cloneBoard(board, { phase: 'ready', selected: null }),
      resolveResult: null,
    };
  }

  const previewBoard = cloneBoard(board, {
    grid: swapGrid(board.grid, swap),
    phase: 'swapping',
    selected: null,
  });

  const comboClear = buildColorBombCombo(previewBoard, swap);
  const hasMatch = comboClear.length > 0 || findMatches(previewBoard.grid).length > 0;

  if (!hasMatch) {
    return {
      valid: false,
      previewBoard,
      revertBoard: cloneBoard(board, { phase: 'ready', selected: null }),
      resolveResult: null,
    };
  }

  const resolved = resolveBoard(previewBoard, {
    triggerSwap: swap,
    forcedClearPositions: comboClear.length > 0 ? comboClear : undefined,
  });

  const consumedMoveBoard = cloneBoard(resolved.board, {
    movesRemaining: Math.max(0, board.movesRemaining - 1),
  });
  const result = evaluateResult(consumedMoveBoard);

  let finalBoard = cloneBoard(consumedMoveBoard, {
    result,
    phase: result ? 'gameOver' : 'ready',
  });

  let autoShuffled = resolved.autoShuffled;
  if (!finalBoard.result && getValidMoves(finalBoard).length === 0) {
    finalBoard = cloneBoard(shuffleBoard(finalBoard), {
      phase: 'ready',
      result: null,
      selected: null,
    });
    autoShuffled = true;
  }

  return {
    valid: true,
    previewBoard,
    revertBoard: null,
    resolveResult: {
      ...resolved,
      autoShuffled,
      board: finalBoard,
    },
  };
}

export function resolveBoard(board: BoardState, context: ResolveContext = {}): ResolveResult {
  let workingBoard = cloneBoard(board, { phase: 'resolving' });
  const steps: ResolveStep[] = [];
  let totalScore = 0;
  let autoShuffled = false;
  let cascade = 0;
  let pendingForcedClear =
    context.forcedClearPositions && context.forcedClearPositions.length > 0
      ? context.forcedClearPositions
      : undefined;

  while (true) {
    cascade += 1;
    const groups = pendingForcedClear ? [] : findMatches(workingBoard.grid, context.triggerSwap);
    let clearSet = new Set<string>(
      (pendingForcedClear ?? groups.flatMap((group) => group.positions)).map(positionKey),
    );

    if (clearSet.size === 0) {
      break;
    }

    const spawns = buildSpawnInstructions(groups, context.triggerSwap);
    for (const spawn of spawns) {
      clearSet.delete(positionKey(spawn.position));
    }

    clearSet = expandClearSet(workingBoard, clearSet);
    const clearedPositions = Array.from(clearSet, parsePositionKey);
    const scoreDelta = calculateScore(workingBoard, clearedPositions, cascade);
    const collapsed = collapseBoard(workingBoard, clearSet, spawns);

    workingBoard = cloneBoard(collapsed, {
      score: collapsed.score + scoreDelta,
      phase: 'resolving',
      selected: null,
    });

    totalScore += scoreDelta;
    steps.push({
      clearedPositions,
      matchedGroups: groups,
      board: workingBoard,
      cascade,
      scoreDelta,
    });

    pendingForcedClear = undefined;
    context = {};
  }

  if (steps.length === 0) {
    const result = evaluateResult(workingBoard);
    return {
      board: cloneBoard(workingBoard, {
        result,
        phase: result ? 'gameOver' : 'ready',
      }),
      steps,
      totalScore,
      autoShuffled,
    };
  }

  let finalBoard = cloneBoard(workingBoard, {
    result: evaluateResult(workingBoard),
    phase: 'ready',
  });

  if (!finalBoard.result && getValidMoves(finalBoard).length === 0) {
    finalBoard = shuffleBoard(finalBoard);
    autoShuffled = true;
  }

  return {
    board: cloneBoard(finalBoard, {
      phase: finalBoard.result ? 'gameOver' : 'ready',
    }),
    steps,
    totalScore,
    autoShuffled,
  };
}

export function shuffleBoard(board: BoardState): BoardState {
  const tiles = board.grid.flat().filter((tile): tile is Tile => tile !== null);
  let seed = board.seed;

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const shuffled = [...tiles];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const pick = randomInt(seed, index + 1);
      seed = pick.seed;
      const targetIndex = pick.value;
      [shuffled[index], shuffled[targetIndex]] = [shuffled[targetIndex], shuffled[index]];
    }

    const grid: BoardState['grid'] = Array.from({ length: board.rows }, () =>
      Array.from({ length: board.columns }, () => null),
    );

    let tileIndex = 0;
    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.columns; col += 1) {
        grid[row][col] = shuffled[tileIndex] ?? null;
        tileIndex += 1;
      }
    }

    const candidate = cloneBoard(board, {
      grid,
      seed,
      phase: 'shuffling',
      selected: null,
    });

    if (findMatches(candidate.grid).length === 0 && getValidMoves(candidate).length > 0) {
      return cloneBoard(candidate, { phase: 'ready' });
    }
  }

  const regenerated = createBoard({
    rows: board.rows,
    columns: board.columns,
    startingMoves: board.movesRemaining,
    targetScore: board.targetScore,
    palette: board.palette,
    seed,
  });

  return cloneBoard(regenerated, {
    score: board.score,
    movesRemaining: board.movesRemaining,
    result: board.result,
    selected: null,
  });
}

function resolveConfig(config: Partial<GameConfig>): ResolvedConfig {
  return {
    ...DEFAULT_GAME_CONFIG,
    ...config,
    palette: config.palette ?? DEFAULT_GAME_CONFIG.palette,
    seed: config.seed ?? DEFAULT_GAME_CONFIG.seed,
  };
}

function makeBoardState(board: BoardState): BoardState {
  return {
    ...board,
    grid: board.grid.map((row) => row.slice()),
    palette: [...board.palette],
  };
}

function cloneBoard(board: BoardState, overrides: Partial<BoardState> = {}): BoardState {
  return makeBoardState({
    ...board,
    ...overrides,
    grid: overrides.grid ? overrides.grid.map((row) => row.slice()) : board.grid.map((row) => row.slice()),
    palette: overrides.palette ? [...overrides.palette] : [...board.palette],
  });
}

function createTile(color: NormalTileColor | 'prism', special: SpecialTileType | null, nextTileId: number): Tile {
  return {
    id: `tile-${nextTileId}`,
    color,
    special,
  };
}

function nextRandom(seed: number): RandomResult<number> {
  const nextSeed = (seed * 1664525 + 1013904223) >>> 0;
  return {
    value: nextSeed / 4294967296,
    seed: nextSeed,
  };
}

function randomInt(seed: number, max: number): RandomResult<number> {
  const next = nextRandom(seed);
  return {
    value: Math.floor(next.value * max),
    seed: next.seed,
  };
}

function pickRandom<T>(items: readonly T[], seed: number): RandomResult<T> {
  const pick = randomInt(seed, items.length);
  return {
    value: items[pick.value],
    seed: pick.seed,
  };
}

function isInside(board: BoardState, position: Position): boolean {
  return position.row >= 0 && position.row < board.rows && position.col >= 0 && position.col < board.columns;
}

function isAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swapGrid(grid: BoardState['grid'], swap: Swap): BoardState['grid'] {
  const nextGrid = grid.map((row) => row.slice());
  const fromTile = nextGrid[swap.from.row][swap.from.col];
  const toTile = nextGrid[swap.to.row][swap.to.col];
  nextGrid[swap.from.row][swap.from.col] = toTile;
  nextGrid[swap.to.row][swap.to.col] = fromTile;
  return nextGrid;
}

function simulateSwap(board: BoardState, swap: Swap): boolean {
  const previewBoard = cloneBoard(board, { grid: swapGrid(board.grid, swap), selected: null });
  if (buildColorBombCombo(previewBoard, swap).length > 0) {
    return true;
  }

  return findMatches(previewBoard.grid).length > 0;
}

function buildColorBombCombo(board: BoardState, swap: Swap): Position[] {
  const fromTile = board.grid[swap.from.row][swap.from.col];
  const toTile = board.grid[swap.to.row][swap.to.col];

  if (!fromTile || !toTile) {
    return [];
  }

  const fromIsBomb = fromTile.special === 'colorBomb';
  const toIsBomb = toTile.special === 'colorBomb';

  if (!fromIsBomb && !toIsBomb) {
    return [];
  }

  if (fromIsBomb && toIsBomb) {
    return board.grid.flatMap((row, rowIndex) =>
      row.flatMap((tile, colIndex) => (tile ? [{ row: rowIndex, col: colIndex }] : [])),
    );
  }

  const targetTile = fromIsBomb ? toTile : fromTile;
  const targetColor = targetTile.color === 'prism' ? null : targetTile.color;

  return board.grid.flatMap((row, rowIndex) =>
    row.flatMap((tile, colIndex) => {
      if (!tile) {
        return [];
      }

      const isBombCell =
        (rowIndex === swap.from.row && colIndex === swap.from.col) ||
        (rowIndex === swap.to.row && colIndex === swap.to.col);

      if (isBombCell) {
        return [{ row: rowIndex, col: colIndex }];
      }

      if (targetColor && tile.color === targetColor) {
        return [{ row: rowIndex, col: colIndex }];
      }

      return [];
    }),
  );
}

function findMatches(grid: BoardState['grid'], triggerSwap?: Swap): MatchGroup[] {
  const groups: MatchGroup[] = [];

  for (let row = 0; row < grid.length; row += 1) {
    let startCol = 0;

    while (startCol < grid[row].length) {
      const tile = grid[row][startCol];
      if (!tile || tile.color === 'prism') {
        startCol += 1;
        continue;
      }

      let endCol = startCol + 1;
      while (endCol < grid[row].length && grid[row][endCol]?.color === tile.color) {
        endCol += 1;
      }

      const length = endCol - startCol;
      if (length >= 3) {
        groups.push({
          positions: Array.from({ length }, (_, index) => ({ row, col: startCol + index })),
          orientation: 'horizontal',
          color: tile.color,
          length,
          createdSpecial: determineCreatedSpecial(length, 'horizontal'),
        });
      }

      startCol = endCol;
    }
  }

  for (let col = 0; col < grid[0].length; col += 1) {
    let startRow = 0;

    while (startRow < grid.length) {
      const tile = grid[startRow][col];
      if (!tile || tile.color === 'prism') {
        startRow += 1;
        continue;
      }

      let endRow = startRow + 1;
      while (endRow < grid.length && grid[endRow][col]?.color === tile.color) {
        endRow += 1;
      }

      const length = endRow - startRow;
      if (length >= 3) {
        groups.push({
          positions: Array.from({ length }, (_, index) => ({ row: startRow + index, col })),
          orientation: 'vertical',
          color: tile.color,
          length,
          createdSpecial: determineCreatedSpecial(length, 'vertical'),
        });
      }

      startRow = endRow;
    }
  }

  if (!triggerSwap) {
    return groups;
  }

  return groups.sort((left, right) => {
    const leftHasTrigger = left.positions.some((position) => positionEquals(position, triggerSwap.to));
    const rightHasTrigger = right.positions.some((position) => positionEquals(position, triggerSwap.to));
    return Number(rightHasTrigger) - Number(leftHasTrigger);
  });
}

function determineCreatedSpecial(length: number, orientation: MatchOrientation): SpecialTileType | null {
  if (length >= 5) {
    return 'colorBomb';
  }

  if (length === 4) {
    return orientation === 'horizontal' ? 'stripedH' : 'stripedV';
  }

  return null;
}

function buildSpawnInstructions(groups: MatchGroup[], triggerSwap?: Swap): SpawnInstruction[] {
  const byPosition = new Map<string, SpawnInstruction>();

  for (const group of groups) {
    if (!group.createdSpecial) {
      continue;
    }

    const preferredPosition = pickSpawnPosition(group, triggerSwap);
    const key = positionKey(preferredPosition);
    const nextInstruction: SpawnInstruction = {
      position: preferredPosition,
      special: group.createdSpecial,
      color: group.color,
    };
    const currentInstruction = byPosition.get(key);

    if (!currentInstruction || specialPriority(nextInstruction.special) > specialPriority(currentInstruction.special)) {
      byPosition.set(key, nextInstruction);
    }
  }

  return Array.from(byPosition.values());
}

function pickSpawnPosition(group: MatchGroup, triggerSwap?: Swap): Position {
  if (triggerSwap) {
    const preferred = group.positions.find(
      (position) => positionEquals(position, triggerSwap.to) || positionEquals(position, triggerSwap.from),
    );
    if (preferred) {
      return preferred;
    }
  }

  return group.positions[Math.floor(group.positions.length / 2)];
}

function specialPriority(special: SpecialTileType): number {
  switch (special) {
    case 'colorBomb':
      return 3;
    case 'stripedH':
    case 'stripedV':
      return 2;
    default:
      return 1;
  }
}

function expandClearSet(board: BoardState, seedSet: Set<string>): Set<string> {
  const expanded = new Set(seedSet);
  const queue = Array.from(seedSet, parsePositionKey);

  while (queue.length > 0) {
    const position = queue.shift()!;
    const tile = board.grid[position.row][position.col];

    if (!tile) {
      continue;
    }

    if (tile.special === 'stripedH') {
      for (let col = 0; col < board.columns; col += 1) {
        const next = { row: position.row, col };
        const key = positionKey(next);
        if (!expanded.has(key)) {
          expanded.add(key);
          queue.push(next);
        }
      }
    }

    if (tile.special === 'stripedV') {
      for (let row = 0; row < board.rows; row += 1) {
        const next = { row, col: position.col };
        const key = positionKey(next);
        if (!expanded.has(key)) {
          expanded.add(key);
          queue.push(next);
        }
      }
    }
  }

  return expanded;
}

function calculateScore(board: BoardState, clearedPositions: Position[], cascade: number): number {
  const base = clearedPositions.reduce((total, position) => {
    const tile = board.grid[position.row][position.col];
    if (!tile) {
      return total;
    }

    if (tile.special === 'colorBomb') {
      return total + 220;
    }

    if (tile.special === 'stripedH' || tile.special === 'stripedV') {
      return total + 120;
    }

    return total + 60;
  }, 0);

  return base + (cascade - 1) * 90;
}

function collapseBoard(board: BoardState, clearSet: Set<string>, spawns: SpawnInstruction[]): BoardState {
  const grid = board.grid.map((row) => row.slice());
  let nextTileId = board.nextTileId;

  for (const key of clearSet) {
    const position = parsePositionKey(key);
    grid[position.row][position.col] = null;
  }

  for (const spawn of spawns) {
    grid[spawn.position.row][spawn.position.col] = createTile(
      spawn.special === 'colorBomb' ? 'prism' : spawn.color,
      spawn.special,
      nextTileId,
    );
    nextTileId += 1;
  }

  let seed = board.seed;
  const nextGrid: BoardState['grid'] = Array.from({ length: board.rows }, () =>
    Array.from({ length: board.columns }, () => null),
  );

  for (let col = 0; col < board.columns; col += 1) {
    const settledTiles: Tile[] = [];

    for (let row = board.rows - 1; row >= 0; row -= 1) {
      const tile = grid[row][col];
      if (tile) {
        settledTiles.push(tile);
      }
    }

    let writeRow = board.rows - 1;
    for (const tile of settledTiles) {
      nextGrid[writeRow][col] = tile;
      writeRow -= 1;
    }

    while (writeRow >= 0) {
      const pick = pickRandom(board.palette, seed);
      seed = pick.seed;
      nextGrid[writeRow][col] = createTile(pick.value, null, nextTileId);
      nextTileId += 1;
      writeRow -= 1;
    }
  }

  return cloneBoard(board, {
    grid: nextGrid,
    seed,
    nextTileId,
  });
}

function evaluateResult(board: BoardState): GameResult | null {
  if (board.score >= board.targetScore) {
    return {
      outcome: 'won',
      finalScore: board.score,
      targetScore: board.targetScore,
    };
  }

  if (board.movesRemaining <= 0) {
    return {
      outcome: 'lost',
      finalScore: board.score,
      targetScore: board.targetScore,
    };
  }

  return null;
}

function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function parsePositionKey(key: string): Position {
  const [row, col] = key.split(':').map(Number);
  return { row, col };
}

function positionEquals(left: Position, right: Position): boolean {
  return left.row === right.row && left.col === right.col;
}
