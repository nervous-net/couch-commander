// ABOUTME: Page route for the watchlist view.
// ABOUTME: Displays current watchlist with management options.

import { Router, Response } from 'express';
import { getWatchlist } from '../services/watchlist';

const router = Router();

function renderWithLayout(
  res: Response,
  page: string,
  data: Record<string, unknown>
) {
  res.render(`pages/${page}`, data, (err, body) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error rendering page');
    }
    res.render('layouts/main', { ...data, body });
  });
}

router.get('/', async (_req, res) => {
  const watchlist = await getWatchlist();

  renderWithLayout(res, 'watchlist', {
    title: 'Watchlist',
    watchlist,
  });
});

export default router;
