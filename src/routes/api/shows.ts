// ABOUTME: API routes for searching and managing TV shows.
// ABOUTME: Interfaces with TMDB API for show data.

import { Router } from 'express';
import { searchShows } from '../../services/tmdb';

const router = Router();

router.get('/search', async (req, res) => {
  const query = req.query.query as string;

  if (!query || query.length < 2) {
    return res.render('partials/showSearchResults', { results: [] });
  }

  try {
    const results = await searchShows(query);
    res.render('partials/showSearchResults', { results: results.slice(0, 10) });
  } catch (error) {
    console.error('Search error:', error);
    res.render('partials/showSearchResults', { results: [] });
  }
});

export default router;
