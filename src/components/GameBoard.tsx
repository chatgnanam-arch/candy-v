import type { CSSProperties } from 'react';
import type { BoardState, NormalTileColor, Position } from '../game/types';
import type { BurstEffect } from '../hooks/useGameController';

type GameBoardProps = {
  board: BoardState;
  candyLabels: Record<NormalTileColor, string>;
  prismLabel: string;
  effects: BurstEffect[];
  hintPositions: Position[];
  disabled: boolean;
  onSelect: (position: Position) => void;
};

type TilePlacement = {
  row: number;
  col: number;
  id: string;
  color: string;
  special: string | null;
};

export function GameBoard({ board, candyLabels, prismLabel, effects, hintPositions, disabled, onSelect }: GameBoardProps) {
  const tiles: TilePlacement[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.columns; col += 1) {
      const tile = board.grid[row][col];
      if (!tile) {
        continue;
      }

      tiles.push({
        row,
        col,
        id: tile.id,
        color: tile.color,
        special: tile.special,
      });
    }
  }

  const boardStyle = {
    '--rows': board.rows,
    '--columns': board.columns,
  } as CSSProperties;

  return (
    <div className="board-shell">
      <div className="board" style={boardStyle} role="grid" aria-label="Match 3 board">
        <div className="board__cells" aria-hidden="true">
          {Array.from({ length: board.rows * board.columns }, (_, index) => (
            <span className="board__cell" key={`cell-${index}`} />
          ))}
        </div>

        <div className="board__tiles">
          {tiles.map((tile) => {
            const isSelected =
              board.selected?.row === tile.row && board.selected?.col === tile.col;
            const isHinted = hintPositions.some((position) => position.row === tile.row && position.col === tile.col);

            return (
              <button
                key={tile.id}
                type="button"
                className={[
                  'tile',
                  `tile--${tile.color}`,
                  tile.special ? `tile--${tile.special}` : '',
                  isHinted ? 'tile--hint' : '',
                  isSelected ? 'tile--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={getTileStyle(tile.row, tile.col)}
                onClick={() => onSelect({ row: tile.row, col: tile.col })}
                aria-label={describeTile(tile.color, tile.special, tile.row, tile.col, candyLabels, prismLabel)}
                aria-pressed={isSelected}
                disabled={disabled}
              >
                <span className="tile__shape">
                  <span className="tile__shine" />
                  <span className="tile__core" />
                  {tile.special === 'colorBomb' ? (
                    <span className="tile__burst" />
                  ) : (
                    <>
                      <span className="tile__stripe tile__stripe--one" />
                      <span className="tile__stripe tile__stripe--two" />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="board__effects" aria-hidden="true">
          {effects.map((effect) => (
            <span
              key={effect.key}
              className={[
                'burst',
                `burst--${effect.color}`,
                effect.special ? `burst--${effect.special}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={getTileStyle(effect.row, effect.col)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getTileStyle(row: number, col: number): CSSProperties {
  return {
    gridColumn: `${col + 1}`,
    gridRow: `${row + 1}`,
  };
}

function describeTile(
  color: string,
  special: string | null,
  row: number,
  col: number,
  candyLabels: Record<NormalTileColor, string>,
  prismLabel: string,
): string {
  const colorLabel = color === 'prism' ? prismLabel : candyLabels[color as NormalTileColor] ?? `${color} candy`;
  const specialLabel = special ? ` ${describeSpecial(special)}` : '';
  return `${colorLabel}${specialLabel} at row ${row + 1}, column ${col + 1}`;
}

function describeSpecial(special: string): string {
  switch (special) {
    case 'stripedH':
    case 'stripedV':
      return 'striped';
    case 'colorBomb':
      return 'prism';
    default:
      return special;
  }
}
