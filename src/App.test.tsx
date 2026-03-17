import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the HUD, handles tutorial overlay flow, and restarts the board shell', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('dialog', { name: 'Welcome to Sugar Drop Saga' })).toBeInTheDocument();
    expect(screen.getByText('Moves')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Let's Play" }));
    expect(screen.queryByRole('dialog', { name: 'Welcome to Sugar Drop Saga' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'How to Play' }));
    expect(screen.getByRole('dialog', { name: 'Welcome to Sugar Drop Saga' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Restart' }));

    expect(screen.queryByRole('dialog', { name: 'Welcome to Sugar Drop Saga' })).not.toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Match 3 board' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Opening the tray' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Read the next best turn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent board moments' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Track the session rhythm' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Read the score pace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guard the move jar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Unlock sweet run badges' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stripe Starter', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('One clean turn gives the pace meter something to project.')).toBeInTheDocument();
    expect(screen.getByText('One clean turn will start the move-budget math.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live candy balance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sweet Scout' })).toBeInTheDocument();
    expect(screen.getByText('Bronze Bite')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What to chase next' })).toBeInTheDocument();
  });

  it('submits feedback in the background', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: "Let's Play" }));
    await user.click(screen.getByRole('button', { name: 'Feedback' }));

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Feature request');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Please add more special candies.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({ method: 'POST' }));
    expect(await screen.findByText('Feedback sent. Thanks for helping improve the game.')).toBeInTheDocument();
  });

  it('switches candy themes from settings', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: "Let's Play" }));
    await user.click(screen.getByRole('button', { name: 'Tune' }));
    await user.click(screen.getByRole('button', { name: 'Use Citrus Splash theme' }));

    expect(container.firstChild).toHaveAttribute('data-theme', 'citrus-splash');
    expect(screen.getByLabelText('Active candy theme: Citrus Splash')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Splash Market Mix' })).toBeInTheDocument();
  });

  it('shows a hint highlight when requested', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: "Let's Play" }));
    await user.click(screen.getByRole('button', { name: 'Hint' }));

    expect(screen.getByText('Highlighted candies show one possible scoring swap.')).toBeInTheDocument();
    expect(screen.getByText('Hint Lit')).toBeInTheDocument();
    expect(screen.getAllByText('1 hint').length).toBeGreaterThan(1);
    expect(screen.getByText('Badge Earned')).toBeInTheDocument();
    expect(screen.getByText('Trail Finder just joined the cabinet for this run.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trail Finder', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('You used the hint lamp to reveal a legal scoring lane during this run.')).toBeInTheDocument();
  });
});
