// ABOUTME: Tests for TMDB API service.
// ABOUTME: Covers search and show detail fetching.

import { describe, it, expect } from 'vitest';
import { searchShows } from './tmdb';

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
});
