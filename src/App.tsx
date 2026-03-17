import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { getValidMoves, trySwap } from './game/engine';
import type { BoardState, SpecialTileType, Swap } from './game/types';
import { useGameController } from './hooks/useGameController';
import { submitFeedback } from './lib/feedback';
import type { CandyTheme } from './lib/themes';
import { CANDY_THEMES } from './lib/themes';

function App() {
  const game = useGameController();
  const { board, profile } = game;
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [announcement, setAnnouncement] = useState<LiveAnnouncement | null>(null);
  const announcementSeedRef = useRef(0);
  const previousUnlockedCountRef = useRef(0);
  const previousUnlockedTitlesRef = useRef<string[]>([]);
  const previousTierCountRef = useRef(0);
  const previousOutcomeRef = useRef(board.result?.outcome ?? null);
  const hasInitializedAnnouncementsRef = useRef(false);
  const progress = Math.min(100, Math.round((board.score / board.targetScore) * 100));
  const overlaysOpen = game.showTutorial || game.showSettings || showFeedback || Boolean(board.result);
  const canSendFeedback = feedbackTitle.trim().length > 0 && feedbackMessage.trim().length > 0;
  const activeTheme = CANDY_THEMES.find((theme) => theme.id === profile.candyThemeId) ?? CANDY_THEMES[0];
  const collectionCandies = board.palette.map((color) => ({
    color,
    label: activeTheme.candyLabels[color],
  }));
  const validMoves = getValidMoves(board);
  const selectedTile = board.selected ? board.grid[board.selected.row][board.selected.col] : null;
  const specialsCount = countSpecials(board.grid);
  const scoreGap = Math.max(0, board.targetScore - board.score);
  const forecast = getRunForecast(progress, board.movesRemaining, scoreGap);
  const starTrack = getStarTrack(board.targetScore, board.score);
  const unlockedTiers = starTrack.filter((tier) => tier.reached).length;
  const nextTier = starTrack.find((tier) => !tier.reached) ?? null;
  const milestones = getMilestones(board.targetScore, board.score);
  const reachedMilestones = milestones.filter((milestone) => milestone.reached);
  const activeMilestone = reachedMilestones[reachedMilestones.length - 1] ?? milestones[0];
  const runBadge = getRunBadge(progress, board.movesRemaining, specialsCount);
  const boardMix = getBoardMix(board.grid, board.palette, activeTheme.candyLabels);
  const moveCoach = getMoveCoach({
    board,
    validMoves,
    hintActive: game.hintPositions.length > 0,
    prismLabel: activeTheme.prismLabel,
  });
  const futurePeek = getFuturePeek({
    board,
    validMoves,
    prismLabel: activeTheme.prismLabel,
    candyLabels: activeTheme.candyLabels,
  });
  const runLedger = getRunLedger({
    runStats: game.runStats,
    boardScore: board.score,
    movesRemaining: board.movesRemaining,
    prismLabel: activeTheme.prismLabel,
  });
  const paceStudio = getPaceStudio({
    score: board.score,
    targetScore: board.targetScore,
    movesRemaining: board.movesRemaining,
    runStats: game.runStats,
    result: board.result,
  });
  const moveBudget = getMoveBudget({
    score: board.score,
    targetScore: board.targetScore,
    movesRemaining: board.movesRemaining,
    validMoveCount: validMoves.length,
    liveSpecials: specialsCount.striped + specialsCount.prism,
    runStats: game.runStats,
    result: board.result,
  });
  const trophyCabinet = getTrophyCabinet({
    runStats: game.runStats,
    boardScore: board.score,
    targetScore: board.targetScore,
    result: board.result,
    prismLabel: activeTheme.prismLabel,
  });
  const dominantCandy = [...boardMix].sort((left, right) => right.count - left.count)[0] ?? boardMix[0];
  const runChecklist = getRunChecklist({
    nextTier,
    currentScore: board.score,
    specialsCount,
    dominantCandy,
    movesRemaining: board.movesRemaining,
    prismLabel: activeTheme.prismLabel,
  });
  const selectionLabel =
    selectedTile?.color === 'prism'
      ? activeTheme.prismLabel
      : selectedTile
        ? activeTheme.candyLabels[selectedTile.color]
        : null;
  const selectionSpecialLabel =
    selectedTile?.special === 'colorBomb'
      ? activeTheme.prismLabel
      : selectedTile?.special === 'stripedH' || selectedTile?.special === 'stripedV'
        ? 'Striped Candy'
        : 'Classic Candy';
  const spotlightCandyClass = selectedTile?.color ?? 'prism';

  useEffect(() => {
    const unlockedTitles = trophyCabinet.trophies
      .filter((trophy) => trophy.state === 'unlocked')
      .map((trophy) => trophy.title);
    const currentOutcome = board.result?.outcome ?? null;

    if (!hasInitializedAnnouncementsRef.current) {
      hasInitializedAnnouncementsRef.current = true;
      previousUnlockedCountRef.current = trophyCabinet.unlockedCount;
      previousUnlockedTitlesRef.current = unlockedTitles;
      previousTierCountRef.current = unlockedTiers;
      previousOutcomeRef.current = currentOutcome;
      return;
    }

    if (trophyCabinet.unlockedCount > previousUnlockedCountRef.current) {
      const newestTrophy = trophyCabinet.trophies.find(
        (trophy) => trophy.state === 'unlocked' && !previousUnlockedTitlesRef.current.includes(trophy.title),
      );

      if (newestTrophy) {
        announcementSeedRef.current += 1;
        setAnnouncement({
          key: announcementSeedRef.current,
          tone: 'badge',
          label: 'Badge Earned',
          title: newestTrophy.title,
          detail: `${newestTrophy.title} just joined the cabinet for this run.`,
        });
      }
    } else if (unlockedTiers > previousTierCountRef.current) {
      const newestTier = starTrack[unlockedTiers - 1];

      if (newestTier) {
        announcementSeedRef.current += 1;
        setAnnouncement({
          key: announcementSeedRef.current,
          tone: 'prize',
          label: 'Prize Track',
          title: newestTier.label,
          detail: `${newestTier.label} is now unlocked on the score track.`,
        });
      }
    } else if (currentOutcome === 'won' && previousOutcomeRef.current !== 'won') {
      announcementSeedRef.current += 1;
      setAnnouncement({
        key: announcementSeedRef.current,
        tone: 'victory',
        label: 'Target Cracked',
        title: 'Run Won',
        detail: 'The score gate is cleared and the board is officially in victory pace.',
      });
    }

    previousUnlockedCountRef.current = trophyCabinet.unlockedCount;
    previousUnlockedTitlesRef.current = unlockedTitles;
    previousTierCountRef.current = unlockedTiers;
    previousOutcomeRef.current = currentOutcome;
  }, [board.result, starTrack, trophyCabinet, unlockedTiers]);

  useEffect(() => {
    if (!announcement) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAnnouncement((current) => (current?.key === announcement.key ? null : current));
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [announcement]);

  function openFeedback(): void {
    setFeedbackError(null);
    setShowFeedback(true);
  }

  function closeFeedback(): void {
    setShowFeedback(false);
    setFeedbackError(null);
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!canSendFeedback || isSubmittingFeedback) {
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      await submitFeedback({
        title: feedbackTitle,
        message: feedbackMessage,
        score: board.score,
        movesRemaining: board.movesRemaining,
      });
      setShowFeedback(false);
      setFeedbackTitle('');
      setFeedbackMessage('');
      setFeedbackNotice('Feedback sent. Thanks for helping improve the game.');
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : 'Unable to send feedback right now.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>): void {
    setFeedbackTitle(event.target.value);
  }

  function handleMessageChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setFeedbackMessage(event.target.value);
  }

  return (
    <div
      className={`app-shell ${profile.reducedMotion ? 'app-shell--calm' : ''}`}
      data-theme={profile.candyThemeId}
    >
      <div className="backdrop backdrop--mint" />
      <div className="backdrop backdrop--coral" />
      <div className="backdrop backdrop--berry" />
      <main className="game-frame">
        {announcement ? (
          <section className={`signal-banner signal-banner--${announcement.tone}`} aria-live="polite">
            <div className="signal-banner__copy">
              <span className="signal-banner__label">{announcement.label}</span>
              <strong>{announcement.title}</strong>
              <p>{announcement.detail}</p>
            </div>
            <button
              type="button"
              className="signal-banner__dismiss"
              aria-label="Dismiss announcement"
              onClick={() => setAnnouncement(null)}
            >
              Close
            </button>
          </section>
        ) : null}

        <section className="hero-panel">
          <div className="hero-panel__copy">
            <p className="eyebrow">Original match-3 delight</p>
            <h1>Sugar Drop Saga</h1>
            <p className="hero-panel__summary">
              Swap sweet drops, spark stripes, and land a prism pop before your moves run out.
            </p>
            <div className="theme-banner" aria-label={`Active candy theme: ${activeTheme.name}`}>
              <div>
                <span className="theme-banner__label">Candy Theme</span>
                <strong>{activeTheme.name}</strong>
                <p>{activeTheme.tagline}</p>
              </div>
              <div className="theme-banner__swatches" aria-hidden="true">
                {activeTheme.swatches.map((swatch) => (
                  <span key={swatch} style={{ background: swatch }} />
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="glass-button" onClick={game.toggleSettings}>
            Tune
          </button>
        </section>

        <section className="theme-rail" aria-label="Quick candy theme switcher">
          <div className="theme-rail__intro">
            <span className="theme-rail__eyebrow">Theme Deck</span>
            <strong>{activeTheme.name}</strong>
            <p>{activeTheme.feature}</p>
          </div>
          <div className="theme-rail__track">
            {CANDY_THEMES.map((theme) => {
              const isActive = theme.id === profile.candyThemeId;

              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-chip ${isActive ? 'theme-chip--active' : ''}`}
                  aria-label={`Switch to ${theme.name}`}
                  aria-pressed={isActive}
                  onClick={() => game.setPreference({ candyThemeId: theme.id })}
                >
                  <span className="theme-chip__name">{theme.name}</span>
                  <span className="theme-chip__swatches" aria-hidden="true">
                    {theme.swatches.map((swatch) => (
                      <span key={swatch} style={{ background: swatch }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="status-marquee" aria-label="Run status ribbon">
          <article className="status-pill status-pill--tempo">
            <span className="status-pill__label">Run tempo</span>
            <strong>{forecast.badge}</strong>
          </article>
          <article className="status-pill status-pill--dominant">
            <span className="status-pill__label">Board lead</span>
            <div className="status-pill__sample">
              <span className={`sample-candy sample-candy--${dominantCandy.color}`} aria-hidden="true" />
              <strong>{dominantCandy.label}</strong>
            </div>
          </article>
          <article className="status-pill status-pill--special">
            <span className="status-pill__label">Special load</span>
            <strong>{specialsCount.striped + specialsCount.prism} live specials</strong>
          </article>
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
          <div className="progress-panel__header">
            <div className="progress-panel__headline">
              <span className="eyebrow">Prize Track</span>
              <strong>
                {unlockedTiers} / {starTrack.length} tiers unlocked
              </strong>
            </div>
            <div className="progress-panel__scoreline">
              <span>{board.score.toLocaleString()}</span>
              <span>{board.targetScore.toLocaleString()}</span>
            </div>
          </div>
          <div className="progress-panel__track">
            <span className="progress-panel__fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-panel__summary">
            <span className="progress-panel__caption">{progress}% to the goal</span>
            <span className="progress-panel__stage">{activeMilestone.label}</span>
          </div>
          <div className="progress-panel__milestones" aria-label="Score milestones">
            {starTrack.map((milestone) => (
              <article
                key={milestone.label}
                className={[
                  'milestone-card',
                  milestone.reached ? 'milestone-card--reached' : '',
                  !milestone.reached && nextTier?.label === milestone.label ? 'milestone-card--next' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={nextTier?.label === milestone.label ? 'step' : undefined}
              >
                <span>{milestone.label}</span>
                <strong>{milestone.score.toLocaleString()}</strong>
              </article>
            ))}
          </div>
          <div className="progress-panel__footer">
            <p>
              {nextTier
                ? `${(nextTier.score - board.score).toLocaleString()} more points unlocks ${nextTier.label}.`
                : 'All prize tiers unlocked for this run.'}
            </p>
          </div>
        </section>

        <section className="run-deck" aria-label="Run insights">
          <article className="forecast-card">
            <span className="eyebrow">Sweet Forecast</span>
            <h2>{forecast.title}</h2>
            <p>{forecast.body}</p>
            <div className="forecast-card__chips">
              <span className="forecast-chip forecast-chip--primary">{forecast.badge}</span>
              <span className="forecast-chip">{activeMilestone.label}</span>
            </div>
            <div className="forecast-card__metrics">
              <span>{scoreGap.toLocaleString()} points to target</span>
              <span>{board.movesRemaining} moves on the tray</span>
            </div>
          </article>

          <article className="spotlight-card">
            <span className="eyebrow">Board Spotlight</span>
            <div className="spotlight-card__hero">
              <span className={`sample-candy sample-candy--${spotlightCandyClass} spotlight-card__sample`} aria-hidden="true" />
              <div>
                <h2>{selectionLabel ? selectionLabel : activeTheme.prismLabel}</h2>
                <p>
                  {selectionLabel
                    ? board.selected
                      ? `Selected at row ${board.selected.row + 1}, column ${board.selected.col + 1}.`
                      : 'Selected candy is ready for your next move.'
                    : `No candy selected yet. Watch for ${activeTheme.prismLabel} setups as the board opens.`}
                </p>
              </div>
            </div>
            <div className="spotlight-card__chips">
              <span className="forecast-chip forecast-chip--soft">{selectionSpecialLabel}</span>
              <span className="forecast-chip">{activeTheme.collectionName}</span>
            </div>
            <div className="spotlight-card__stats">
              <div>
                <strong>{specialsCount.striped}</strong>
                <span>striped candies live</span>
              </div>
              <div>
                <strong>{specialsCount.prism}</strong>
                <span>{activeTheme.prismLabel.toLowerCase()} live</span>
              </div>
            </div>
          </article>
        </section>

        <section className="session-pass" aria-label="Arcade session pass">
          <article className="ticket-card">
            <span className="eyebrow">Session Badge</span>
            <h2>{runBadge.title}</h2>
            <p>{runBadge.body}</p>
            <div className="ticket-card__meta">
              <span>{runBadge.ribbon}</span>
              <span>{activeMilestone.label}</span>
            </div>
          </article>

          <article className="recipe-card">
            <span className="eyebrow">Board Recipe</span>
            <h2>Combo ladder</h2>
            <div className="recipe-card__grid">
              <div className="recipe-pill">
                <span className="recipe-pill__count">3</span>
                <strong>steady clear</strong>
              </div>
              <div className="recipe-pill">
                <span className="recipe-pill__count">4</span>
                <strong>stripe mint</strong>
              </div>
              <div className="recipe-pill">
                <span className="recipe-pill__count">5</span>
                <strong>{activeTheme.prismLabel.toLowerCase()}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="run-checklist" aria-label="Run checklist">
          <div className="run-checklist__header">
            <span className="eyebrow">Run Checklist</span>
            <h2>What to chase next</h2>
            <p>These live goals update with the board so the next high-value move is easier to spot.</p>
          </div>
          <div className="run-checklist__grid">
            {runChecklist.map((item) => (
              <article key={item.title} className={`checklist-card checklist-card--${item.state}`}>
                <span className="checklist-card__state">{item.stateLabel}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="board-panel">
          <div className="board-panel__header">
            <div>
              <span className="board-panel__eyebrow">Board Tray</span>
              <strong>{activeTheme.collectionName}</strong>
            </div>
            <span className="board-panel__badge">{activeTheme.prismLabel}</span>
          </div>
          <GameBoard
            board={board}
            candyLabels={activeTheme.candyLabels}
            prismLabel={activeTheme.prismLabel}
            effects={game.effects}
            hintPositions={game.hintPositions}
            disabled={game.isBusy || overlaysOpen}
            onSelect={game.selectTile}
          />
          <div className="board-panel__hintbar">
            <span className="board-panel__hintlabel">Move help</span>
            <p>
              {game.hintPositions.length > 0
                ? 'Highlighted candies show one possible scoring swap.'
                : 'Tap Hint when you want a quick nudge toward a valid move.'}
            </p>
          </div>
        </section>

        <section className="move-coach" aria-label="Move coach">
          <div className="move-coach__header">
            <span className="eyebrow">Swap Studio</span>
            <h2>Read the next best turn</h2>
            <p>{moveCoach.summary}</p>
          </div>

          <article className={`coach-hero coach-hero--${moveCoach.tone}`}>
            <div className="coach-hero__topline">
              <span className="coach-hero__badge">{moveCoach.badge}</span>
              <span className="coach-hero__count">{moveCoach.validMoveCount} live swaps</span>
            </div>
            <h3>{moveCoach.title}</h3>
            <p>{moveCoach.body}</p>
            <div className="coach-hero__chips">
              {moveCoach.chips.map((chip) => (
                <span key={chip} className="coach-chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>

          <div className="move-coach__grid">
            {moveCoach.cards.map((card) => (
              <article key={card.label} className="coach-metric">
                <span className="coach-metric__label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="future-panel" aria-label="Parallel tray">
          <div className="future-panel__header">
            <span className="eyebrow">Parallel Tray</span>
            <h2>Preview the next universe</h2>
            <p>{futurePeek.summary}</p>
          </div>
          <article className={`future-hero future-hero--${futurePeek.tone}`}>
            <div className="future-hero__topline">
              <span className="future-hero__badge">{futurePeek.badge}</span>
              <span className="future-hero__lane">{futurePeek.lane}</span>
            </div>
            <div className="future-hero__layout">
              <div className="future-mini-board" aria-hidden="true">
                {futurePeek.previewCells.map((cell) => (
                  <span
                    key={`${cell.row}-${cell.col}`}
                    className={[
                      'future-mini-board__cell',
                      cell.color ? `future-mini-board__cell--${cell.color}` : 'future-mini-board__cell--empty',
                      cell.special ? `future-mini-board__cell--${cell.special}` : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                ))}
              </div>
              <div className="future-hero__copy">
                <h3>{futurePeek.title}</h3>
                <p>{futurePeek.body}</p>
              </div>
            </div>
            <div className="future-hero__chips">
              {futurePeek.chips.map((chip) => (
                <span key={chip} className="future-chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>
        </section>

        <section className="chronicle-panel" aria-label="Candy chronicle">
          <div className="chronicle-panel__header">
            <span className="eyebrow">Candy Chronicle</span>
            <h2>Recent board moments</h2>
            <p>The live journal keeps a short memory of hints, swaps, cascades, and tray resets during the run.</p>
          </div>
          <div className="chronicle-panel__list">
            {game.journal.map((entry) => (
              <article key={entry.id} className={`journal-card journal-card--${entry.tone}`}>
                <div className="journal-card__topline">
                  <span className="journal-card__tone">{formatJournalTone(entry.tone)}</span>
                  <span className="journal-card__stat">{entry.stat}</span>
                </div>
                <strong>{entry.title}</strong>
                <p>{entry.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ledger-panel" aria-label="Run ledger">
          <div className="ledger-panel__header">
            <span className="eyebrow">Run Ledger</span>
            <h2>Track the session rhythm</h2>
            <p>{runLedger.summary}</p>
          </div>
          <article className={`ledger-hero ledger-hero--${runLedger.tone}`}>
            <div className="ledger-hero__topline">
              <span className="ledger-hero__badge">{runLedger.badge}</span>
              <span className="ledger-hero__pace">{runLedger.pace}</span>
            </div>
            <h3>{runLedger.title}</h3>
            <p>{runLedger.body}</p>
            <div className="ledger-hero__chips">
              {runLedger.chips.map((chip) => (
                <span key={chip} className="ledger-chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>
          <div className="ledger-panel__grid">
            {runLedger.cards.map((card) => (
              <article key={card.label} className="ledger-card">
                <span className="ledger-card__label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pace-panel" aria-label="Score pace">
          <div className="pace-panel__header">
            <span className="eyebrow">Sugar Math</span>
            <h2>Read the score pace</h2>
            <p>{paceStudio.summary}</p>
          </div>
          <article className={`pace-hero pace-hero--${paceStudio.tone}`}>
            <div className="pace-hero__topline">
              <span className="pace-hero__badge">{paceStudio.badge}</span>
              <span className="pace-hero__gap">{paceStudio.gapLabel}</span>
            </div>
            <h3>{paceStudio.title}</h3>
            <p>{paceStudio.body}</p>
            <div className="pace-hero__chips">
              {paceStudio.chips.map((chip) => (
                <span key={chip} className="pace-chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>
          <div className="pace-panel__grid">
            {paceStudio.cards.map((card) => (
              <article key={card.label} className="pace-card">
                <span className="pace-card__label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="budget-panel" aria-label="Move budget">
          <div className="budget-panel__header">
            <span className="eyebrow">Move Budget</span>
            <h2>Guard the move jar</h2>
            <p>{moveBudget.summary}</p>
          </div>
          <article className={`budget-hero budget-hero--${moveBudget.tone}`}>
            <div className="budget-hero__topline">
              <span className="budget-hero__badge">{moveBudget.badge}</span>
              <span className="budget-hero__cushion">{moveBudget.cushionLabel}</span>
            </div>
            <h3>{moveBudget.title}</h3>
            <p>{moveBudget.body}</p>
            <div className="budget-hero__chips">
              {moveBudget.chips.map((chip) => (
                <span key={chip} className="budget-chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>
          <div className="budget-panel__grid">
            {moveBudget.cards.map((card) => (
              <article key={card.label} className="budget-card">
                <span className="budget-card__label">{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="trophy-panel" aria-label="Trophy cabinet">
          <div className="trophy-panel__header">
            <span className="eyebrow">Trophy Cabinet</span>
            <h2>Unlock sweet run badges</h2>
            <p>
              {trophyCabinet.unlockedCount} / {trophyCabinet.trophies.length} badges earned this run.{' '}
              {trophyCabinet.summary}
            </p>
          </div>
          <article className={`trophy-spotlight trophy-spotlight--${trophyCabinet.spotlight.tone}`}>
            <div className="trophy-spotlight__topline">
              <span className="trophy-spotlight__badge">{trophyCabinet.spotlight.badge}</span>
              <span className="trophy-spotlight__count">
                {trophyCabinet.unlockedCount} / {trophyCabinet.trophies.length}
              </span>
            </div>
            <h3>{trophyCabinet.spotlight.title}</h3>
            <p>{trophyCabinet.spotlight.body}</p>
            <div className="trophy-spotlight__chips">
              {trophyCabinet.spotlight.chips.map((chip) => (
                <span key={chip} className="trophy-spotlight__chip">
                  {chip}
                </span>
              ))}
            </div>
          </article>
          <div className="trophy-panel__grid">
            {trophyCabinet.trophies.map((trophy) => (
              <article key={trophy.title} className={`trophy-card trophy-card--${trophy.state}`}>
                <div className="trophy-card__topline">
                  <span className="trophy-card__stamp">{trophy.stamp}</span>
                  <span className="trophy-card__progress">{trophy.progress}</span>
                </div>
                <strong>{trophy.title}</strong>
                <p>{trophy.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="tray-mix" aria-label="Live board candy mix">
          <div className="tray-mix__header">
            <span className="eyebrow">Tray Mix</span>
            <h2>Live candy balance</h2>
            <p>Scan the current candy spread to spot heavy colors and easier follow-up matches.</p>
          </div>
          <div className="tray-mix__grid">
            {boardMix.map((mix) => (
              <article key={mix.color} className="mix-card">
                <span className={`sample-candy sample-candy--${mix.color}`} aria-hidden="true" />
                <div className="mix-card__copy">
                  <strong>{mix.label}</strong>
                  <span>{mix.count} on board</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="collection-shelf" aria-label={`${activeTheme.collectionName} candy collection`}>
          <div className="collection-shelf__header">
            <span className="eyebrow">Candy Collection</span>
            <h2>{activeTheme.collectionName}</h2>
            <p>{activeTheme.feature}</p>
          </div>
          <div className="collection-shelf__grid">
            {collectionCandies.map((candy) => (
              <article key={candy.color} className="collection-card">
                <span className={`sample-candy sample-candy--${candy.color}`} aria-hidden="true" />
                <div className="collection-card__copy">
                  <strong>{candy.label}</strong>
                  <span>{candy.color}</span>
                </div>
              </article>
            ))}
            <article className="collection-card collection-card--prism">
              <span className="sample-candy sample-candy--prism" aria-hidden="true" />
              <div className="collection-card__copy">
                <strong>{activeTheme.prismLabel}</strong>
                <span>special candy</span>
              </div>
            </article>
          </div>
        </section>

        <section className="sweet-notes" aria-label={`${activeTheme.name} theme notes`}>
          <article className="story-card">
            <div className="story-card__header">
              <span className="eyebrow">Theme Notes</span>
              <h2>{activeTheme.name} tasting notes</h2>
            </div>
            <div className="story-card__chips">
              {activeTheme.notes.map((note) => (
                <span key={note} className="story-chip">
                  {note}
                </span>
              ))}
            </div>
            <p className="story-card__body">
              {activeTheme.collectionName} is tuned for a {activeTheme.mood.toLowerCase()} board mood, so every candy
              read, tray accent, and burst effect leans into the same sweet-shop identity.
            </p>
          </article>

          <article className="specials-panel">
            <div className="specials-panel__header">
              <span className="eyebrow">Specials Guide</span>
              <h2>Build bigger power-ups</h2>
            </div>
            <div className="specials-grid">
              <article className="special-card">
                <span className="special-card__count">3</span>
                <strong>Clean Clear</strong>
                <p>Use quick 3-matches to steady the board and open space for chain reactions.</p>
              </article>
              <article className="special-card">
                <span className="special-card__count">4</span>
                <strong>Striped Candy</strong>
                <p>Line up four to mint a stripe that clears a full row or column on activation.</p>
              </article>
              <article className="special-card">
                <span className="special-card__count">5</span>
                <strong>{activeTheme.prismLabel}</strong>
                <p>Save 5-in-a-row turns for crowded boards so the prism can break open tough layouts.</p>
              </article>
            </div>
          </article>
        </section>

        <section className="action-panel">
          <button type="button" className="action-button action-button--primary" onClick={game.restartGame}>
            Restart
          </button>
          <button type="button" className="action-button" onClick={game.shuffleBoard} disabled={game.isBusy}>
            Shuffle
          </button>
          <button type="button" className="action-button" onClick={game.showHint} disabled={game.isBusy}>
            Hint
          </button>
          <button type="button" className="action-button" onClick={game.openTutorial}>
            How to Play
          </button>
          <button type="button" className="action-button" onClick={openFeedback}>
            Feedback
          </button>
        </section>

        <section className="tip-panel">
          <p>Match 4 to mint a stripe. Match 5 to craft a prism candy.</p>
          <p>{feedbackNotice ?? game.statusMessage ?? 'Chain cascades to snowball your score.'}</p>
        </section>

        <section className="candy-lab" aria-label="Candy strategy guide">
          <div className="candy-lab__header">
            <span className="eyebrow">Candy Lab</span>
            <h2>Theme-matched playbook</h2>
            <p>{activeTheme.feature}</p>
          </div>
          <div className="candy-lab__grid">
            <article className="guide-card">
              <span className="guide-card__icon guide-card__icon--stripe" aria-hidden="true" />
              <strong>Stripe Spark</strong>
              <p>Push for 4-candy clears early to open lanes and swing the board sideways.</p>
            </article>
            <article className="guide-card">
              <span className="guide-card__icon guide-card__icon--prism" aria-hidden="true" />
              <strong>Prism Pop</strong>
              <p>Hold 5-candy matches for crowded turns so the prism can rescue a stuck board.</p>
            </article>
            <article className="guide-card">
              <span className="guide-card__icon guide-card__icon--cascade" aria-hidden="true" />
              <strong>Cascade Chain</strong>
              <p>Favor center swaps when you want drops to snowball into follow-up clears.</p>
            </article>
          </div>
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
          subtitle="Comfort toggles and candy skins for the board."
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
          <section className="theme-gallery" aria-label="Candy themes">
            <div className="theme-gallery__header">
              <span className="theme-gallery__eyebrow">Candy Themes</span>
              <h3>Pick a board mood</h3>
              <p>Each theme refreshes the candy colors, board chrome, and sweet-shop atmosphere.</p>
            </div>
            <div className="theme-grid">
              {CANDY_THEMES.map((theme) => {
                const isActive = theme.id === profile.candyThemeId;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-card ${isActive ? 'theme-card--active' : ''}`}
                    aria-label={`Use ${theme.name} theme`}
                    aria-pressed={isActive}
                    onClick={() => game.setPreference({ candyThemeId: theme.id })}
                  >
                    <span className="theme-card__topline">{theme.name}</span>
                    <strong>{theme.mood}</strong>
                    <p>{theme.tagline}</p>
                    <span className="theme-card__swatches" aria-hidden="true">
                      {theme.swatches.map((swatch) => (
                        <span key={swatch} style={{ background: swatch }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
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

      {showFeedback ? (
        <OverlayCard
          title="Send Feedback"
          subtitle="Share a title and message. We will deliver it quietly in the background."
          actions={
            <>
              <button
                type="submit"
                className="action-button action-button--primary"
                form="feedback-form"
                disabled={!canSendFeedback || isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Sending...' : 'Send'}
              </button>
              <button type="button" className="action-button" onClick={closeFeedback} disabled={isSubmittingFeedback}>
                Cancel
              </button>
            </>
          }
        >
          <form id="feedback-form" className="feedback-form" onSubmit={handleFeedbackSubmit}>
            <label className="feedback-form__field">
              <span>Title</span>
              <input
                type="text"
                name="feedback-title"
                value={feedbackTitle}
                onChange={handleTitleChange}
                placeholder="Quick idea, bug, or suggestion"
                maxLength={120}
              />
            </label>
            <label className="feedback-form__field">
              <span>Message</span>
              <textarea
                name="feedback-message"
                rows={5}
                value={feedbackMessage}
                onChange={handleMessageChange}
                placeholder="Tell the app owner what happened or what you'd love to see next."
                maxLength={1200}
              />
            </label>
            {feedbackError ? <p className="feedback-form__error">{feedbackError}</p> : null}
          </form>
        </OverlayCard>
      ) : null}
    </div>
  );
}

function countSpecials(grid: ReturnType<typeof useGameController>['board']['grid']): {
  striped: number;
  prism: number;
} {
  return grid.flat().reduce(
    (totals, tile) => {
      if (!tile) {
        return totals;
      }

      if (tile.special === 'stripedH' || tile.special === 'stripedV') {
        totals.striped += 1;
      }

      if (tile.special === 'colorBomb') {
        totals.prism += 1;
      }

      return totals;
    },
    { striped: 0, prism: 0 },
  );
}

function getRunForecast(progress: number, movesRemaining: number, scoreGap: number): {
  title: string;
  body: string;
  badge: string;
} {
  if (progress >= 100) {
    return {
      title: 'Target already cracked',
      body: 'You are over the line, so every extra cascade now is just style points for the collection.',
      badge: 'Victory pace',
    };
  }

  if (progress >= 80 || scoreGap <= 800) {
    return {
      title: 'Closing stretch',
      body: 'You are within reach. Protect your best lanes and spend moves on higher-value stripe or prism setups.',
      badge: 'Near finish',
    };
  }

  if (movesRemaining <= 6) {
    return {
      title: 'Need a burst turn',
      body: 'Moves are getting tight. Favor center-board swaps that can roll into immediate follow-up clears.',
      badge: 'High pressure',
    };
  }

  if (progress >= 45) {
    return {
      title: 'Solid pace',
      body: 'The run is healthy. Use this window to build specials instead of burning moves on tiny matches.',
      badge: 'On pace',
    };
  }

  return {
    title: 'Opening the tray',
    body: 'Early game is all about space. Sweep quick matches low on the board and let gravity do some work for you.',
    badge: 'Warm-up',
  };
}

function getMilestones(targetScore: number, currentScore: number): Array<{
  label: string;
  score: number;
  reached: boolean;
}> {
  const milestoneDefs = [
    { label: 'Warm-Up', ratio: 0.25 },
    { label: 'Sweet Spot', ratio: 0.5 },
    { label: 'Sugar Rush', ratio: 0.75 },
    { label: 'Crown', ratio: 1 },
  ];

  return milestoneDefs.map((milestone) => {
    const score = Math.round(targetScore * milestone.ratio);
    return {
      label: milestone.label,
      score,
      reached: currentScore >= score,
    };
  });
}

function getStarTrack(targetScore: number, currentScore: number): Array<{
  label: string;
  score: number;
  reached: boolean;
}> {
  const tiers = [
    { label: 'Bronze Bite', ratio: 0.35 },
    { label: 'Silver Swirl', ratio: 0.7 },
    { label: 'Crown Crush', ratio: 1 },
  ];

  return tiers.map((tier) => {
    const score = Math.round(targetScore * tier.ratio);
    return {
      label: tier.label,
      score,
      reached: currentScore >= score,
    };
  });
}

function getBoardMix(
  grid: ReturnType<typeof useGameController>['board']['grid'],
  palette: ReturnType<typeof useGameController>['board']['palette'],
  candyLabels: CandyTheme['candyLabels'],
): Array<{
  color: ReturnType<typeof useGameController>['board']['palette'][number];
  label: string;
  count: number;
}> {
  return palette.map((color) => ({
    color,
    label: candyLabels[color],
    count: grid.flat().filter((tile) => tile?.color === color).length,
  }));
}

type RunLedgerCard = {
  label: string;
  value: string;
  note: string;
};

type LiveAnnouncement = {
  key: number;
  tone: 'badge' | 'prize' | 'victory';
  label: string;
  title: string;
  detail: string;
};

type PaceCard = {
  label: string;
  value: string;
  note: string;
};

type PaceStudio = {
  badge: string;
  title: string;
  body: string;
  summary: string;
  gapLabel: string;
  tone: 'opening' | 'ahead' | 'steady' | 'behind' | 'settled';
  chips: string[];
  cards: PaceCard[];
};

type BudgetCard = {
  label: string;
  value: string;
  note: string;
};

type MoveBudget = {
  badge: string;
  title: string;
  body: string;
  summary: string;
  cushionLabel: string;
  tone: 'opening' | 'surplus' | 'healthy' | 'tight' | 'rescue' | 'closed';
  chips: string[];
  cards: BudgetCard[];
};

type RunLedger = {
  badge: string;
  title: string;
  body: string;
  summary: string;
  tone: 'opening' | 'clean' | 'cascade' | 'power' | 'guided';
  pace: string;
  chips: string[];
  cards: RunLedgerCard[];
};

type TrophyCard = {
  title: string;
  detail: string;
  progress: string;
  stamp: string;
  state: 'unlocked' | 'active' | 'locked';
  priority: number;
};

type TrophySpotlight = {
  badge: string;
  title: string;
  body: string;
  chips: string[];
  tone: 'earned' | 'chase' | 'locked';
};

function getPaceStudio(input: {
  score: number;
  targetScore: number;
  movesRemaining: number;
  runStats: ReturnType<typeof useGameController>['runStats'];
  result: ReturnType<typeof useGameController>['board']['result'];
}): PaceStudio {
  const scoreGap = Math.max(0, input.targetScore - input.score);
  const scoringTurns = input.runStats.successfulTurns;
  const averagePerTurn = scoringTurns > 0 ? Math.round(input.score / scoringTurns) : 0;
  const requiredPerMove = input.movesRemaining > 0 ? Math.ceil(scoreGap / input.movesRemaining) : scoreGap;
  const projectedFinal = input.score + averagePerTurn * input.movesRemaining;
  const projectionGap = projectedFinal - input.targetScore;
  const cards: PaceCard[] = [
    {
      label: 'Current average',
      value: scoringTurns > 0 ? `${averagePerTurn} pts` : 'Waiting',
      note:
        scoringTurns > 0
          ? `Based on ${scoringTurns} scoring turn${pluralize(scoringTurns)} so far.`
          : 'Land one clean scoring turn and this panel starts projecting the run.',
    },
    {
      label: 'Needed now',
      value: input.movesRemaining > 0 ? `${requiredPerMove} pts` : `${scoreGap} pts`,
      note:
        input.movesRemaining > 0
          ? 'This is the average each remaining move needs to carry.'
          : 'No moves remain, so the final score is already locked in.',
    },
    {
      label: 'Projected finish',
      value: projectedFinal.toLocaleString(),
      note:
        scoringTurns > 0
          ? 'If the current scoring pace holds, this is where the run should land.'
          : 'Projection appears once the run has at least one scoring turn.',
    },
    {
      label: 'Best burst',
      value: input.runStats.bestTurnScore > 0 ? input.runStats.bestTurnScore.toLocaleString() : 'Waiting',
      note:
        input.runStats.bestTurnScore > 0
          ? 'One big burst turn can swing the pace meter quickly.'
          : 'Big combo turns will start setting the high-water mark here.',
    },
  ];

  if (input.result?.outcome === 'won') {
    return {
      badge: 'Target cleared',
      title: 'The pace already won the run',
      body: 'You are over the score line already, so every extra cascade from here is just bonus shine for the cabinet.',
      summary: 'The target is cleared, so the pace meter has shifted from survival math to style points.',
      gapLabel: `+${(input.score - input.targetScore).toLocaleString()} over`,
      tone: 'settled',
      chips: [`${input.score.toLocaleString()} score`, `${input.runStats.bestTurnScore.toLocaleString()} best turn`, 'Victory pace'],
      cards,
    };
  }

  if (input.result?.outcome === 'lost') {
    return {
      badge: 'Run closed',
      title: 'The score is locked in',
      body: 'The move jar is empty, so this panel is showing the final scoring pace from the run you just finished.',
      summary: 'No moves remain, so the pace story is complete for this board.',
      gapLabel: `${scoreGap.toLocaleString()} short`,
      tone: 'settled',
      chips: [`${input.score.toLocaleString()} score`, `${input.runStats.bestTurnScore.toLocaleString()} best turn`, 'Final pace'],
      cards,
    };
  }

  if (scoringTurns === 0) {
    return {
      badge: 'Projection pending',
      title: 'The run needs its first scoring turn',
      body: 'One clean match will give the pace meter enough information to project the finish and pressure level.',
      summary: 'One clean turn gives the pace meter something to project.',
      gapLabel: `${scoreGap.toLocaleString()} to go`,
      tone: 'opening',
      chips: [`${input.movesRemaining} moves left`, `${scoreGap.toLocaleString()} target gap`, 'No pace yet'],
      cards,
    };
  }

  if (projectedFinal >= input.targetScore + 600) {
    return {
      badge: 'Ahead of pace',
      title: 'The run is pacing above the target',
      body: 'Your current scoring average is healthy enough to clear the target with room left over, which means you can spend turns on higher-value special setups.',
      summary: 'The current scoring rhythm is beating the target math, so the board has breathing room.',
      gapLabel: `+${projectionGap.toLocaleString()} projected`,
      tone: 'ahead',
      chips: [`${averagePerTurn} avg`, `${requiredPerMove} needed`, `${projectedFinal.toLocaleString()} finish`],
      cards,
    };
  }

  if (projectedFinal >= input.targetScore - 200) {
    return {
      badge: 'Close to pace',
      title: 'The run is hovering near the line',
      body: 'You are close enough that one strong burst turn can flip the whole outlook, so guard your cleanest special-building lanes.',
      summary: 'The math is close, which means the next burst turn matters a lot.',
      gapLabel: `${projectionGap >= 0 ? '+' : ''}${projectionGap.toLocaleString()} projected`,
      tone: 'steady',
      chips: [`${averagePerTurn} avg`, `${requiredPerMove} needed`, `${projectedFinal.toLocaleString()} finish`],
      cards,
    };
  }

  return {
    badge: 'Need more pace',
    title: 'The score curve is behind target',
    body: 'The current average will not reach the target yet, so the safest recovery path is a stronger burst turn, a better cascade, or a special-candy setup.',
    summary: 'The run needs a bigger scoring swing to get back on target pace.',
    gapLabel: `${Math.abs(projectionGap).toLocaleString()} behind`,
    tone: 'behind',
    chips: [`${averagePerTurn} avg`, `${requiredPerMove} needed`, `${projectedFinal.toLocaleString()} finish`],
    cards,
  };
}

function getMoveBudget(input: {
  score: number;
  targetScore: number;
  movesRemaining: number;
  validMoveCount: number;
  liveSpecials: number;
  runStats: ReturnType<typeof useGameController>['runStats'];
  result: ReturnType<typeof useGameController>['board']['result'];
}): MoveBudget {
  const scoreGap = Math.max(0, input.targetScore - input.score);
  const scoringTurns = input.runStats.successfulTurns;
  const averagePerTurn = scoringTurns > 0 ? Math.round(input.score / scoringTurns) : 0;
  const requiredPerMove = input.movesRemaining > 0 ? Math.ceil(scoreGap / input.movesRemaining) : scoreGap;
  const movesToTargetAtCurrentPace =
    averagePerTurn > 0 && scoreGap > 0 ? Math.ceil(scoreGap / averagePerTurn) : scoreGap === 0 ? 0 : null;
  const moveCushion = movesToTargetAtCurrentPace === null ? null : input.movesRemaining - movesToTargetAtCurrentPace;
  const supportLoad = input.runStats.hintsUsed + input.runStats.shufflesUsed;
  const recoveryGap = Math.max(0, requiredPerMove - averagePerTurn);
  const cards: BudgetCard[] = [
    {
      label: 'Move cushion',
      value:
        moveCushion === null
          ? 'Waiting'
          : moveCushion > 0
            ? `+${moveCushion} move${pluralize(moveCushion)}`
            : moveCushion === 0
              ? 'Even line'
              : `${Math.abs(moveCushion)} short`,
      note:
        moveCushion === null
          ? 'One scoring turn will let the app estimate how much move cushion you really have.'
          : 'This is how many moves the current pace is projected to save or cost.',
    },
    {
      label: 'Burn rate',
      value: input.movesRemaining > 0 ? `${requiredPerMove} pts` : `${scoreGap} pts`,
      note:
        input.movesRemaining > 0
          ? 'Average points each remaining move needs to contribute.'
          : 'No moves remain, so the whole budget is already spent.',
    },
    {
      label: 'Recovery gap',
      value: scoringTurns > 0 ? `${recoveryGap} pts` : 'Waiting',
      note:
        scoringTurns > 0
          ? recoveryGap > 0
            ? 'Extra points per scoring turn needed to get back on budget.'
            : 'Current scoring turns are already covering the needed pace.'
          : 'Recovery math starts after the first scoring turn lands.',
    },
    {
      label: 'Board options',
      value: `${input.validMoveCount} swaps`,
      note:
        input.liveSpecials > 0
          ? `${input.liveSpecials} live special${pluralize(input.liveSpecials)} can help soften the move cost.`
          : 'No live specials right now, so safe move selection matters more.',
    },
  ];

  if (input.result) {
    return {
      badge: 'Budget closed',
      title: 'The move jar is finished',
      body: 'This run has already spent its full move budget, so the panel is showing the final economy after the board closed.',
      summary: 'The move budget is settled for this run.',
      cushionLabel: input.result.outcome === 'won' ? 'Target hit' : `${scoreGap.toLocaleString()} short`,
      tone: 'closed',
      chips: [`${input.movesRemaining} moves left`, `${input.validMoveCount} swaps`, `${input.liveSpecials} live specials`],
      cards,
    };
  }

  if (scoringTurns === 0) {
    return {
      badge: 'Budget pending',
      title: 'The run needs one scoring turn',
      body: 'Until the first real clear lands, the move budget can only see the remaining jar size, not how expensive each turn really is.',
      summary: 'One clean turn will start the move-budget math.',
      cushionLabel: `${input.movesRemaining} moves`,
      tone: 'opening',
      chips: [`${input.movesRemaining} moves left`, `${input.validMoveCount} swaps`, `${input.liveSpecials} live specials`],
      cards,
    };
  }

  if (moveCushion !== null && moveCushion >= 4) {
    return {
      badge: 'Surplus budget',
      title: 'The move jar has breathing room',
      body: 'At the current scoring pace, this run is projected to finish with several moves still unused. That gives you room to hunt cleaner special-candy setups.',
      summary: 'The current run is spending moves efficiently and keeping a real cushion.',
      cushionLabel: `+${moveCushion} spare`,
      tone: 'surplus',
      chips: [`${requiredPerMove} needed`, `${averagePerTurn} avg`, `${input.validMoveCount} swaps`],
      cards,
    };
  }

  if (moveCushion !== null && moveCushion >= 1) {
    return {
      badge: 'Healthy budget',
      title: 'The move budget is still positive',
      body: 'You are spending moves at a sustainable rate, but the margin is not huge yet. Protect burst turns and avoid cheap misses.',
      summary: 'The run has a little move cushion, but it is worth guarding.',
      cushionLabel: `+${moveCushion} spare`,
      tone: 'healthy',
      chips: [`${requiredPerMove} needed`, `${averagePerTurn} avg`, `${supportLoad} tools used`],
      cards,
    };
  }

  if (moveCushion !== null && moveCushion >= -2) {
    return {
      badge: 'Tight budget',
      title: 'The run is burning moves quickly',
      body: 'The current economy is close to the edge. One strong burst turn or live special activation can still pull the budget back into the safe zone.',
      summary: 'The move jar is close to even, so the next high-value turn matters a lot.',
      cushionLabel: moveCushion === 0 ? 'Even line' : `${Math.abs(moveCushion)} short`,
      tone: 'tight',
      chips: [`${requiredPerMove} needed`, `${averagePerTurn} avg`, `${input.liveSpecials} live specials`],
      cards,
    };
  }

  return {
    badge: 'Rescue budget',
    title: 'The move jar needs a swing turn',
    body: 'At the current pace, the run will run out of move budget before it hits the target. Prioritize a burst turn, a prism line, or a clean cascade route.',
    summary: 'The budget is behind pace and needs a bigger scoring swing.',
    cushionLabel: moveCushion === null ? 'No read yet' : `${Math.abs(moveCushion)} short`,
    tone: 'rescue',
    chips: [`${requiredPerMove} needed`, `${averagePerTurn} avg`, `${supportLoad} tools used`],
    cards,
  };
}

function getRunLedger(input: {
  runStats: ReturnType<typeof useGameController>['runStats'];
  boardScore: number;
  movesRemaining: number;
  prismLabel: string;
}): RunLedger {
  const attempts = input.runStats.successfulTurns + input.runStats.invalidSwaps;
  const accuracy = attempts === 0 ? 100 : Math.round((input.runStats.successfulTurns / attempts) * 100);
  const totalSpecials = input.runStats.stripedMinted + input.runStats.prismsMinted;
  const pace =
    input.runStats.successfulTurns === 0
      ? 'Fresh run'
      : `${input.runStats.successfulTurns} scoring turn${pluralize(input.runStats.successfulTurns)}`;

  const cards: RunLedgerCard[] = [
    {
      label: 'Scoring turns',
      value: input.runStats.successfulTurns.toString(),
      note:
        input.runStats.successfulTurns > 0
          ? `${input.boardScore.toLocaleString()} total points are already banked this run.`
          : 'The first clean clear will start the session ledger.',
    },
    {
      label: 'Best burst',
      value: input.runStats.highestCascade > 0 ? `${input.runStats.highestCascade} chain` : 'Waiting',
      note:
        input.runStats.highestCascade > 1
          ? 'Multi-step cascades are already showing up in this session.'
          : 'Center-board swaps usually give the best chance to extend a chain.',
    },
    {
      label: 'Specials minted',
      value: totalSpecials.toString(),
      note: `${input.runStats.stripedMinted} stripes and ${input.runStats.prismsMinted} ${formatLowerLabel(input.prismLabel)}${pluralize(input.runStats.prismsMinted)} crafted.`,
    },
    {
      label: 'Touch accuracy',
      value: `${accuracy}%`,
      note:
        input.runStats.invalidSwaps > 0
          ? `${input.runStats.invalidSwaps} bounced swap${pluralize(input.runStats.invalidSwaps)} so far.`
          : 'No bounced swaps yet. The run is staying clean.',
    },
  ];

  if (input.runStats.prismsMinted > 0) {
    return {
      badge: 'Power ledger',
      title: `${input.prismLabel} pressure is building`,
      body: `This run has already crafted a prism, which means the session has real swing-turn potential. Keep the board open so the next one lands cleanly.`,
      summary: `Your session is already converting strong turns into ${formatLowerLabel(input.prismLabel)} value.`,
      tone: 'power',
      pace,
      chips: [
        `${input.runStats.prismsMinted} ${formatLowerLabel(input.prismLabel)}${pluralize(input.runStats.prismsMinted)}`,
        `${input.runStats.bestTurnScore.toLocaleString()} best turn`,
        `${input.movesRemaining} moves left`,
      ],
      cards,
    };
  }

  if (input.runStats.highestCascade >= 3) {
    return {
      badge: 'Flow state',
      title: 'Cascades are carrying the run',
      body: `You have already hit a ${input.runStats.highestCascade}-step chain, so the session is leaning into gravity-driven scoring instead of tiny one-off clears.`,
      summary: 'The board rhythm is strong enough to create real chain turns.',
      tone: 'cascade',
      pace,
      chips: [
        `${input.runStats.highestCascade} chain best`,
        `${input.runStats.bestTurnScore.toLocaleString()} best turn`,
        `${input.movesRemaining} moves left`,
      ],
      cards,
    };
  }

  if (accuracy === 100 && input.runStats.successfulTurns >= 4) {
    return {
      badge: 'Clean hands',
      title: 'The session is staying precise',
      body: 'You are stringing together scoring turns without wasted swaps, which is exactly how strong boards stay flexible for special setups.',
      summary: 'The run is accurate, efficient, and still leaving room to build bigger turns.',
      tone: 'clean',
      pace,
      chips: [
        `${accuracy}% accuracy`,
        `${input.runStats.bestTurnScore.toLocaleString()} best turn`,
        `${input.movesRemaining} moves left`,
      ],
      cards,
    };
  }

  if (input.runStats.hintsUsed >= 2 || input.runStats.shufflesUsed > 0) {
    return {
      badge: 'Guided groove',
      title: 'Support tools are shaping the board',
      body: 'Hints and shuffles are helping this run stay alive. That is useful pressure relief, especially when the tray gets awkward.',
      summary: 'This session is leaning on helper tools to keep the candy flow healthy.',
      tone: 'guided',
      pace,
      chips: [
        `${input.runStats.hintsUsed} hint${pluralize(input.runStats.hintsUsed)}`,
        `${input.runStats.shufflesUsed} shuffle${pluralize(input.runStats.shufflesUsed)}`,
        `${input.movesRemaining} moves left`,
      ],
      cards,
    };
  }

  return {
    badge: 'Opening notes',
    title: 'The run is still taking shape',
    body: 'Early turns are about opening space, learning the tray, and banking the first special candy before the move jar gets tight.',
    summary: 'This ledger will fill in as soon as the run starts landing clears and building momentum.',
    tone: 'opening',
    pace,
    chips: [
      `${input.runStats.hintsUsed} hint${pluralize(input.runStats.hintsUsed)}`,
      `${input.runStats.shufflesUsed} shuffle${pluralize(input.runStats.shufflesUsed)}`,
      `${input.movesRemaining} moves left`,
    ],
    cards,
  };
}

function getTrophyCabinet(input: {
  runStats: ReturnType<typeof useGameController>['runStats'];
  boardScore: number;
  targetScore: number;
  result: ReturnType<typeof useGameController>['board']['result'];
  prismLabel: string;
}): {
  summary: string;
  unlockedCount: number;
  spotlight: TrophySpotlight;
  trophies: TrophyCard[];
} {
  const trophies: TrophyCard[] = [
    input.runStats.stripedMinted >= 1
      ? {
          title: 'Stripe Starter',
          detail: 'You minted your first striped candy this run and opened the board for cleaner follow-up clears.',
          progress: `${input.runStats.stripedMinted} stripes`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 2,
        }
      : {
          title: 'Stripe Starter',
          detail: 'Create one 4-candy match to unlock your first run badge.',
          progress: `${Math.min(input.runStats.successfulTurns, 1)} / 1`,
          stamp: input.runStats.successfulTurns > 0 ? 'In reach' : 'Locked',
          state: input.runStats.successfulTurns > 0 ? 'active' : 'locked',
          priority: 2,
        },
    input.runStats.prismsMinted >= 1
      ? {
          title: 'Prism Chef',
          detail: `A five-match paid off and crafted a ${formatLowerLabel(input.prismLabel)} for this session.`,
          progress: `${input.runStats.prismsMinted} crafted`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 5,
        }
      : {
          title: 'Prism Chef',
          detail: `Build a 5-candy line to craft a ${formatLowerLabel(input.prismLabel)} and unlock this badge.`,
          progress: `${Math.min(input.runStats.stripedMinted, 1)} / 1 stripe`,
          stamp: input.runStats.stripedMinted > 0 ? 'In reach' : 'Locked',
          state: input.runStats.stripedMinted > 0 ? 'active' : 'locked',
          priority: 5,
        },
    input.runStats.highestCascade >= 3
      ? {
          title: 'Cascade Club',
          detail: `You hit a ${input.runStats.highestCascade}-step chain, which means gravity is doing real work for your score.`,
          progress: `${input.runStats.highestCascade} chain`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 4,
        }
      : {
          title: 'Cascade Club',
          detail: 'Reach a 3-step cascade in one turn to unlock this chain badge.',
          progress: `${Math.min(input.runStats.highestCascade, 3)} / 3`,
          stamp: input.runStats.highestCascade >= 2 ? 'In reach' : 'Locked',
          state: input.runStats.highestCascade >= 2 ? 'active' : 'locked',
          priority: 4,
        },
    input.runStats.hintsUsed >= 1
      ? {
          title: 'Trail Finder',
          detail: 'You used the hint lamp to reveal a legal scoring lane during this run.',
          progress: `${input.runStats.hintsUsed} hint${pluralize(input.runStats.hintsUsed)}`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 1,
        }
      : {
          title: 'Trail Finder',
          detail: 'Tap Hint once to light up a swap and unlock this helper badge.',
          progress: '0 / 1',
          stamp: 'Locked',
          state: 'locked',
          priority: 1,
        },
    input.runStats.successfulTurns >= 5 && input.runStats.invalidSwaps === 0
      ? {
          title: 'Careful Hands',
          detail: 'Five clean scoring turns without a bounced swap earned this precision badge.',
          progress: `${input.runStats.successfulTurns} clean turns`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 3,
        }
      : {
          title: 'Careful Hands',
          detail:
            input.runStats.invalidSwaps === 0
              ? 'Keep landing scoring turns without a bounced swap to secure this accuracy badge.'
              : 'A bounced swap reset this badge for the current run.',
          progress:
            input.runStats.invalidSwaps === 0
              ? `${Math.min(input.runStats.successfulTurns, 5)} / 5`
              : `${input.runStats.invalidSwaps} bounce${pluralize(input.runStats.invalidSwaps)}`,
          stamp: input.runStats.invalidSwaps === 0 && input.runStats.successfulTurns > 0 ? 'In reach' : 'Locked',
          state: input.runStats.invalidSwaps === 0 && input.runStats.successfulTurns > 0 ? 'active' : 'locked',
          priority: 3,
        },
    input.result?.outcome === 'won'
      ? {
          title: 'Crown Run',
          detail: 'You cleared the target score and finished the session with a full victory badge.',
          progress: `${input.boardScore.toLocaleString()} pts`,
          stamp: 'Earned',
          state: 'unlocked',
          priority: 6,
        }
      : {
          title: 'Crown Run',
          detail: 'Finish the run above the target score to unlock the full crown badge.',
          progress: `${Math.min(100, Math.round((input.boardScore / input.targetScore) * 100))}%`,
          stamp: input.boardScore >= input.targetScore * 0.75 ? 'In reach' : 'Locked',
          state: input.boardScore >= input.targetScore * 0.75 ? 'active' : 'locked',
          priority: 6,
        },
  ];

  const unlockedCount = trophies.filter((trophy) => trophy.state === 'unlocked').length;
  const nextTrophy = trophies.find((trophy) => trophy.state === 'active') ?? trophies.find((trophy) => trophy.state === 'locked');
  const featuredEarned = [...trophies]
    .filter((trophy) => trophy.state === 'unlocked')
    .sort((left, right) => right.priority - left.priority)[0];
  const spotlight: TrophySpotlight = featuredEarned
    ? {
        badge: 'Featured earned badge',
        title: featuredEarned.title,
        body: `${featuredEarned.detail} Keep the board rolling and you can still unlock more before the run ends.`,
        chips: [
          featuredEarned.progress,
          `${unlockedCount} earned`,
          `${trophies.length - unlockedCount} left`,
        ],
        tone: 'earned',
      }
    : nextTrophy
      ? {
          badge: nextTrophy.state === 'active' ? 'Next badge in reach' : 'Locked target',
          title: nextTrophy.title,
          body: nextTrophy.detail,
          chips: [
            nextTrophy.progress,
            `${unlockedCount} earned`,
            `${trophies.length - unlockedCount} left`,
          ],
          tone: nextTrophy.state === 'active' ? 'chase' : 'locked',
        }
      : {
          badge: 'Cabinet complete',
          title: 'Every badge is unlocked',
          body: 'This run has already filled the whole cabinet, so every extra move is just candy-shop style points.',
          chips: [`${unlockedCount} earned`, 'Full cabinet', `${input.boardScore.toLocaleString()} pts`],
          tone: 'earned',
        };

  return {
    unlockedCount,
    trophies,
    spotlight,
    summary: nextTrophy
      ? `${nextTrophy.title} is the next badge in reach.`
      : 'The whole cabinet is unlocked for this run.',
  };
}

type MoveCoachCard = {
  label: string;
  value: string;
  note: string;
};

type MoveCoach = {
  badge: string;
  title: string;
  body: string;
  summary: string;
  tone: 'prism' | 'stripe' | 'cascade' | 'steady';
  validMoveCount: number;
  chips: string[];
  cards: MoveCoachCard[];
};

type MoveAnalysis = {
  move: Swap;
  createsPrism: boolean;
  createsStripe: boolean;
  cascadeCount: number;
  totalScore: number;
  resultBoard: BoardState | null;
  autoShuffled: boolean;
};

type FuturePeekCell = {
  row: number;
  col: number;
  color: string | null;
  special: string | null;
};

type FuturePeek = {
  badge: string;
  title: string;
  body: string;
  summary: string;
  lane: string;
  tone: 'future' | 'special' | 'cascade' | 'steady' | 'locked';
  chips: string[];
  previewCells: FuturePeekCell[];
};

function getMoveCoach(input: {
  board: BoardState;
  validMoves: Swap[];
  hintActive: boolean;
  prismLabel: string;
}): MoveCoach {
  if (input.validMoves.length === 0) {
    return {
      badge: 'Shuffle lane',
      title: 'The tray needs a refresh',
      body: 'No legal swaps are visible right now. Use Shuffle to reopen the board and rebuild the run.',
      summary: 'The board is out of legal moves, so the fastest recovery is a shuffle.',
      tone: 'steady',
      validMoveCount: 0,
      chips: ['No live swaps', 'Shuffle recommended', input.hintActive ? 'Hint lit' : 'Hint idle'],
      cards: [
        { label: 'Live swaps', value: '0', note: 'The tray is locked and needs a reset.' },
        { label: 'Best setup', value: 'Shuffle', note: 'Fresh candies will reopen scoring lanes.' },
        { label: 'Hint', value: input.hintActive ? 'Lit up' : 'Standby', note: 'Hints return once the tray can move again.' },
        { label: 'Chain routes', value: '0', note: 'No cascade routes are available until the board refreshes.' },
      ],
    };
  }

  const analyses = input.validMoves
    .map((move) => analyzeMove(input.board, move))
    .sort((left, right) => {
      if (Number(right.createsPrism) !== Number(left.createsPrism)) {
        return Number(right.createsPrism) - Number(left.createsPrism);
      }

      if (Number(right.createsStripe) !== Number(left.createsStripe)) {
        return Number(right.createsStripe) - Number(left.createsStripe);
      }

      if (right.cascadeCount !== left.cascadeCount) {
        return right.cascadeCount - left.cascadeCount;
      }

      return right.totalScore - left.totalScore;
    });

  const bestMove = analyses[0];
  const prismMoves = analyses.filter((analysis) => analysis.createsPrism).length;
  const stripeMoves = analyses.filter((analysis) => analysis.createsStripe).length;
  const cascadeMoves = analyses.filter((analysis) => analysis.cascadeCount > 1).length;
  const lane = describeMoveLane(bestMove.move);
  const hintValue = input.hintActive ? 'Lit up' : 'Standby';
  const hintNote = input.hintActive ? 'The board is already glowing on one scoring swap.' : 'Tap Hint when you want this lane highlighted.';

  if (bestMove.createsPrism) {
    return {
      badge: 'Power turn',
      title: `${input.prismLabel} setup is ready`,
      body: `A five-match line is already on the tray. Open ${lane.sentence} when you want a high-value rescue tool for the next crowded turn.`,
      summary: `${prismMoves} ${formatLowerLabel(input.prismLabel)} setup${pluralize(prismMoves)} is live on this board.`,
      tone: 'prism',
      validMoveCount: input.validMoves.length,
      chips: [
        `${prismMoves} prism setup${pluralize(prismMoves)}`,
        `${stripeMoves} stripe setup${pluralize(stripeMoves)}`,
        input.hintActive ? 'Hint lit' : 'Hint ready',
      ],
      cards: [
        { label: 'Live swaps', value: input.validMoves.length.toString(), note: 'The board still has room to choose the cleanest line.' },
        { label: 'Best setup', value: input.prismLabel, note: 'The highest-value move on the tray is a five-match.' },
        { label: 'Primary lane', value: lane.headline, note: lane.note },
        { label: 'Hint', value: hintValue, note: hintNote },
      ],
    };
  }

  if (bestMove.createsStripe) {
    return {
      badge: 'Build special',
      title: 'A striped candy is available',
      body: `A four-match is ready right now. Work ${lane.sentence} if you want to widen the board and set up the next special.`,
      summary: `${stripeMoves} stripe setup${pluralize(stripeMoves)} can be cashed in before the tray tightens up.`,
      tone: 'stripe',
      validMoveCount: input.validMoves.length,
      chips: [
        `${stripeMoves} stripe setup${pluralize(stripeMoves)}`,
        cascadeMoves > 0 ? `${cascadeMoves} cascade route${pluralize(cascadeMoves)}` : 'Center clears matter',
        input.hintActive ? 'Hint lit' : 'Hint ready',
      ],
      cards: [
        { label: 'Live swaps', value: input.validMoves.length.toString(), note: input.validMoves.length > 8 ? 'Plenty of legal swaps are still open.' : 'The tray is playable but worth planning.' },
        { label: 'Best setup', value: 'Striped candy', note: 'A four-match is your cleanest value play.' },
        { label: 'Primary lane', value: lane.headline, note: lane.note },
        { label: 'Hint', value: hintValue, note: hintNote },
      ],
    };
  }

  if (bestMove.cascadeCount > 1) {
    return {
      badge: 'Chain chance',
      title: 'A cascade-friendly clear is open',
      body: `You have a move that can spill into follow-up drops. Start in ${lane.sentence} to give gravity a better chance to chain the board.`,
      summary: `${cascadeMoves} live swap${pluralize(cascadeMoves)} can already roll into a cascade.`,
      tone: 'cascade',
      validMoveCount: input.validMoves.length,
      chips: [
        `${cascadeMoves} cascade route${pluralize(cascadeMoves)}`,
        `${stripeMoves} stripe setup${pluralize(stripeMoves)}`,
        input.board.movesRemaining <= 6 ? 'Closing moves' : 'Room to build',
      ],
      cards: [
        { label: 'Live swaps', value: input.validMoves.length.toString(), note: 'Several legal plays are still visible on the tray.' },
        { label: 'Best setup', value: 'Cascade clear', note: 'This move wins by opening multiple follow-up drops.' },
        { label: 'Primary lane', value: lane.headline, note: lane.note },
        { label: 'Hint', value: hintValue, note: hintNote },
      ],
    };
  }

  return {
    badge: 'Stable board',
    title: 'You have clean scoring options',
    body: `No huge special is showing yet, but ${input.validMoves.length} legal swaps are live. ${lane.headline} is the steadiest lane to keep the center open and the next board flexible.`,
    summary: `The tray is healthy with ${input.validMoves.length} legal swap${pluralize(input.validMoves.length)} to explore.`,
    tone: 'steady',
    validMoveCount: input.validMoves.length,
    chips: [
      `${input.validMoves.length} live swap${pluralize(input.validMoves.length)}`,
      input.board.movesRemaining <= 6 ? 'Closing moves' : 'Fresh tray',
      input.hintActive ? 'Hint lit' : 'Hint ready',
    ],
    cards: [
      { label: 'Live swaps', value: input.validMoves.length.toString(), note: 'The board is stable and can support a few safe turns.' },
      { label: 'Best setup', value: 'Clean clear', note: 'Use steady matches to reopen stronger special-making lanes.' },
      { label: 'Primary lane', value: lane.headline, note: lane.note },
      { label: 'Hint', value: hintValue, note: hintNote },
    ],
  };
}

function getFuturePeek(input: {
  board: BoardState;
  validMoves: Swap[];
  prismLabel: string;
  candyLabels: CandyTheme['candyLabels'];
}): FuturePeek {
  if (input.validMoves.length === 0) {
    return {
      badge: 'No future path',
      title: 'The tray is locked right now',
      body: 'There is no scoring future to preview because no legal swaps are visible on the board. A shuffle will reopen the next universe.',
      summary: 'This feature simulates the best move outcome, but the tray needs a legal move first.',
      lane: 'Shuffle needed',
      tone: 'locked',
      chips: ['0 live swaps', 'No preview board', 'Shuffle to reopen'],
      previewCells: flattenPreviewBoard(input.board),
    };
  }

  const analyses = input.validMoves
    .map((move) => analyzeMove(input.board, move))
    .sort((left, right) => {
      if (Number(right.createsPrism) !== Number(left.createsPrism)) {
        return Number(right.createsPrism) - Number(left.createsPrism);
      }

      if (Number(right.createsStripe) !== Number(left.createsStripe)) {
        return Number(right.createsStripe) - Number(left.createsStripe);
      }

      if (right.cascadeCount !== left.cascadeCount) {
        return right.cascadeCount - left.cascadeCount;
      }

      return right.totalScore - left.totalScore;
    });

  const bestMove = analyses[0];
  const lane = describeMoveLane(bestMove.move);
  const previewBoard = bestMove.resultBoard ?? input.board;
  const previewCells = flattenPreviewBoard(previewBoard);
  const autoShuffleChip = bestMove.autoShuffled ? 'Auto-shuffle follows' : 'Board stays readable';

  if (bestMove.createsPrism) {
    return {
      badge: 'Future special',
      title: `${input.prismLabel} appears in the preview`,
      body: `This simulation shows the board after the strongest available line resolves. Opening ${lane.sentence} should craft a ${formatLowerLabel(input.prismLabel)} and leave the tray in a new state.`,
      summary: 'This panel previews the likely post-move board instead of only highlighting where to tap.',
      lane: lane.headline,
      tone: 'special',
      chips: [
        `+${bestMove.totalScore.toLocaleString()} score`,
        `${bestMove.cascadeCount} cascade${pluralize(bestMove.cascadeCount)}`,
        autoShuffleChip,
      ],
      previewCells,
    };
  }

  if (bestMove.createsStripe || bestMove.cascadeCount > 1) {
    return {
      badge: 'Future chain',
      title: 'The simulated board opens into a chain turn',
      body: `The best lane on ${lane.headline.toLowerCase()} resolves into a board with better follow-up structure, which is useful when you want to play one move ahead instead of reacting afterward.`,
      summary: 'This is a small “what happens next” board, not just a hint arrow.',
      lane: lane.headline,
      tone: bestMove.createsStripe ? 'special' : 'cascade',
      chips: [
        `+${bestMove.totalScore.toLocaleString()} score`,
        `${bestMove.cascadeCount} cascade${pluralize(bestMove.cascadeCount)}`,
        bestMove.createsStripe ? 'Stripe lands' : autoShuffleChip,
      ],
      previewCells,
    };
  }

  return {
    badge: 'Future clear',
    title: 'The preview shows a safer next board',
    body: `No huge special lands in this branch, but the simulated board after ${lane.sentence} is cleaner and easier to read than the current tray.`,
    summary: 'This feature lets the player see a probable next board state before taking the move.',
    lane: lane.headline,
    tone: 'steady',
    chips: [
      `+${bestMove.totalScore.toLocaleString()} score`,
      `${bestMove.cascadeCount} cascade${pluralize(bestMove.cascadeCount)}`,
      autoShuffleChip,
    ],
    previewCells,
  };
}

function analyzeMove(board: BoardState, move: Swap): MoveAnalysis {
  const attempt = trySwap(board, move);
  const groups = attempt.resolveResult?.steps.flatMap((step) => step.matchedGroups) ?? [];
  const createdSpecials = groups
    .map((group) => group.createdSpecial)
    .filter((special): special is SpecialTileType => special !== null);

  return {
    move,
    createsPrism: createdSpecials.includes('colorBomb'),
    createsStripe: createdSpecials.some((special) => special === 'stripedH' || special === 'stripedV'),
    cascadeCount: attempt.resolveResult?.steps.length ?? 0,
    totalScore: attempt.resolveResult?.totalScore ?? 0,
    resultBoard: attempt.resolveResult?.board ?? null,
    autoShuffled: attempt.resolveResult?.autoShuffled ?? false,
  };
}

function flattenPreviewBoard(board: BoardState): FuturePeekCell[] {
  return board.grid.flatMap((row, rowIndex) =>
    row.map((tile, colIndex) => ({
      row: rowIndex,
      col: colIndex,
      color: tile?.color ?? null,
      special: tile?.special ?? null,
    })),
  );
}

function describeMoveLane(move: Swap): {
  headline: string;
  note: string;
  sentence: string;
} {
  if (move.from.row === move.to.row) {
    const leftCol = Math.min(move.from.col, move.to.col) + 1;
    const rightCol = Math.max(move.from.col, move.to.col) + 1;
    const headline = `Row ${move.from.row + 1}`;
    const note = `Columns ${leftCol}-${rightCol}`;

    return {
      headline,
      note,
      sentence: `${headline.toLowerCase()}, ${note.toLowerCase()}`,
    };
  }

  const topRow = Math.min(move.from.row, move.to.row) + 1;
  const bottomRow = Math.max(move.from.row, move.to.row) + 1;
  const headline = `Column ${move.from.col + 1}`;
  const note = `Rows ${topRow}-${bottomRow}`;

  return {
    headline,
    note,
    sentence: `${headline.toLowerCase()}, ${note.toLowerCase()}`,
  };
}

function pluralize(count: number): string {
  return count === 1 ? '' : 's';
}

function formatLowerLabel(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function formatJournalTone(tone: 'spotlight' | 'strategy' | 'warning' | 'finish'): string {
  switch (tone) {
    case 'spotlight':
      return 'Spotlight';
    case 'strategy':
      return 'Strategy';
    case 'warning':
      return 'Warning';
    case 'finish':
      return 'Finish';
    default:
      return tone;
  }
}

function getRunBadge(
  progress: number,
  movesRemaining: number,
  specialsCount: { striped: number; prism: number },
): {
  title: string;
  body: string;
  ribbon: string;
} {
  if (progress >= 100) {
    return {
      title: 'Crown Crusher',
      body: 'You are already over the target line, so this run is about style, surplus, and clean finishing chains.',
      ribbon: 'Goal cleared',
    };
  }

  if (specialsCount.prism > 0) {
    return {
      title: 'Prism Keeper',
      body: 'A prism is live on the board. Protect the lane around it and cash it in only when the tray gets crowded.',
      ribbon: 'Power turn ready',
    };
  }

  if (specialsCount.striped >= 2) {
    return {
      title: 'Stripe Conductor',
      body: 'You have multiple stripes online. Look for quick activations that open the center and keep gravity rolling.',
      ribbon: 'Combo pressure',
    };
  }

  if (progress >= 60) {
    return {
      title: 'Cascade Crafter',
      body: 'This run has momentum. Play for middle-board matches and let falling candies work for the next clear.',
      ribbon: 'On a streak',
    };
  }

  if (movesRemaining <= 6) {
    return {
      title: 'Clutch Mixer',
      body: 'Moves are running tight, so every swap needs value. Prefer setups that can create immediate chain reactions.',
      ribbon: 'Closing moves',
    };
  }

  return {
    title: 'Sweet Scout',
    body: 'You are still shaping the tray. Clear space low on the board and keep an eye on four-match opportunities.',
    ribbon: 'Opening run',
  };
}

function getRunChecklist(input: {
  nextTier: { label: string; score: number; reached: boolean } | null;
  currentScore: number;
  specialsCount: { striped: number; prism: number };
  dominantCandy: { color: string; label: string; count: number };
  movesRemaining: number;
  prismLabel: string;
}): Array<{
  title: string;
  detail: string;
  state: 'focus' | 'ready' | 'watch';
  stateLabel: string;
}> {
  const prizeItem = input.nextTier
    ? {
        title: `Unlock ${input.nextTier.label}`,
        detail: `${Math.max(0, input.nextTier.score - input.currentScore).toLocaleString()} more points reaches the next prize track tier.`,
        state: 'focus' as const,
        stateLabel: 'Focus',
      }
    : {
        title: 'All prize tiers cleared',
        detail: 'The full reward track is open, so spend the rest of the run on stylish cascades and extra score.',
        state: 'ready' as const,
        stateLabel: 'Ready',
      };

  const specialItem =
    input.specialsCount.prism > 0
      ? {
          title: `${input.prismLabel} is live`,
          detail: 'A prism is already on the board. Save it for the moment the tray gets crowded or one color starts dominating.',
          state: 'ready' as const,
          stateLabel: 'Ready',
        }
      : input.specialsCount.striped > 0
        ? {
            title: 'Open space for a prism',
            detail: 'A stripe is already live. Use it to widen the center lanes and create a cleaner five-match chance.',
            state: 'watch' as const,
            stateLabel: 'Watch',
          }
        : {
            title: 'Mint a striped candy',
            detail: 'Look for a 4-candy line near the middle of the board to start building higher-value turns.',
            state: 'focus' as const,
            stateLabel: 'Focus',
          };

  const boardItem =
    input.dominantCandy.count >= 12
      ? {
          title: `${input.dominantCandy.label} is flooding the tray`,
          detail: `There are ${input.dominantCandy.count} of this candy showing, so chain-friendly matches should be easier to spot.`,
          state: 'ready' as const,
          stateLabel: 'Ready',
        }
      : input.movesRemaining <= 6
        ? {
            title: 'Take a pressure turn',
            detail: 'Moves are tight now. Favor swaps that either clear the center or build an immediate special candy.',
            state: 'focus' as const,
            stateLabel: 'Focus',
          }
        : {
            title: 'Keep the tray flexible',
            detail: 'Use lower-board clears to refresh the top rows and improve your next set of match options.',
            state: 'watch' as const,
            stateLabel: 'Watch',
          };

  return [prizeItem, specialItem, boardItem];
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
