// ABOUTME: Entry point for the Couch Commander Express application.
// ABOUTME: Sets up the server, middleware, and routes.

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5055;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Couch Commander running on http://localhost:${PORT}`);
});

export default app;
