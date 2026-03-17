import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';

const DEFAULT_PORT = 5174;
const DEFAULT_TO_EMAIL = 'chatgnanam@gmail.com';
const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.status(200).json({ ok: true });
});

app.post('/api/feedback', async (request, response) => {
  const title = normalizeField(request.body?.title, 120);
  const message = normalizeField(request.body?.message, 1200);
  const score = Number.isFinite(request.body?.score) ? Number(request.body.score) : 0;
  const movesRemaining = Number.isFinite(request.body?.movesRemaining) ? Number(request.body.movesRemaining) : 0;

  if (!title || !message) {
    response.status(400).json({ error: 'Title and message are required.' });
    return;
  }

  if (!isConfigured()) {
    response.status(503).json({ error: 'Feedback delivery is not configured on the server.' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: String(process.env.SMTP_SECURE ?? 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.FEEDBACK_FROM_EMAIL ?? process.env.SMTP_USER,
      to: process.env.FEEDBACK_TO_EMAIL ?? DEFAULT_TO_EMAIL,
      subject: `[Sugar Drop Saga] ${title}`,
      text: [
        message,
        '',
        `Score: ${score}`,
        `Moves remaining: ${movesRemaining}`,
        `Sent at: ${new Date().toISOString()}`,
      ].join('\n'),
    });

    response.status(204).end();
  } catch (error) {
    console.error('Failed to send feedback email.', error);
    response.status(502).json({ error: 'Unable to send feedback right now.' });
  }
});

app.listen(Number(process.env.FEEDBACK_PORT ?? DEFAULT_PORT), '127.0.0.1', () => {
  console.log(`Feedback server ready on http://127.0.0.1:${process.env.FEEDBACK_PORT ?? DEFAULT_PORT}`);
});

function normalizeField(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
