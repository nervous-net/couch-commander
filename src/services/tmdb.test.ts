// ABOUTME: Tests for TMDB API service.
// ABOUTME: Covers search and show detail fetching.

import { describe, it, expect } from 'vitest';
import { searchShows, getShowDetails } from './tmdb';

describe('TMDB Service', () => {
  describe('searchShows', () => {
    it('returns an array of show results for a valid query', async () => {
      const results = await searchShows('Breaking Bad');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('name');
    });

    it('returns empty array for nonsense query', async () => {
      const results = await searchShows('xyznonexistentshow123456');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('getShowDetails', () => {
    it('returns detailed show info including episode count', async () => {
      // Breaking Bad TMDB ID
      const details = await getShowDetails(1396);

      expect(details).toHaveProperty('id', 1396);
      expect(details).toHaveProperty('name', 'Breaking Bad');
      expect(details).toHaveProperty('totalSeasons');
      expect(details).toHaveProperty('totalEpisodes');
      expect(details).toHaveProperty('episodeRuntime');
      expect(details).toHaveProperty('genres');
      expect(details.totalSeasons).toBeGreaterThan(0);
      expect(details.totalEpisodes).toBeGreaterThan(0);
    });

    it('throws error for invalid show ID', async () => {
      await expect(getShowDetails(999999999)).rejects.toThrow();
    });
  });
});
