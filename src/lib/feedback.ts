export type FeedbackPayload = {
  title: string;
  message: string;
  score: number;
  movesRemaining: number;
};

export async function submitFeedback({
  title,
  message,
  score,
  movesRemaining,
}: FeedbackPayload): Promise<void> {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title.trim(),
      message: message.trim(),
      score,
      movesRemaining,
    }),
  });

  if (response.ok) {
    return;
  }

  let errorMessage = 'Unable to send feedback right now.';
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      errorMessage = payload.error;
    }
  } catch {
    // Keep the default message when the response body is empty or not JSON.
  }

  throw new Error(errorMessage);
}
