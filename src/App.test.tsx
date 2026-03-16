import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
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
  });
});
