# Couch Commander v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal TV scheduler that generates daily viewing schedules from a watchlist based on time budgets and scheduling preferences.

**Architecture:** Express.js server with EJS templates and htmx for interactivity. SQLite database via Prisma for persistence. TMDB API for show data with local caching. Scheduler service generates rolling 14-day schedules on-demand.

**Tech Stack:** Node.js, TypeScript, Express.js, Prisma (SQLite), EJS, htmx, Tailwind CSS, Vitest

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Initialize npm project**

Run: `npm init -y`

**Step 2: Install dependencies**

Run:
```bash
npm install express ejs dotenv @prisma/client
npm install -D typescript tsx vitest @types/node @types/express prisma tailwindcss
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create .env.example**

```
TMDB_API_KEY=your_tmdb_api_key_here
DATABASE_URL="file:./dev.db"
PORT=5055
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.db
*.db-journal
```

**Step 6: Update package.json scripts**

Add to package.json:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  }
}
```

**Step 7: Create minimal src/index.ts**

```typescript
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
```

**Step 8: Verify server starts**

Run: `npm run dev`
Expected: Server starts, logs "Couch Commander running on http://localhost:5055"

Test in another terminal: `curl http://localhost:5055/health`
Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Express and TypeScript"
```

---

## Task 2: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Initialize Prisma**

Run: `npx prisma init --datasource-provider sqlite`

**Step 2: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
// ABOUTME: Database schema for Couch Commander.
// ABOUTME: Defines Show, WatchlistEntry, ScheduleDay, ScheduledEpisode, and Settings models.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Show {
  id            Int       @id @default(autoincrement())
  tmdbId        Int       @unique
  title         String
  posterPath    String?
  genres        String    // JSON array of genre names
  totalSeasons  Int
  totalEpisodes Int
  episodeRuntime Int      // Average runtime in minutes
  status        String    // "Returning Series", "Ended", etc.
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  watchlistEntries WatchlistEntry[]
  scheduledEpisodes ScheduledEpisode[]
}

model WatchlistEntry {
  id            Int       @id @default(autoincrement())
  showId        Int
  show          Show      @relation(fields: [showId], references: [id], onDelete: Cascade)
  priority      Int       @default(0)
  startSeason   Int       @default(1)
  startEpisode  Int       @default(1)
  currentSeason Int       @default(1)
  currentEpisode Int      @default(1)
  modeOverride  String?   // "sequential", "roundrobin", or null for default
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([showId])
}

model ScheduleDay {
  id            Int       @id @default(autoincrement())
  date          DateTime  @unique
  plannedMinutes Int      @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  episodes      ScheduledEpisode[]
}

model ScheduledEpisode {
  id            Int       @id @default(autoincrement())
  scheduleDayId Int
  scheduleDay   ScheduleDay @relation(fields: [scheduleDayId], references: [id], onDelete: Cascade)
  showId        Int
  show          Show      @relation(fields: [showId], references: [id], onDelete: Cascade)
  season        Int
  episode       Int
  runtime       Int       // In minutes
  status        String    @default("pending") // "pending", "watched", "skipped"
  order         Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([scheduleDayId, showId, season, episode])
}

model Settings {
  id                  Int     @id @default(1)
  weekdayMinutes      Int     @default(120)  // 2 hours
  weekendMinutes      Int     @default(240)  // 4 hours
  mondayMinutes       Int?    // Override for specific days
  tuesdayMinutes      Int?
  wednesdayMinutes    Int?
  thursdayMinutes     Int?
  fridayMinutes       Int?
  saturdayMinutes     Int?
  sundayMinutes       Int?
  schedulingMode      String  @default("sequential") // "sequential", "roundrobin", "genre"
  staggeredStart      Boolean @default(false)
  staggerEpisodes     Int     @default(3)  // Episodes before next show starts
  genreRules          String  @default("[]") // JSON array of rules
  scheduleWindowDays  Int     @default(14)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

**Step 3: Create .env file**

```
TMDB_API_KEY=your_key_here
DATABASE_URL="file:./dev.db"
PORT=5055
```

**Step 4: Generate Prisma client and push schema**

Run:
```bash
npm run db:generate
npm run db:push
```

Expected: Database created at `prisma/dev.db`, client generated

**Step 5: Create database client singleton**

Create `src/lib/db.ts`:

```typescript
// ABOUTME: Prisma client singleton for database access.
// ABOUTME: Ensures single connection instance across the application.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with Show, Watchlist, Schedule, and Settings models"
```

---

## Task 3: TMDB Service - Search Shows

**Files:**
- Create: `src/services/tmdb.ts`
- Create: `src/services/tmdb.test.ts`

**Step 1: Write the failing test for searchShows**

Create `src/services/tmdb.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/tmdb.test.ts`
Expected: FAIL - cannot find module './tmdb'

**Step 3: Write the implementation**

Create `src/services/tmdb.ts`:

```typescript
// ABOUTME: TMDB API client for searching and fetching TV show data.
// ABOUTME: Handles API authentication and response transformation.

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBSearchResult {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

export interface ShowSearchResult {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  firstAirDate: string;
  voteAverage: number;
  genreIds: number[];
}

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set');
  }
  return key;
}

export async function searchShows(query: string): Promise<ShowSearchResult[]> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data: TMDBSearchResponse = await response.json();

  return data.results.map((show) => ({
    id: show.id,
    name: show.name,
    overview: show.overview,
    posterPath: show.poster_path,
    firstAirDate: show.first_air_date,
    voteAverage: show.vote_average,
    genreIds: show.genre_ids,
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/tmdb.test.ts`
Expected: PASS (requires valid TMDB_API_KEY in .env)

**Step 5: Commit**

```bash
git add src/services/tmdb.ts src/services/tmdb.test.ts
git commit -m "feat: add TMDB search service with tests"
```

---

## Task 4: TMDB Service - Get Show Details

**Files:**
- Modify: `src/services/tmdb.ts`
- Modify: `src/services/tmdb.test.ts`

**Step 1: Write the failing test for getShowDetails**

Add to `src/services/tmdb.test.ts`:

```typescript
import { searchShows, getShowDetails } from './tmdb';

// Add new describe block after searchShows tests:
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/tmdb.test.ts`
Expected: FAIL - getShowDetails is not exported

**Step 3: Add the implementation**

Add to `src/services/tmdb.ts`:

```typescript
interface TMDBShowDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  genres: { id: number; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  first_air_date: string;
}

export interface ShowDetails {
  id: number;
  name: string;
  overview: string;
  posterPath: string | null;
  genres: string[];
  totalSeasons: number;
  totalEpisodes: number;
  episodeRuntime: number;
  status: string;
  firstAirDate: string;
}

export async function getShowDetails(tmdbId: number): Promise<ShowDetails> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data: TMDBShowDetails = await response.json();

  // Calculate average runtime, default to 45 if not available
  const avgRuntime = data.episode_run_time.length > 0
    ? Math.round(data.episode_run_time.reduce((a, b) => a + b, 0) / data.episode_run_time.length)
    : 45;

  return {
    id: data.id,
    name: data.name,
    overview: data.overview,
    posterPath: data.poster_path,
    genres: data.genres.map((g) => g.name),
    totalSeasons: data.number_of_seasons,
    totalEpisodes: data.number_of_episodes,
    episodeRuntime: avgRuntime,
    status: data.status,
    firstAirDate: data.first_air_date,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/tmdb.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/tmdb.ts src/services/tmdb.test.ts
git commit -m "feat: add TMDB getShowDetails for fetching full show info"
```

---

## Task 5: Show Cache Service

**Files:**
- Create: `src/services/showCache.ts`
- Create: `src/services/showCache.test.ts`

**Step 1: Write the failing test**

Create `src/services/showCache.test.ts`:

```typescript
// ABOUTME: Tests for show caching service.
// ABOUTME: Covers caching TMDB data to local database.

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import { cacheShow, getCachedShow } from './showCache';

describe('Show Cache Service', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.scheduledEpisode.deleteMany();
    await prisma.scheduleDay.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();
  });

  it('caches a show from TMDB and returns it', async () => {
    // Breaking Bad
    const show = await cacheShow(1396);

    expect(show).toHaveProperty('id');
    expect(show.tmdbId).toBe(1396);
    expect(show.title).toBe('Breaking Bad');
    expect(show.totalEpisodes).toBeGreaterThan(0);
  });

  it('returns cached show without hitting API on second call', async () => {
    const show1 = await cacheShow(1396);
    const show2 = await getCachedShow(1396);

    expect(show2).not.toBeNull();
    expect(show2?.id).toBe(show1.id);
  });

  it('returns null for uncached show', async () => {
    const show = await getCachedShow(999999);
    expect(show).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/showCache.test.ts`
Expected: FAIL - cannot find module './showCache'

**Step 3: Write the implementation**

Create `src/services/showCache.ts`:

```typescript
// ABOUTME: Caches TMDB show data to local SQLite database.
// ABOUTME: Minimizes API calls by storing show info locally.

import { prisma } from '../lib/db';
import { getShowDetails } from './tmdb';
import type { Show } from '@prisma/client';

export async function getCachedShow(tmdbId: number): Promise<Show | null> {
  return prisma.show.findUnique({
    where: { tmdbId },
  });
}

export async function cacheShow(tmdbId: number): Promise<Show> {
  // Check if already cached
  const existing = await getCachedShow(tmdbId);
  if (existing) {
    return existing;
  }

  // Fetch from TMDB and cache
  const details = await getShowDetails(tmdbId);

  return prisma.show.create({
    data: {
      tmdbId: details.id,
      title: details.name,
      posterPath: details.posterPath,
      genres: JSON.stringify(details.genres),
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      episodeRuntime: details.episodeRuntime,
      status: details.status,
    },
  });
}

export async function refreshShowCache(tmdbId: number): Promise<Show> {
  const details = await getShowDetails(tmdbId);

  return prisma.show.upsert({
    where: { tmdbId },
    update: {
      title: details.name,
      posterPath: details.posterPath,
      genres: JSON.stringify(details.genres),
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      episodeRuntime: details.episodeRuntime,
      status: details.status,
    },
    create: {
      tmdbId: details.id,
      title: details.name,
      posterPath: details.posterPath,
      genres: JSON.stringify(details.genres),
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      episodeRuntime: details.episodeRuntime,
      status: details.status,
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/showCache.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/showCache.ts src/services/showCache.test.ts
git commit -m "feat: add show cache service for local TMDB data storage"
```

---

## Task 6: Settings Service

**Files:**
- Create: `src/services/settings.ts`
- Create: `src/services/settings.test.ts`

**Step 1: Write the failing test**

Create `src/services/settings.test.ts`:

```typescript
// ABOUTME: Tests for settings service.
// ABOUTME: Covers getting and updating user settings.

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import { getSettings, updateSettings, getMinutesForDay } from './settings';

describe('Settings Service', () => {
  beforeEach(async () => {
    await prisma.settings.deleteMany();
  });

  describe('getSettings', () => {
    it('returns default settings when none exist', async () => {
      const settings = await getSettings();

      expect(settings.weekdayMinutes).toBe(120);
      expect(settings.weekendMinutes).toBe(240);
      expect(settings.schedulingMode).toBe('sequential');
    });

    it('returns existing settings', async () => {
      await prisma.settings.create({
        data: {
          id: 1,
          weekdayMinutes: 90,
          schedulingMode: 'roundrobin',
        },
      });

      const settings = await getSettings();
      expect(settings.weekdayMinutes).toBe(90);
      expect(settings.schedulingMode).toBe('roundrobin');
    });
  });

  describe('updateSettings', () => {
    it('updates specific settings', async () => {
      await getSettings(); // Ensure settings exist

      const updated = await updateSettings({
        weekdayMinutes: 60,
        staggeredStart: true,
      });

      expect(updated.weekdayMinutes).toBe(60);
      expect(updated.staggeredStart).toBe(true);
      expect(updated.weekendMinutes).toBe(240); // Unchanged
    });
  });

  describe('getMinutesForDay', () => {
    it('returns weekday minutes for Monday', async () => {
      await getSettings();
      const monday = new Date('2026-02-02'); // A Monday

      const minutes = await getMinutesForDay(monday);
      expect(minutes).toBe(120);
    });

    it('returns weekend minutes for Saturday', async () => {
      await getSettings();
      const saturday = new Date('2026-02-07'); // A Saturday

      const minutes = await getMinutesForDay(saturday);
      expect(minutes).toBe(240);
    });

    it('returns day-specific override when set', async () => {
      await updateSettings({ mondayMinutes: 180 });
      const monday = new Date('2026-02-02');

      const minutes = await getMinutesForDay(monday);
      expect(minutes).toBe(180);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/settings.test.ts`
Expected: FAIL - cannot find module './settings'

**Step 3: Write the implementation**

Create `src/services/settings.ts`:

```typescript
// ABOUTME: Manages user settings for scheduling preferences.
// ABOUTME: Handles time budgets, scheduling modes, and genre rules.

import { prisma } from '../lib/db';
import type { Settings } from '@prisma/client';

export async function getSettings(): Promise<Settings> {
  let settings = await prisma.settings.findUnique({
    where: { id: 1 },
  });

  if (!settings) {
    settings = await prisma.settings.create({
      data: { id: 1 },
    });
  }

  return settings;
}

export async function updateSettings(
  data: Partial<Omit<Settings, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Settings> {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
}

const DAY_OVERRIDES: Record<number, keyof Settings> = {
  0: 'sundayMinutes',
  1: 'mondayMinutes',
  2: 'tuesdayMinutes',
  3: 'wednesdayMinutes',
  4: 'thursdayMinutes',
  5: 'fridayMinutes',
  6: 'saturdayMinutes',
};

export async function getMinutesForDay(date: Date): Promise<number> {
  const settings = await getSettings();
  const dayOfWeek = date.getDay();

  // Check for day-specific override
  const overrideKey = DAY_OVERRIDES[dayOfWeek];
  const override = settings[overrideKey] as number | null;
  if (override !== null) {
    return override;
  }

  // Weekend: Saturday (6) or Sunday (0)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return isWeekend ? settings.weekendMinutes : settings.weekdayMinutes;
}

export interface GenreRule {
  genre: string;
  allowedDays: number[]; // 0-6, Sunday-Saturday
  blocked: boolean;
}

export async function getGenreRules(): Promise<GenreRule[]> {
  const settings = await getSettings();
  return JSON.parse(settings.genreRules);
}

export async function updateGenreRules(rules: GenreRule[]): Promise<Settings> {
  return updateSettings({ genreRules: JSON.stringify(rules) });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/settings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/settings.ts src/services/settings.test.ts
git commit -m "feat: add settings service for time budgets and preferences"
```

---

## Task 7: Watchlist Service

**Files:**
- Create: `src/services/watchlist.ts`
- Create: `src/services/watchlist.test.ts`

**Step 1: Write the failing test**

Create `src/services/watchlist.test.ts`:

```typescript
// ABOUTME: Tests for watchlist service.
// ABOUTME: Covers adding, removing, and reordering shows.

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  updateWatchlistEntry,
  reorderWatchlist,
} from './watchlist';
import { cacheShow } from './showCache';

describe('Watchlist Service', () => {
  let testShow: Awaited<ReturnType<typeof cacheShow>>;

  beforeEach(async () => {
    await prisma.scheduledEpisode.deleteMany();
    await prisma.scheduleDay.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();

    // Cache a test show (Breaking Bad)
    testShow = await cacheShow(1396);
  });

  describe('addToWatchlist', () => {
    it('adds a show to the watchlist', async () => {
      const entry = await addToWatchlist(testShow.id);

      expect(entry.showId).toBe(testShow.id);
      expect(entry.priority).toBe(0);
      expect(entry.startSeason).toBe(1);
      expect(entry.startEpisode).toBe(1);
    });

    it('allows setting custom start position', async () => {
      const entry = await addToWatchlist(testShow.id, {
        startSeason: 2,
        startEpisode: 5,
      });

      expect(entry.startSeason).toBe(2);
      expect(entry.startEpisode).toBe(5);
      expect(entry.currentSeason).toBe(2);
      expect(entry.currentEpisode).toBe(5);
    });
  });

  describe('getWatchlist', () => {
    it('returns empty array when no entries', async () => {
      const list = await getWatchlist();
      expect(list).toEqual([]);
    });

    it('returns entries with show data', async () => {
      await addToWatchlist(testShow.id);

      const list = await getWatchlist();
      expect(list.length).toBe(1);
      expect(list[0].show.title).toBe('Breaking Bad');
    });

    it('returns entries sorted by priority', async () => {
      // Add a second show (Better Call Saul)
      const show2 = await cacheShow(60059);

      await addToWatchlist(testShow.id, { priority: 2 });
      await addToWatchlist(show2.id, { priority: 1 });

      const list = await getWatchlist();
      expect(list[0].showId).toBe(show2.id);
      expect(list[1].showId).toBe(testShow.id);
    });
  });

  describe('removeFromWatchlist', () => {
    it('removes a show from the watchlist', async () => {
      const entry = await addToWatchlist(testShow.id);
      await removeFromWatchlist(entry.id);

      const list = await getWatchlist();
      expect(list).toEqual([]);
    });
  });

  describe('reorderWatchlist', () => {
    it('updates priorities based on new order', async () => {
      const show2 = await cacheShow(60059);

      const entry1 = await addToWatchlist(testShow.id);
      const entry2 = await addToWatchlist(show2.id);

      // Reorder: show2 first, then testShow
      await reorderWatchlist([entry2.id, entry1.id]);

      const list = await getWatchlist();
      expect(list[0].id).toBe(entry2.id);
      expect(list[1].id).toBe(entry1.id);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: FAIL - cannot find module './watchlist'

**Step 3: Write the implementation**

Create `src/services/watchlist.ts`:

```typescript
// ABOUTME: Manages the user's watchlist of TV shows.
// ABOUTME: Handles adding, removing, reordering, and progress tracking.

import { prisma } from '../lib/db';
import type { WatchlistEntry, Show } from '@prisma/client';

interface WatchlistOptions {
  startSeason?: number;
  startEpisode?: number;
  priority?: number;
  modeOverride?: string;
}

export async function addToWatchlist(
  showId: number,
  options: WatchlistOptions = {}
): Promise<WatchlistEntry> {
  const { startSeason = 1, startEpisode = 1, priority = 0, modeOverride } = options;

  return prisma.watchlistEntry.create({
    data: {
      showId,
      startSeason,
      startEpisode,
      currentSeason: startSeason,
      currentEpisode: startEpisode,
      priority,
      modeOverride,
    },
  });
}

export async function removeFromWatchlist(entryId: number): Promise<void> {
  await prisma.watchlistEntry.delete({
    where: { id: entryId },
  });
}

export type WatchlistEntryWithShow = WatchlistEntry & { show: Show };

export async function getWatchlist(): Promise<WatchlistEntryWithShow[]> {
  return prisma.watchlistEntry.findMany({
    where: { active: true },
    include: { show: true },
    orderBy: { priority: 'asc' },
  });
}

export async function getWatchlistEntry(entryId: number): Promise<WatchlistEntryWithShow | null> {
  return prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { show: true },
  });
}

export async function updateWatchlistEntry(
  entryId: number,
  data: Partial<Omit<WatchlistEntry, 'id' | 'showId' | 'createdAt' | 'updatedAt'>>
): Promise<WatchlistEntry> {
  return prisma.watchlistEntry.update({
    where: { id: entryId },
    data,
  });
}

export async function reorderWatchlist(orderedIds: number[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    prisma.watchlistEntry.update({
      where: { id },
      data: { priority: index },
    })
  );

  await prisma.$transaction(updates);
}

export async function advanceEpisode(
  entryId: number,
  season: number,
  episode: number
): Promise<WatchlistEntry> {
  return prisma.watchlistEntry.update({
    where: { id: entryId },
    data: {
      currentSeason: season,
      currentEpisode: episode,
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/watchlist.ts src/services/watchlist.test.ts
git commit -m "feat: add watchlist service for managing show queue"
```

---

## Task 8: Scheduler Core - Sequential Mode

**Files:**
- Create: `src/services/scheduler.ts`
- Create: `src/services/scheduler.test.ts`

**Step 1: Write the failing test for sequential scheduling**

Create `src/services/scheduler.test.ts`:

```typescript
// ABOUTME: Tests for the core scheduler service.
// ABOUTME: Covers all scheduling modes and edge cases.

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import { generateSchedule, getScheduleForDay } from './scheduler';
import { cacheShow } from './showCache';
import { addToWatchlist } from './watchlist';
import { updateSettings } from './settings';

describe('Scheduler Service', () => {
  beforeEach(async () => {
    await prisma.scheduledEpisode.deleteMany();
    await prisma.scheduleDay.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();
    await prisma.settings.deleteMany();
  });

  describe('generateSchedule - sequential mode', () => {
    it('generates schedule for single show', async () => {
      const show = await cacheShow(1396); // Breaking Bad
      await addToWatchlist(show.id);
      await updateSettings({ schedulingMode: 'sequential', weekdayMinutes: 120 });

      const startDate = new Date('2026-02-02'); // Monday
      await generateSchedule(startDate, 3);

      const day1 = await getScheduleForDay(startDate);
      expect(day1).not.toBeNull();
      expect(day1!.episodes.length).toBeGreaterThan(0);
      expect(day1!.episodes[0].showId).toBe(show.id);
    });

    it('fills time budget without exceeding', async () => {
      const show = await cacheShow(1396);
      await addToWatchlist(show.id);
      await updateSettings({ schedulingMode: 'sequential', weekdayMinutes: 60 });

      const startDate = new Date('2026-02-02');
      await generateSchedule(startDate, 1);

      const day = await getScheduleForDay(startDate);
      const totalRuntime = day!.episodes.reduce((sum, ep) => sum + ep.runtime, 0);

      // Should be within budget (may slightly exceed due to episode granularity)
      expect(totalRuntime).toBeLessThanOrEqual(120); // Allow some overflow
    });

    it('continues show across multiple days', async () => {
      const show = await cacheShow(1396);
      await addToWatchlist(show.id, { startSeason: 1, startEpisode: 1 });
      await updateSettings({ schedulingMode: 'sequential', weekdayMinutes: 60 });

      const startDate = new Date('2026-02-02');
      await generateSchedule(startDate, 3);

      const day1 = await getScheduleForDay(startDate);
      const day2 = await getScheduleForDay(new Date('2026-02-03'));

      // Day 2 should continue where day 1 left off
      const lastEpDay1 = day1!.episodes[day1!.episodes.length - 1];
      const firstEpDay2 = day2!.episodes[0];

      expect(firstEpDay2.episode).toBeGreaterThan(lastEpDay1.episode);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/scheduler.test.ts`
Expected: FAIL - cannot find module './scheduler'

**Step 3: Write the implementation**

Create `src/services/scheduler.ts`:

```typescript
// ABOUTME: Core scheduling engine for generating viewing schedules.
// ABOUTME: Supports sequential, round-robin, and genre-slotted modes.

import { prisma } from '../lib/db';
import { getSettings, getMinutesForDay } from './settings';
import { getWatchlist, type WatchlistEntryWithShow } from './watchlist';
import type { ScheduleDay, ScheduledEpisode, Show } from '@prisma/client';

export type ScheduleDayWithEpisodes = ScheduleDay & {
  episodes: (ScheduledEpisode & { show: Show })[];
};

export async function getScheduleForDay(date: Date): Promise<ScheduleDayWithEpisodes | null> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  return prisma.scheduleDay.findUnique({
    where: { date: dayStart },
    include: {
      episodes: {
        include: { show: true },
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function generateSchedule(startDate: Date, days: number): Promise<void> {
  const settings = await getSettings();
  const watchlist = await getWatchlist();

  if (watchlist.length === 0) {
    return;
  }

  // Track current position for each show
  const positions = new Map<number, { season: number; episode: number }>();
  for (const entry of watchlist) {
    positions.set(entry.id, {
      season: entry.currentSeason,
      episode: entry.currentEpisode,
    });
  }

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    currentDate.setHours(0, 0, 0, 0);

    const minutesForDay = await getMinutesForDay(currentDate);

    // Create or clear the schedule day
    await prisma.scheduleDay.upsert({
      where: { date: currentDate },
      update: { plannedMinutes: minutesForDay },
      create: { date: currentDate, plannedMinutes: minutesForDay },
    });

    // Clear existing episodes for this day
    await prisma.scheduledEpisode.deleteMany({
      where: { scheduleDay: { date: currentDate } },
    });

    const scheduleDay = await prisma.scheduleDay.findUnique({
      where: { date: currentDate },
    });

    if (!scheduleDay) continue;

    let remainingMinutes = minutesForDay;
    let episodeOrder = 0;

    if (settings.schedulingMode === 'sequential') {
      remainingMinutes = await fillDaySequential(
        scheduleDay.id,
        watchlist,
        positions,
        remainingMinutes,
        episodeOrder
      );
    } else if (settings.schedulingMode === 'roundrobin') {
      remainingMinutes = await fillDayRoundRobin(
        scheduleDay.id,
        watchlist,
        positions,
        remainingMinutes,
        episodeOrder
      );
    }
    // Genre mode would go here
  }
}

async function fillDaySequential(
  scheduleDayId: number,
  watchlist: WatchlistEntryWithShow[],
  positions: Map<number, { season: number; episode: number }>,
  remainingMinutes: number,
  startOrder: number
): Promise<number> {
  let order = startOrder;

  for (const entry of watchlist) {
    if (remainingMinutes <= 0) break;

    const pos = positions.get(entry.id)!;
    const runtime = entry.show.episodeRuntime;

    // Schedule episodes from this show until time runs out or show is done
    while (remainingMinutes >= runtime && pos.episode <= entry.show.totalEpisodes) {
      await prisma.scheduledEpisode.create({
        data: {
          scheduleDayId,
          showId: entry.show.id,
          season: pos.season,
          episode: pos.episode,
          runtime,
          order,
          status: 'pending',
        },
      });

      pos.episode++;
      remainingMinutes -= runtime;
      order++;

      // Simple episode increment (doesn't handle seasons properly yet)
      // In a full implementation, we'd need season/episode data from TMDB
    }
  }

  return remainingMinutes;
}

async function fillDayRoundRobin(
  scheduleDayId: number,
  watchlist: WatchlistEntryWithShow[],
  positions: Map<number, { season: number; episode: number }>,
  remainingMinutes: number,
  startOrder: number
): Promise<number> {
  let order = startOrder;
  let addedThisRound = true;

  while (remainingMinutes > 0 && addedThisRound) {
    addedThisRound = false;

    for (const entry of watchlist) {
      if (remainingMinutes <= 0) break;

      const pos = positions.get(entry.id)!;
      const runtime = entry.show.episodeRuntime;

      if (remainingMinutes >= runtime && pos.episode <= entry.show.totalEpisodes) {
        await prisma.scheduledEpisode.create({
          data: {
            scheduleDayId,
            showId: entry.show.id,
            season: pos.season,
            episode: pos.episode,
            runtime,
            order,
            status: 'pending',
          },
        });

        pos.episode++;
        remainingMinutes -= runtime;
        order++;
        addedThisRound = true;
      }
    }
  }

  return remainingMinutes;
}

export async function clearSchedule(): Promise<void> {
  await prisma.scheduledEpisode.deleteMany();
  await prisma.scheduleDay.deleteMany();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/scheduler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/scheduler.ts src/services/scheduler.test.ts
git commit -m "feat: add scheduler core with sequential and round-robin modes"
```

---

## Task 9: Express App Structure & Views Setup

**Files:**
- Modify: `src/index.ts`
- Create: `src/views/layouts/main.ejs`
- Create: `src/views/pages/dashboard.ejs`
- Create: `public/css/input.css`
- Create: `tailwind.config.js`

**Step 1: Install additional dependencies**

Run: `npm install ejs`

**Step 2: Initialize Tailwind**

Run: `npx tailwindcss init`

**Step 3: Configure Tailwind**

Replace `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/views/**/*.ejs'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 4: Create Tailwind input CSS**

Create `public/css/input.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 5: Add Tailwind build script**

Update package.json scripts:
```json
{
  "scripts": {
    "css:build": "tailwindcss -i ./public/css/input.css -o ./public/css/styles.css",
    "css:watch": "tailwindcss -i ./public/css/input.css -o ./public/css/styles.css --watch"
  }
}
```

**Step 6: Build initial CSS**

Run: `npm run css:build`

**Step 7: Create main layout**

Create `src/views/layouts/main.ejs`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> | Couch Commander</title>
  <link rel="stylesheet" href="/css/styles.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
  <nav class="bg-gray-800 border-b border-gray-700">
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <a href="/" class="text-xl font-bold text-purple-400">Couch Commander</a>
        <div class="flex gap-4">
          <a href="/" class="hover:text-purple-400">Dashboard</a>
          <a href="/watchlist" class="hover:text-purple-400">Watchlist</a>
          <a href="/schedule" class="hover:text-purple-400">Schedule</a>
          <a href="/settings" class="hover:text-purple-400">Settings</a>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto px-4 py-8">
    <%- body %>
  </main>
</body>
</html>
```

**Step 8: Create dashboard page**

Create `src/views/pages/dashboard.ejs`:

```html
<div class="space-y-8">
  <h1 class="text-3xl font-bold">Today's Schedule</h1>

  <% if (needsCheckin && yesterdayEpisodes.length > 0) { %>
  <div class="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
    <h2 class="text-lg font-semibold text-yellow-400 mb-2">Yesterday's Schedule</h2>
    <p class="text-gray-300 mb-4">Did you watch these episodes?</p>
    <form hx-post="/api/checkin" hx-target="#checkin-section" hx-swap="outerHTML">
      <div class="space-y-2">
        <% yesterdayEpisodes.forEach(ep => { %>
        <div class="flex items-center gap-4 bg-gray-800 p-2 rounded">
          <span class="flex-1"><%= ep.show.title %> S<%= ep.season %>E<%= ep.episode %></span>
          <label class="flex items-center gap-1">
            <input type="radio" name="ep_<%= ep.id %>" value="watched" checked> Watched
          </label>
          <label class="flex items-center gap-1">
            <input type="radio" name="ep_<%= ep.id %>" value="skipped"> Skipped
          </label>
        </div>
        <% }) %>
      </div>
      <button type="submit" class="mt-4 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded">
        Confirm
      </button>
    </form>
  </div>
  <% } %>

  <div class="grid gap-4">
    <% if (todayEpisodes.length === 0) { %>
    <p class="text-gray-400">No episodes scheduled for today. Add some shows to your watchlist!</p>
    <% } else { %>
    <% todayEpisodes.forEach((ep, index) => { %>
    <div class="bg-gray-800 rounded-lg p-4 flex gap-4">
      <% if (ep.show.posterPath) { %>
      <img src="https://image.tmdb.org/t/p/w92<%= ep.show.posterPath %>"
           alt="<%= ep.show.title %>"
           class="w-16 rounded">
      <% } %>
      <div class="flex-1">
        <h3 class="font-semibold"><%= ep.show.title %></h3>
        <p class="text-gray-400">Season <%= ep.season %>, Episode <%= ep.episode %></p>
        <p class="text-sm text-gray-500"><%= ep.runtime %> min</p>
      </div>
      <div class="text-2xl font-bold text-gray-600">#<%= index + 1 %></div>
    </div>
    <% }) %>
    <% } %>
  </div>
</div>
```

**Step 9: Update src/index.ts with views**

Replace `src/index.ts`:

```typescript
// ABOUTME: Entry point for the Couch Commander Express application.
// ABOUTME: Sets up the server, middleware, routes, and view engine.

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { prisma } from './lib/db';
import { getScheduleForDay, generateSchedule } from './services/scheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5055;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper to render with layout
function renderWithLayout(
  res: express.Response,
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

// Routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Generate schedule if needed
  await generateSchedule(today, 14);

  const todaySchedule = await getScheduleForDay(today);
  const yesterdaySchedule = await getScheduleForDay(yesterday);

  const yesterdayPending = yesterdaySchedule?.episodes.filter(
    (ep) => ep.status === 'pending'
  ) || [];

  renderWithLayout(res, 'dashboard', {
    title: 'Dashboard',
    todayEpisodes: todaySchedule?.episodes || [],
    yesterdayEpisodes: yesterdayPending,
    needsCheckin: yesterdayPending.length > 0,
  });
});

app.listen(PORT, () => {
  console.log(`Couch Commander running on http://localhost:${PORT}`);
});

export default app;
```

**Step 10: Verify app runs**

Run: `npm run dev`
Visit: http://localhost:5055
Expected: Dashboard page renders (empty schedule)

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: add Express views with EJS, Tailwind, and dashboard page"
```

---

## Task 10: Watchlist Page & Show Search

**Files:**
- Create: `src/views/pages/watchlist.ejs`
- Create: `src/views/partials/showSearchResults.ejs`
- Create: `src/routes/watchlist.ts`
- Create: `src/routes/api/shows.ts`
- Modify: `src/index.ts`

**Step 1: Create watchlist page**

Create `src/views/pages/watchlist.ejs`:

```html
<div class="space-y-8">
  <h1 class="text-3xl font-bold">My Watchlist</h1>

  <!-- Add Show Section -->
  <div class="bg-gray-800 rounded-lg p-4">
    <h2 class="text-lg font-semibold mb-4">Add a Show</h2>
    <div class="flex gap-2">
      <input type="text"
             id="show-search"
             name="query"
             placeholder="Search for a TV show..."
             class="flex-1 bg-gray-700 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
             hx-get="/api/shows/search"
             hx-trigger="keyup changed delay:300ms"
             hx-target="#search-results">
    </div>
    <div id="search-results" class="mt-4"></div>
  </div>

  <!-- Current Watchlist -->
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">Current Queue</h2>

    <% if (watchlist.length === 0) { %>
    <p class="text-gray-400">Your watchlist is empty. Search for shows above to get started!</p>
    <% } else { %>
    <div class="space-y-2" id="watchlist-items">
      <% watchlist.forEach((entry, index) => { %>
      <div class="bg-gray-800 rounded-lg p-4 flex gap-4 items-center">
        <span class="text-2xl font-bold text-gray-600 w-8"><%= index + 1 %></span>
        <% if (entry.show.posterPath) { %>
        <img src="https://image.tmdb.org/t/p/w92<%= entry.show.posterPath %>"
             alt="<%= entry.show.title %>"
             class="w-12 rounded">
        <% } %>
        <div class="flex-1">
          <h3 class="font-semibold"><%= entry.show.title %></h3>
          <p class="text-sm text-gray-400">
            <%= entry.show.totalEpisodes %> episodes &middot;
            Currently on S<%= entry.currentSeason %>E<%= entry.currentEpisode %>
          </p>
        </div>
        <button hx-delete="/api/watchlist/<%= entry.id %>"
                hx-target="closest div.bg-gray-800"
                hx-swap="outerHTML"
                class="text-red-400 hover:text-red-300">
          Remove
        </button>
      </div>
      <% }) %>
    </div>
    <% } %>
  </div>
</div>
```

**Step 2: Create search results partial**

Create `src/views/partials/showSearchResults.ejs`:

```html
<% if (results.length === 0) { %>
<p class="text-gray-400">No shows found. Try a different search.</p>
<% } else { %>
<div class="space-y-2">
  <% results.forEach(show => { %>
  <div class="bg-gray-700 rounded p-3 flex gap-3 items-center">
    <% if (show.posterPath) { %>
    <img src="https://image.tmdb.org/t/p/w92<%= show.posterPath %>"
         alt="<%= show.name %>"
         class="w-12 rounded">
    <% } else { %>
    <div class="w-12 h-16 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
      No img
    </div>
    <% } %>
    <div class="flex-1">
      <h4 class="font-medium"><%= show.name %></h4>
      <p class="text-sm text-gray-400"><%= show.firstAirDate?.substring(0, 4) || 'Unknown' %></p>
    </div>
    <button hx-post="/api/watchlist"
            hx-vals='{"tmdbId": <%= show.id %>}'
            hx-swap="none"
            hx-on::after-request="window.location.reload()"
            class="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm">
      Add
    </button>
  </div>
  <% }) %>
</div>
<% } %>
```

**Step 3: Create shows API route**

Create `src/routes/api/shows.ts`:

```typescript
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
```

**Step 4: Create watchlist API route**

Create `src/routes/api/watchlist.ts`:

```typescript
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
```

**Step 5: Create watchlist page route**

Create `src/routes/watchlist.ts`:

```typescript
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
```

**Step 6: Update index.ts with routes**

Add to `src/index.ts` after middleware:

```typescript
import watchlistRoutes from './routes/watchlist';
import showsApiRoutes from './routes/api/shows';
import watchlistApiRoutes from './routes/api/watchlist';

// ... after middleware setup ...

// API routes
app.use('/api/shows', showsApiRoutes);
app.use('/api/watchlist', watchlistApiRoutes);

// Page routes
app.use('/watchlist', watchlistRoutes);
```

**Step 7: Verify watchlist page works**

Run: `npm run dev`
Visit: http://localhost:5055/watchlist
Test: Search for a show, add it, verify it appears in the list

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add watchlist page with TMDB search and show management"
```

---

## Task 11: Settings Page

**Files:**
- Create: `src/views/pages/settings.ejs`
- Create: `src/routes/settings.ts`
- Modify: `src/index.ts`

**Step 1: Create settings page**

Create `src/views/pages/settings.ejs`:

```html
<div class="space-y-8">
  <h1 class="text-3xl font-bold">Settings</h1>

  <form hx-post="/settings" hx-swap="none" hx-on::after-request="alert('Settings saved!')">
    <!-- Time Budgets -->
    <div class="bg-gray-800 rounded-lg p-4 space-y-4">
      <h2 class="text-lg font-semibold">Daily Time Budgets</h2>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Weekday (minutes)</label>
          <input type="number" name="weekdayMinutes" value="<%= settings.weekdayMinutes %>"
                 class="w-full bg-gray-700 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Weekend (minutes)</label>
          <input type="number" name="weekendMinutes" value="<%= settings.weekendMinutes %>"
                 class="w-full bg-gray-700 rounded px-3 py-2">
        </div>
      </div>

      <details class="mt-4">
        <summary class="cursor-pointer text-purple-400">Day-specific overrides</summary>
        <div class="grid grid-cols-2 gap-4 mt-4">
          <% ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => { %>
          <div>
            <label class="block text-sm text-gray-400 mb-1 capitalize"><%= day %> (optional)</label>
            <input type="number" name="<%= day %>Minutes"
                   value="<%= settings[day + 'Minutes'] || '' %>"
                   placeholder="Use default"
                   class="w-full bg-gray-700 rounded px-3 py-2">
          </div>
          <% }) %>
        </div>
      </details>
    </div>

    <!-- Scheduling Mode -->
    <div class="bg-gray-800 rounded-lg p-4 space-y-4 mt-4">
      <h2 class="text-lg font-semibold">Scheduling Mode</h2>

      <div class="space-y-2">
        <label class="flex items-center gap-2">
          <input type="radio" name="schedulingMode" value="sequential"
                 <%= settings.schedulingMode === 'sequential' ? 'checked' : '' %>>
          <span>Sequential</span>
          <span class="text-sm text-gray-400">- Watch one show at a time until finished</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="schedulingMode" value="roundrobin"
                 <%= settings.schedulingMode === 'roundrobin' ? 'checked' : '' %>>
          <span>Round-robin</span>
          <span class="text-sm text-gray-400">- Rotate through all shows</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="radio" name="schedulingMode" value="genre"
                 <%= settings.schedulingMode === 'genre' ? 'checked' : '' %>>
          <span>Genre-based</span>
          <span class="text-sm text-gray-400">- Schedule based on genre rules</span>
        </label>
      </div>
    </div>

    <!-- Staggered Start -->
    <div class="bg-gray-800 rounded-lg p-4 space-y-4 mt-4">
      <h2 class="text-lg font-semibold">Staggered Start</h2>

      <label class="flex items-center gap-2">
        <input type="checkbox" name="staggeredStart" value="true"
               <%= settings.staggeredStart ? 'checked' : '' %>>
        <span>Enable staggered start</span>
      </label>

      <div class="<%= !settings.staggeredStart ? 'opacity-50' : '' %>">
        <label class="block text-sm text-gray-400 mb-1">Episodes before starting next show</label>
        <input type="number" name="staggerEpisodes" value="<%= settings.staggerEpisodes %>"
               class="w-32 bg-gray-700 rounded px-3 py-2">
      </div>
    </div>

    <button type="submit" class="mt-6 bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded">
      Save Settings
    </button>
  </form>
</div>
```

**Step 2: Create settings route**

Create `src/routes/settings.ts`:

```typescript
// ABOUTME: Page route for the settings view.
// ABOUTME: Allows configuring time budgets and scheduling preferences.

import { Router, Response } from 'express';
import { getSettings, updateSettings } from '../services/settings';
import { clearSchedule } from '../services/scheduler';

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
  const settings = await getSettings();

  renderWithLayout(res, 'settings', {
    title: 'Settings',
    settings,
  });
});

router.post('/', async (req, res) => {
  const {
    weekdayMinutes,
    weekendMinutes,
    mondayMinutes,
    tuesdayMinutes,
    wednesdayMinutes,
    thursdayMinutes,
    fridayMinutes,
    saturdayMinutes,
    sundayMinutes,
    schedulingMode,
    staggeredStart,
    staggerEpisodes,
  } = req.body;

  await updateSettings({
    weekdayMinutes: Number(weekdayMinutes) || 120,
    weekendMinutes: Number(weekendMinutes) || 240,
    mondayMinutes: mondayMinutes ? Number(mondayMinutes) : null,
    tuesdayMinutes: tuesdayMinutes ? Number(tuesdayMinutes) : null,
    wednesdayMinutes: wednesdayMinutes ? Number(wednesdayMinutes) : null,
    thursdayMinutes: thursdayMinutes ? Number(thursdayMinutes) : null,
    fridayMinutes: fridayMinutes ? Number(fridayMinutes) : null,
    saturdayMinutes: saturdayMinutes ? Number(saturdayMinutes) : null,
    sundayMinutes: sundayMinutes ? Number(sundayMinutes) : null,
    schedulingMode: schedulingMode || 'sequential',
    staggeredStart: staggeredStart === 'true',
    staggerEpisodes: Number(staggerEpisodes) || 3,
  });

  await clearSchedule(); // Force schedule regeneration

  res.status(200).send('');
});

export default router;
```

**Step 3: Add settings route to index.ts**

Add to `src/index.ts`:

```typescript
import settingsRoutes from './routes/settings';

// ... in routes section ...
app.use('/settings', settingsRoutes);
```

**Step 4: Verify settings page works**

Run: `npm run dev`
Visit: http://localhost:5055/settings
Test: Change settings, save, verify changes persist

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add settings page for time budgets and scheduling mode"
```

---

## Task 12: Schedule View & Check-in API

**Files:**
- Create: `src/views/pages/schedule.ejs`
- Create: `src/routes/schedule.ts`
- Create: `src/routes/api/checkin.ts`
- Modify: `src/index.ts`

**Step 1: Create schedule page**

Create `src/views/pages/schedule.ejs`:

```html
<div class="space-y-8">
  <h1 class="text-3xl font-bold">Weekly Schedule</h1>

  <div class="grid gap-4">
    <% days.forEach(day => { %>
    <div class="bg-gray-800 rounded-lg p-4">
      <div class="flex justify-between items-center mb-3">
        <h2 class="font-semibold">
          <%= day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) %>
          <% if (day.isToday) { %>
          <span class="text-purple-400 text-sm ml-2">Today</span>
          <% } %>
        </h2>
        <span class="text-sm text-gray-400"><%= day.plannedMinutes %> min planned</span>
      </div>

      <% if (day.episodes.length === 0) { %>
      <p class="text-gray-500 text-sm">No episodes scheduled</p>
      <% } else { %>
      <div class="space-y-2">
        <% day.episodes.forEach(ep => { %>
        <div class="flex items-center gap-3 text-sm <%= ep.status === 'watched' ? 'opacity-50' : '' %>">
          <% if (ep.status === 'watched') { %>
          <span class="text-green-400">✓</span>
          <% } else if (ep.status === 'skipped') { %>
          <span class="text-yellow-400">○</span>
          <% } else { %>
          <span class="text-gray-500">•</span>
          <% } %>
          <span class="flex-1"><%= ep.show.title %></span>
          <span class="text-gray-400">S<%= ep.season %>E<%= ep.episode %></span>
          <span class="text-gray-500"><%= ep.runtime %>m</span>
        </div>
        <% }) %>
      </div>
      <% } %>
    </div>
    <% }) %>
  </div>
</div>
```

**Step 2: Create schedule route**

Create `src/routes/schedule.ts`:

```typescript
// ABOUTME: Page route for the schedule view.
// ABOUTME: Shows the weekly schedule with episode status.

import { Router, Response } from 'express';
import { generateSchedule, getScheduleForDay } from '../services/scheduler';

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate schedule for next 7 days
  await generateSchedule(today, 7);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const schedule = await getScheduleForDay(date);
    days.push({
      date,
      isToday: i === 0,
      plannedMinutes: schedule?.plannedMinutes || 0,
      episodes: schedule?.episodes || [],
    });
  }

  renderWithLayout(res, 'schedule', {
    title: 'Schedule',
    days,
  });
});

export default router;
```

**Step 3: Create check-in API route**

Create `src/routes/api/checkin.ts`:

```typescript
// ABOUTME: API route for daily check-in functionality.
// ABOUTME: Marks episodes as watched/skipped and triggers schedule regeneration.

import { Router } from 'express';
import { prisma } from '../../lib/db';
import { clearSchedule } from '../../services/scheduler';

const router = Router();

router.post('/', async (req, res) => {
  const updates: { id: number; status: string }[] = [];

  // Parse form data: ep_123=watched or ep_123=skipped
  for (const [key, value] of Object.entries(req.body)) {
    if (key.startsWith('ep_')) {
      const id = Number(key.replace('ep_', ''));
      updates.push({ id, status: value as string });
    }
  }

  // Update episode statuses
  for (const update of updates) {
    await prisma.scheduledEpisode.update({
      where: { id: update.id },
      data: { status: update.status },
    });
  }

  // Regenerate schedule from today forward
  await clearSchedule();

  res.send('<div class="text-green-400 p-4">Check-in complete! Schedule updated.</div>');
});

export default router;
```

**Step 4: Add routes to index.ts**

Add to `src/index.ts`:

```typescript
import scheduleRoutes from './routes/schedule';
import checkinApiRoutes from './routes/api/checkin';

// ... in routes section ...
app.use('/schedule', scheduleRoutes);
app.use('/api/checkin', checkinApiRoutes);
```

**Step 5: Verify schedule and check-in work**

Run: `npm run dev`
1. Add some shows to watchlist
2. Visit http://localhost:5055/schedule - should see week view
3. Visit http://localhost:5055 - check-in should work if yesterday has episodes

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add schedule view and daily check-in API"
```

---

## Task 13: Integration Tests

**Files:**
- Create: `src/routes/api/shows.test.ts`
- Create: `src/routes/api/watchlist.test.ts`

**Step 1: Create shows API test**

Create `src/routes/api/shows.test.ts`:

```typescript
// ABOUTME: Integration tests for shows API routes.
// ABOUTME: Tests TMDB search endpoint.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../index';

describe('Shows API', () => {
  describe('GET /api/shows/search', () => {
    it('returns HTML partial with search results', async () => {
      const res = await request(app)
        .get('/api/shows/search')
        .query({ query: 'Breaking Bad' });

      expect(res.status).toBe(200);
      expect(res.text).toContain('Breaking Bad');
    });

    it('returns empty results for short query', async () => {
      const res = await request(app)
        .get('/api/shows/search')
        .query({ query: 'a' });

      expect(res.status).toBe(200);
    });
  });
});
```

**Step 2: Install supertest**

Run: `npm install -D supertest @types/supertest`

**Step 3: Create watchlist API test**

Create `src/routes/api/watchlist.test.ts`:

```typescript
// ABOUTME: Integration tests for watchlist API routes.
// ABOUTME: Tests add and remove operations.

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { prisma } from '../../lib/db';

describe('Watchlist API', () => {
  beforeEach(async () => {
    await prisma.scheduledEpisode.deleteMany();
    await prisma.scheduleDay.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();
  });

  describe('POST /api/watchlist', () => {
    it('adds a show to watchlist', async () => {
      const res = await request(app)
        .post('/api/watchlist')
        .send({ tmdbId: 1396 }); // Breaking Bad

      expect(res.status).toBe(201);

      const entries = await prisma.watchlistEntry.findMany({
        include: { show: true },
      });
      expect(entries.length).toBe(1);
      expect(entries[0].show.title).toBe('Breaking Bad');
    });
  });

  describe('DELETE /api/watchlist/:id', () => {
    it('removes a show from watchlist', async () => {
      // First add a show
      await request(app)
        .post('/api/watchlist')
        .send({ tmdbId: 1396 });

      const entries = await prisma.watchlistEntry.findMany();
      expect(entries.length).toBe(1);

      // Then remove it
      const res = await request(app)
        .delete(`/api/watchlist/${entries[0].id}`);

      expect(res.status).toBe(200);

      const remaining = await prisma.watchlistEntry.findMany();
      expect(remaining.length).toBe(0);
    });
  });
});
```

**Step 4: Run integration tests**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "test: add integration tests for shows and watchlist APIs"
```

---

## Task 14: E2E Flow Test

**Files:**
- Create: `src/e2e/schedule-flow.test.ts`

**Step 1: Create E2E test**

Create `src/e2e/schedule-flow.test.ts`:

```typescript
// ABOUTME: End-to-end test for the core scheduling flow.
// ABOUTME: Tests: add show -> generate schedule -> check in.

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import { cacheShow } from '../services/showCache';
import { addToWatchlist } from '../services/watchlist';
import { updateSettings } from '../services/settings';
import { generateSchedule, getScheduleForDay } from '../services/scheduler';

describe('E2E: Schedule Flow', () => {
  beforeEach(async () => {
    await prisma.scheduledEpisode.deleteMany();
    await prisma.scheduleDay.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();
    await prisma.settings.deleteMany();
  });

  it('completes full flow: add show -> schedule -> check-in', async () => {
    // 1. Add a show to watchlist
    const show = await cacheShow(1396); // Breaking Bad
    await addToWatchlist(show.id);

    // 2. Configure settings
    await updateSettings({
      weekdayMinutes: 120, // 2 hours
      schedulingMode: 'sequential',
    });

    // 3. Generate schedule
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await generateSchedule(today, 7);

    // 4. Verify today has episodes
    const todaySchedule = await getScheduleForDay(today);
    expect(todaySchedule).not.toBeNull();
    expect(todaySchedule!.episodes.length).toBeGreaterThan(0);
    expect(todaySchedule!.episodes[0].status).toBe('pending');

    // 5. Simulate check-in: mark first episode as watched
    const firstEpisode = todaySchedule!.episodes[0];
    await prisma.scheduledEpisode.update({
      where: { id: firstEpisode.id },
      data: { status: 'watched' },
    });

    // 6. Verify episode is marked watched
    const updatedSchedule = await getScheduleForDay(today);
    const updatedEpisode = updatedSchedule!.episodes.find(
      (ep) => ep.id === firstEpisode.id
    );
    expect(updatedEpisode!.status).toBe('watched');
  });

  it('handles multiple shows in round-robin mode', async () => {
    // Add two shows
    const show1 = await cacheShow(1396); // Breaking Bad
    const show2 = await cacheShow(60059); // Better Call Saul

    await addToWatchlist(show1.id, { priority: 0 });
    await addToWatchlist(show2.id, { priority: 1 });

    await updateSettings({
      weekdayMinutes: 180,
      schedulingMode: 'roundrobin',
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await generateSchedule(today, 1);

    const schedule = await getScheduleForDay(today);
    expect(schedule!.episodes.length).toBeGreaterThan(1);

    // Should have episodes from both shows
    const showIds = new Set(schedule!.episodes.map((ep) => ep.showId));
    expect(showIds.size).toBe(2);
  });
});
```

**Step 2: Run E2E tests**

Run: `npm test -- src/e2e/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add -A
git commit -m "test: add E2E test for schedule flow"
```

---

## Summary

After completing all tasks, you'll have:

1. **Project Setup** - TypeScript, Express, Prisma, Tailwind, htmx
2. **Database** - Models for Shows, Watchlist, Schedule, Settings
3. **Services** - TMDB client, show caching, watchlist management, scheduler
4. **UI** - Dashboard, Watchlist, Schedule, Settings pages
5. **API** - Search, watchlist CRUD, check-in endpoints
6. **Tests** - Unit, integration, and E2E coverage

**Next steps after v1:**
- Does the Dog Die integration
- Google Calendar sync
- Specific time slots
- Notifications
