export type TileColor =
  | 'strawberry'
  | 'tangerine'
  | 'blueberry'
  | 'mint'
  | 'grape'
  | 'peach'
  | 'prism';

export type NormalTileColor = Exclude<TileColor, 'prism'>;

export type SpecialTileType = 'stripedH' | 'stripedV' | 'colorBomb';

export type Tile = {
  id: string;
  color: TileColor;
  special: SpecialTileType | null;
};

export type Position = {
  row: number;
  col: number;
};

export type Swap = {
  from: Position;
  to: Position;
};

export type MatchOrientation = 'horizontal' | 'vertical';

export type MatchGroup = {
  positions: Position[];
  orientation: MatchOrientation;
  color: NormalTileColor;
  length: number;
  createdSpecial: SpecialTileType | null;
};

export type GamePhase = 'ready' | 'swapping' | 'resolving' | 'shuffling' | 'gameOver';

export type GameOutcome = 'won' | 'lost';

export type GameResult = {
  outcome: GameOutcome;
  finalScore: number;
  targetScore: number;
};

export type GameConfig = {
  rows: number;
  columns: number;
  startingMoves: number;
  targetScore: number;
  palette: NormalTileColor[];
  seed: number;
};

export type BoardState = {
  rows: number;
  columns: number;
  grid: Array<Array<Tile | null>>;
  score: number;
  movesRemaining: number;
  targetScore: number;
  phase: GamePhase;
  selected: Position | null;
  result: GameResult | null;
  palette: NormalTileColor[];
  seed: number;
  nextTileId: number;
};

export type ResolveStep = {
  clearedPositions: Position[];
  matchedGroups: MatchGroup[];
  board: BoardState;
  cascade: number;
  scoreDelta: number;
};

export type ResolveResult = {
  board: BoardState;
  steps: ResolveStep[];
  totalScore: number;
  autoShuffled: boolean;
};

export type SwapAttempt = {
  valid: boolean;
  previewBoard: BoardState;
  revertBoard: BoardState | null;
  resolveResult: ResolveResult | null;
};

export type PersistedProfile = {
  bestScore: number;
  tutorialDismissed: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
};
