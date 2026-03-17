import { submitFeedback } from './feedback';

describe('submitFeedback', () => {
  it('posts the feedback payload to the background endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    await submitFeedback({
      title: 'Board bug',
      message: 'The striped candy did not fire.',
      score: 1380,
      movesRemaining: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Board bug',
        message: 'The striped candy did not fire.',
        score: 1380,
        movesRemaining: 4,
      }),
    });
  });

  it('throws the server message when the request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Feedback delivery is not configured on the server.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      submitFeedback({
        title: 'Board bug',
        message: 'The striped candy did not fire.',
        score: 1380,
        movesRemaining: 4,
      }),
    ).rejects.toThrow('Feedback delivery is not configured on the server.');
  });
});
