// ABOUTME: API routes for managing watchlist entries.
// ABOUTME: Handles add, remove, and reorder operations.

import { Router } from 'express';
import { cacheShow } from '../../services/showCache';
import { addToWatchlist, removeFromWatchlist } from '../../services/watchlist';
import { clearSchedule } from '../../services/scheduler';

const router = Router();

router.post('/', async (req, res) => {
  const { tmdbId } = req.body;

  if (!tmdbId) {
    return res.status(400).json({ error: 'tmdbId required' });
  }

  try {
    const show = await cacheShow(Number(tmdbId));
    await addToWatchlist(show.id);
    await clearSchedule(); // Force regeneration
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ error: 'Failed to add show' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await removeFromWatchlist(Number(id));
    await clearSchedule();
    res.send(''); // htmx expects empty response for swap
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ error: 'Failed to remove show' });
  }
});

export default router;
