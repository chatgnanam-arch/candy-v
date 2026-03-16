import { createBoard, getValidMoves, shuffleBoard, trySwap } from './engine';
import type { BoardState, NormalTileColor, Position, SpecialTileType, Tile, TileColor } from './types';

const PALETTE: NormalTileColor[] = [
  'strawberry',
  'tangerine',
  'blueberry',
  'mint',
  'grape',
  'peach',
];

describe('engine', () => {
  it('creates a board with no starting matches and at least one valid move', () => {
    const board = createBoard({ seed: 42 });

    expect(hasMatch(board)).toBe(false);
    expect(getValidMoves(board).length).toBeGreaterThan(0);
  });

  it('rejects invalid adjacent swaps without consuming a move', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'grape', 'peach'],
      ['mint', 'tangerine', 'peach', 'strawberry'],
      ['blueberry', 'peach', 'mint', 'grape'],
      ['grape', 'mint', 'tangerine', 'blueberry'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 0, col: 0 },
      to: { row: 0, col: 1 },
    });

    expect(attempt.valid).toBe(false);
    expect(attempt.resolveResult).toBeNull();
    expect(attempt.revertBoard?.movesRemaining).toBe(board.movesRemaining);
    expect(colorsFor(attempt.revertBoard!)).toEqual(colorsFor(board));
  });

  it('rejects non-adjacent selections', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'grape'],
      ['mint', 'tangerine', 'peach'],
      ['blueberry', 'peach', 'mint'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 0, col: 0 },
      to: { row: 2, col: 2 },
    });

    expect(attempt.valid).toBe(false);
    expect(colorsFor(attempt.previewBoard)).toEqual(colorsFor(board));
  });

  it('consumes a move and resolves a valid swap', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'strawberry', 'grape'],
      ['mint', 'strawberry', 'peach', 'blueberry'],
      ['peach', 'tangerine', 'mint', 'grape'],
      ['grape', 'blueberry', 'peach', 'mint'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 0, col: 1 },
      to: { row: 1, col: 1 },
    });

    expect(attempt.valid).toBe(true);
    expect(attempt.resolveResult?.steps.length).toBeGreaterThan(0);
    expect(attempt.resolveResult?.board.movesRemaining).toBe(board.movesRemaining - 1);
    expect(attempt.resolveResult?.board.score).toBeGreaterThan(0);
  });

  it('continues resolving cascades until the board is stable', () => {
    const board = makeBoard([
      ['blueberry', 'grape', 'peach', 'mint'],
      ['strawberry', 'mint', 'strawberry', 'grape'],
      ['blueberry', 'strawberry', 'grape', 'peach'],
      ['blueberry', 'tangerine', 'mint', 'strawberry'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 1, col: 1 },
      to: { row: 2, col: 1 },
    });

    expect(attempt.valid).toBe(true);
    expect(attempt.resolveResult?.steps.length).toBeGreaterThan(1);
    expect(hasMatch(attempt.resolveResult!.board)).toBe(false);
  });

  it('creates a striped candy from a four-match', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'strawberry', 'strawberry', 'grape'],
      ['mint', 'strawberry', 'peach', 'grape', 'blueberry'],
      ['peach', 'grape', 'mint', 'peach', 'strawberry'],
      ['grape', 'mint', 'tangerine', 'blueberry', 'peach'],
      ['blueberry', 'peach', 'grape', 'mint', 'tangerine'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 0, col: 1 },
      to: { row: 1, col: 1 },
    });

    expect(findSpecial(attempt.resolveResult!.board, 'stripedH') ?? findSpecial(attempt.resolveResult!.board, 'stripedV')).toBeTruthy();
  });

  it('creates a color bomb from a five-match', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'strawberry', 'strawberry', 'strawberry'],
      ['mint', 'strawberry', 'peach', 'grape', 'blueberry'],
      ['peach', 'grape', 'mint', 'peach', 'strawberry'],
      ['grape', 'mint', 'tangerine', 'blueberry', 'peach'],
      ['blueberry', 'peach', 'grape', 'mint', 'tangerine'],
    ]);

    const attempt = trySwap(board, {
      from: { row: 0, col: 1 },
      to: { row: 1, col: 1 },
    });

    expect(findSpecial(attempt.resolveResult!.board, 'colorBomb')).toBeTruthy();
  });

  it('shuffles into a solvable board with no immediate matches', () => {
    const board = makeBoard([
      ['strawberry', 'blueberry', 'grape', 'peach'],
      ['mint', 'tangerine', 'peach', 'strawberry'],
      ['blueberry', 'peach', 'mint', 'grape'],
      ['grape', 'mint', 'tangerine', 'blueberry'],
    ]);

    const shuffled = shuffleBoard(board);

    expect(hasMatch(shuffled)).toBe(false);
    expect(getValidMoves(shuffled).length).toBeGreaterThan(0);
  });
});

function makeBoard(
  rows: Array<Array<TileColor | { color: TileColor; special: SpecialTileType }>>,
  options: Partial<BoardState> = {},
): BoardState {
  let nextTileId = 1;

  return {
    rows: rows.length,
    columns: rows[0].length,
    grid: rows.map((row) =>
      row.map((cell) => {
        if (typeof cell === 'string') {
          return makeTile(cell, nextTileId++);
        }

        return makeTile(cell.color, nextTileId++, cell.special);
      }),
    ),
    score: options.score ?? 0,
    movesRemaining: options.movesRemaining ?? 12,
    targetScore: options.targetScore ?? 1200,
    phase: options.phase ?? 'ready',
    selected: options.selected ?? null,
    result: options.result ?? null,
    palette: options.palette ?? PALETTE,
    seed: options.seed ?? 7,
    nextTileId,
  };
}

function makeTile(color: TileColor, id: number, special: SpecialTileType | null = null): Tile {
  return {
    id: `tile-${id}`,
    color,
    special,
  };
}

function hasMatch(board: BoardState): boolean {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col <= board.columns - 3; col += 1) {
      const first = board.grid[row][col];
      const second = board.grid[row][col + 1];
      const third = board.grid[row][col + 2];

      if (first && second && third && first.color !== 'prism' && first.color === second.color && second.color === third.color) {
        return true;
      }
    }
  }

  for (let col = 0; col < board.columns; col += 1) {
    for (let row = 0; row <= board.rows - 3; row += 1) {
      const first = board.grid[row][col];
      const second = board.grid[row + 1][col];
      const third = board.grid[row + 2][col];

      if (first && second && third && first.color !== 'prism' && first.color === second.color && second.color === third.color) {
        return true;
      }
    }
  }

  return false;
}

function colorsFor(board: BoardState): string[][] {
  return board.grid.map((row) => row.map((cell) => `${cell?.color ?? 'empty'}:${cell?.special ?? 'plain'}`));
}

function findSpecial(board: BoardState, special: SpecialTileType): Position | null {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.columns; col += 1) {
      if (board.grid[row][col]?.special === special) {
        return { row, col };
      }
    }
  }

  return null;
}
