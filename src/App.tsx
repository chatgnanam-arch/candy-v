import type { ReactNode } from 'react';
import { GameBoard } from './components/GameBoard';
import { useGameController } from './hooks/useGameController';

function App() {
  const game = useGameController();
  const { board, profile } = game;
  const progress = Math.min(100, Math.round((board.score / board.targetScore) * 100));
  const overlaysOpen = game.showTutorial || game.showSettings || Boolean(board.result);

  return (
    <div className={`app-shell ${profile.reducedMotion ? 'app-shell--calm' : ''}`}>
      <div className="backdrop backdrop--mint" />
      <div className="backdrop backdrop--coral" />
      <main className="game-frame">
        <section className="hero-panel">
          <div className="hero-panel__copy">
            <p className="eyebrow">Original match-3 delight</p>
            <h1>Sugar Drop Saga</h1>
            <p className="hero-panel__summary">
              Swap sweet drops, spark stripes, and land a prism pop before your moves run out.
            </p>
          </div>
          <button type="button" className="glass-button" onClick={game.toggleSettings}>
            Tune
          </button>
        </section>

        <section className="hud-panel">
          <div className="stat-card stat-card--score">
            <span className="stat-card__label">Score</span>
            <strong>{board.score.toLocaleString()}</strong>
          </div>
          <div className="stat-card stat-card--target">
            <span className="stat-card__label">Target</span>
            <strong>{board.targetScore.toLocaleString()}</strong>
          </div>
          <div className="stat-card stat-card--moves">
            <span className="stat-card__label">Moves</span>
            <strong>{board.movesRemaining}</strong>
          </div>
          <div className="stat-card stat-card--best">
            <span className="stat-card__label">Best</span>
            <strong>{profile.bestScore.toLocaleString()}</strong>
          </div>
        </section>

        <section className="progress-panel" aria-label="Progress to target score">
          <div className="progress-panel__track">
            <span className="progress-panel__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-panel__caption">{progress}% to the goal</span>
        </section>

        <section className="board-panel">
          <GameBoard
            board={board}
            effects={game.effects}
            disabled={game.isBusy || overlaysOpen}
            onSelect={game.selectTile}
          />
        </section>

        <section className="action-panel">
          <button type="button" className="action-button action-button--primary" onClick={game.restartGame}>
            Restart
          </button>
          <button type="button" className="action-button" onClick={game.shuffleBoard} disabled={game.isBusy}>
            Shuffle
          </button>
          <button type="button" className="action-button" onClick={game.openTutorial}>
            How to Play
          </button>
        </section>

        <section className="tip-panel">
          <p>Match 4 to mint a stripe. Match 5 to craft a prism candy.</p>
          <p>{game.statusMessage ?? 'Chain cascades to snowball your score.'}</p>
        </section>
      </main>

      {game.showTutorial ? (
        <OverlayCard
          title="Welcome to Sugar Drop Saga"
          subtitle="Hit the target score before your move jar runs dry."
          actions={
            <>
              <button type="button" className="action-button action-button--primary" onClick={game.dismissTutorial}>
                Let&apos;s Play
              </button>
              <button type="button" className="action-button" onClick={game.dismissTutorial}>
                Close
              </button>
            </>
          }
        >
          <ol className="overlay-list">
            <li>Tap or click one candy, then a neighboring candy to swap.</li>
            <li>Matches of 3 clear the board and can trigger cascades.</li>
            <li>Matches of 4 create striped candies. Matches of 5 create prism candies.</li>
          </ol>
        </OverlayCard>
      ) : null}

      {game.showSettings ? (
        <OverlayCard
          title="Candy Cart"
          subtitle="A few quick comfort settings for the board."
          actions={
            <button type="button" className="action-button action-button--primary" onClick={game.toggleSettings}>
              Back to Board
            </button>
          }
        >
          <div className="settings-list">
            <label className="toggle-row">
              <span>Sound sparkle</span>
              <input
                type="checkbox"
                checked={profile.soundEnabled}
                onChange={(event) => game.setPreference({ soundEnabled: event.target.checked })}
              />
            </label>
            <label className="toggle-row">
              <span>Reduced motion</span>
              <input
                type="checkbox"
                checked={profile.reducedMotion}
                onChange={(event) => game.setPreference({ reducedMotion: event.target.checked })}
              />
            </label>
          </div>
        </OverlayCard>
      ) : null}

      {board.result ? (
        <OverlayCard
          title={board.result.outcome === 'won' ? 'Target Cracked!' : 'Sugar Storm Over'}
          subtitle={
            board.result.outcome === 'won'
              ? 'You cleared the score gate with room to spare.'
              : 'The jar is empty, but the next board is one tap away.'
          }
          actions={
            <button type="button" className="action-button action-button--primary" onClick={game.restartGame}>
              Play Again
            </button>
          }
        >
          <div className="result-grid">
            <div>
              <span className="result-grid__label">Final Score</span>
              <strong>{board.result.finalScore.toLocaleString()}</strong>
            </div>
            <div>
              <span className="result-grid__label">Best Score</span>
              <strong>{profile.bestScore.toLocaleString()}</strong>
            </div>
          </div>
        </OverlayCard>
      ) : null}
    </div>
  );
}

type OverlayCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  actions: ReactNode;
};

function OverlayCard({ title, subtitle, children, actions }: OverlayCardProps) {
  return (
    <div className="overlay">
      <div className="overlay__scrim" />
      <section className="overlay__card" role="dialog" aria-modal="true" aria-label={title}>
        <p className="eyebrow">Sugar Drop Saga</p>
        <h2>{title}</h2>
        <p className="overlay__subtitle">{subtitle}</p>
        <div className="overlay__body">{children}</div>
        <div className="overlay__actions">{actions}</div>
      </section>
    </div>
  );
}

export default App;
