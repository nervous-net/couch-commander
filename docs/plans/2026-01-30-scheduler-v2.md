# Scheduler V2: Day-Based Show Assignment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the current same-shows-every-day scheduler with day-specific show assignments, watching/queued separation, and smart queue promotion.

**Architecture:** Shows are assigned to specific days of the week. Time budgets determine capacity per day. When shows finish, the queue auto-promotes replacements based on fit and genre variety.

**Tech Stack:** TypeScript, Prisma, Express, EJS, htmx, Vitest

---

## Prerequisites

### Task 0: Fix Runtime Bug

**Problem:** Shows with 22-minute episodes display as 40+ minutes because TMDB returns empty `episode_run_time` arrays for many shows, causing fallback to 45 min default.

**Files:**
- Modify: `src/services/tmdb.ts:89-117`
- Test: `src/services/tmdb.test.ts`

**Step 1: Write failing test**

```typescript
// In tmdb.test.ts
it('fetches runtime from season data when episode_run_time is empty', async () => {
  // The Office (2316) has 22-min episodes but empty episode_run_time
  const details = await getShowDetails(2316);
  expect(details.episodeRuntime).toBeLessThan(30);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/tmdb.test.ts`
Expected: FAIL - runtime will be 45 (default)

**Step 3: Update getShowDetails to fetch season data**

```typescript
export async function getShowDetails(tmdbId: number): Promise<ShowDetails> {
  const apiKey = getApiKey();
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data: TMDBShowDetails = await response.json();

  let avgRuntime: number;

  if (data.episode_run_time.length > 0) {
    avgRuntime = Math.round(
      data.episode_run_time.reduce((a, b) => a + b, 0) / data.episode_run_time.length
    );
  } else {
    // Fetch season 1 to get episode runtime
    const seasonUrl = `${TMDB_BASE_URL}/tv/${tmdbId}/season/1?api_key=${apiKey}`;
    const seasonResponse = await fetch(seasonUrl);
    if (seasonResponse.ok) {
      const seasonData = await seasonResponse.json();
      const runtimes = seasonData.episodes
        ?.map((ep: any) => ep.runtime)
        .filter((r: number) => r > 0) || [];
      avgRuntime = runtimes.length > 0
        ? Math.round(runtimes.reduce((a: number, b: number) => a + b, 0) / runtimes.length)
        : 45;
    } else {
      avgRuntime = 45;
    }
  }

  return {
    id: data.id,
    name: data.name,
    overview: data.overview,
    posterPath: data.posterPath,
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
git commit -m "fix: fetch episode runtime from season data when show-level is empty"
```

---

## Phase 1: Data Model Changes

### Task 1: Add WatchlistEntry Status Field

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/services/watchlist.test.ts` (add tests)
- Modify: `src/services/watchlist.ts`

**Step 1: Write failing test**

```typescript
it('creates watchlist entry with queued status by default', async () => {
  const show = await cacheShow(1396);
  const entry = await addToWatchlist(show.id);
  expect(entry.status).toBe('queued');
});

it('allows promoting entry to watching status', async () => {
  const show = await cacheShow(1396);
  const entry = await addToWatchlist(show.id);
  const updated = await updateWatchlistStatus(entry.id, 'watching');
  expect(updated.status).toBe('watching');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: FAIL - status field doesn't exist

**Step 3: Update Prisma schema**

```prisma
model WatchlistEntry {
  id             Int      @id @default(autoincrement())
  showId         Int
  show           Show     @relation(fields: [showId], references: [id])
  priority       Int      @default(0)
  startSeason    Int      @default(1)
  startEpisode   Int      @default(1)
  currentSeason  Int      @default(1)
  currentEpisode Int      @default(1)
  status         String   @default("queued")  // queued, watching, finished, dropped
  createdAt      DateTime @default(now())
  dayAssignments ShowDayAssignment[]
}
```

**Step 4: Run migration**

Run: `npm run db:push`

**Step 5: Add updateWatchlistStatus function**

```typescript
export async function updateWatchlistStatus(
  entryId: number,
  status: 'queued' | 'watching' | 'finished' | 'dropped'
): Promise<WatchlistEntry> {
  return prisma.watchlistEntry.update({
    where: { id: entryId },
    data: { status },
    include: { show: true },
  });
}
```

**Step 6: Run test to verify it passes**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add prisma/schema.prisma src/services/watchlist.ts src/services/watchlist.test.ts
git commit -m "feat: add status field to WatchlistEntry (queued/watching/finished/dropped)"
```

---

### Task 2: Create ShowDayAssignment Model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/services/dayAssignment.ts`
- Create: `src/services/dayAssignment.test.ts`

**Step 1: Write failing test**

```typescript
// dayAssignment.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db';
import { assignShowToDay, getShowsForDay, removeShowFromDay } from './dayAssignment';
import { cacheShow } from './showCache';
import { addToWatchlist } from './watchlist';

describe('Day Assignment Service', () => {
  beforeEach(async () => {
    await prisma.showDayAssignment.deleteMany();
    await prisma.watchlistEntry.deleteMany();
    await prisma.show.deleteMany();
  });

  it('assigns a show to a specific day', async () => {
    const show = await cacheShow(1396);
    const entry = await addToWatchlist(show.id);

    const assignment = await assignShowToDay(entry.id, 1); // Monday

    expect(assignment.dayOfWeek).toBe(1);
    expect(assignment.watchlistEntryId).toBe(entry.id);
  });

  it('gets all shows assigned to a day', async () => {
    const show = await cacheShow(1396);
    const entry = await addToWatchlist(show.id);
    await assignShowToDay(entry.id, 1);

    const mondayShows = await getShowsForDay(1);

    expect(mondayShows.length).toBe(1);
    expect(mondayShows[0].show.title).toBe('Breaking Bad');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: FAIL - model doesn't exist

**Step 3: Add ShowDayAssignment to schema**

```prisma
model ShowDayAssignment {
  id               Int            @id @default(autoincrement())
  watchlistEntryId Int
  watchlistEntry   WatchlistEntry @relation(fields: [watchlistEntryId], references: [id], onDelete: Cascade)
  dayOfWeek        Int            // 0=Sunday, 1=Monday, ... 6=Saturday
  createdAt        DateTime       @default(now())

  @@unique([watchlistEntryId, dayOfWeek])
}
```

**Step 4: Run migration**

Run: `npm run db:push`

**Step 5: Implement dayAssignment service**

```typescript
// src/services/dayAssignment.ts
// ABOUTME: Manages which shows are assigned to which days of the week.
// ABOUTME: Handles day assignment CRUD and capacity calculations.

import { prisma } from '../lib/db';

export async function assignShowToDay(watchlistEntryId: number, dayOfWeek: number) {
  return prisma.showDayAssignment.create({
    data: { watchlistEntryId, dayOfWeek },
  });
}

export async function getShowsForDay(dayOfWeek: number) {
  return prisma.showDayAssignment.findMany({
    where: { dayOfWeek },
    include: {
      watchlistEntry: {
        include: { show: true },
      },
    },
  });
}

export async function removeShowFromDay(watchlistEntryId: number, dayOfWeek: number) {
  return prisma.showDayAssignment.delete({
    where: {
      watchlistEntryId_dayOfWeek: { watchlistEntryId, dayOfWeek },
    },
  });
}

export async function removeAllAssignments(watchlistEntryId: number) {
  return prisma.showDayAssignment.deleteMany({
    where: { watchlistEntryId },
  });
}
```

**Step 6: Run test to verify it passes**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add prisma/schema.prisma src/services/dayAssignment.ts src/services/dayAssignment.test.ts
git commit -m "feat: add ShowDayAssignment model for day-specific show scheduling"
```

---

## Phase 2: Auto-Distribution Algorithm

### Task 3: Calculate Day Capacity

**Files:**
- Modify: `src/services/dayAssignment.ts`
- Modify: `src/services/dayAssignment.test.ts`

**Step 1: Write failing test**

```typescript
it('calculates remaining capacity for a day', async () => {
  // Setup: 120 min budget, one 47-min show assigned
  await updateSettings({ mondayMinutes: 120 });
  const show = await cacheShow(1396); // Breaking Bad, 47 min
  const entry = await addToWatchlist(show.id);
  await updateWatchlistStatus(entry.id, 'watching');
  await assignShowToDay(entry.id, 1); // Monday

  const capacity = await getDayCapacity(1); // Monday

  expect(capacity.totalMinutes).toBe(120);
  expect(capacity.usedMinutes).toBe(47);
  expect(capacity.availableMinutes).toBe(73);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: FAIL - getDayCapacity doesn't exist

**Step 3: Implement getDayCapacity**

```typescript
export async function getDayCapacity(dayOfWeek: number) {
  const settings = await getSettings();
  const dayBudgets = [
    settings.sundayMinutes ?? settings.weekendMinutes,
    settings.mondayMinutes ?? settings.weekdayMinutes,
    settings.tuesdayMinutes ?? settings.weekdayMinutes,
    settings.wednesdayMinutes ?? settings.weekdayMinutes,
    settings.thursdayMinutes ?? settings.weekdayMinutes,
    settings.fridayMinutes ?? settings.weekdayMinutes,
    settings.saturdayMinutes ?? settings.weekendMinutes,
  ];

  const totalMinutes = dayBudgets[dayOfWeek];

  const assignments = await prisma.showDayAssignment.findMany({
    where: {
      dayOfWeek,
      watchlistEntry: { status: 'watching' },
    },
    include: {
      watchlistEntry: { include: { show: true } },
    },
  });

  const usedMinutes = assignments.reduce(
    (sum, a) => sum + a.watchlistEntry.show.episodeRuntime,
    0
  );

  return {
    totalMinutes,
    usedMinutes,
    availableMinutes: totalMinutes - usedMinutes,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/dayAssignment.ts src/services/dayAssignment.test.ts
git commit -m "feat: add getDayCapacity to calculate remaining time per day"
```

---

### Task 4: Find Best Day for Show

**Files:**
- Modify: `src/services/dayAssignment.ts`
- Modify: `src/services/dayAssignment.test.ts`

**Step 1: Write failing test**

```typescript
it('finds the best day for a new show based on capacity', async () => {
  await updateSettings({ weekdayMinutes: 120 });

  // Monday already has a 47-min show
  const show1 = await cacheShow(1396);
  const entry1 = await addToWatchlist(show1.id);
  await updateWatchlistStatus(entry1.id, 'watching');
  await assignShowToDay(entry1.id, 1);

  // Find best day for a new 48-min show
  const bestDay = await findBestDayForShow(48);

  // Should pick Tuesday (empty) over Monday (47 min used)
  expect(bestDay).toBe(2);
});

it('considers genre variety when days have similar capacity', async () => {
  await updateSettings({ weekdayMinutes: 120 });

  // Monday has Drama, Tuesday is empty
  const show1 = await cacheShow(1396); // Breaking Bad - Drama
  const entry1 = await addToWatchlist(show1.id);
  await updateWatchlistStatus(entry1.id, 'watching');
  await assignShowToDay(entry1.id, 1);
  await assignShowToDay(entry1.id, 2); // Also Tuesday

  // New Drama show should prefer a day without Drama
  const bestDay = await findBestDayForShow(45, ['Drama']);

  // Should pick Wednesday (no shows) for genre variety
  expect(bestDay).toBe(3);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: FAIL - findBestDayForShow doesn't exist

**Step 3: Implement findBestDayForShow**

```typescript
export async function findBestDayForShow(
  runtime: number,
  genres: string[] = []
): Promise<number> {
  const capacities = await Promise.all(
    [0, 1, 2, 3, 4, 5, 6].map(async (day) => ({
      day,
      ...(await getDayCapacity(day)),
      genres: await getDayGenres(day),
    }))
  );

  // Filter to days that can fit the show
  const viable = capacities.filter((c) => c.availableMinutes >= runtime);

  if (viable.length === 0) {
    // No single day fits; return day with most space
    return capacities.sort((a, b) => b.availableMinutes - a.availableMinutes)[0].day;
  }

  // Score by: available time + genre variety bonus
  const scored = viable.map((c) => {
    const genreOverlap = genres.filter((g) => c.genres.includes(g)).length;
    const varietyBonus = genreOverlap === 0 ? 30 : 0; // Bonus for genre diversity
    return {
      ...c,
      score: c.availableMinutes + varietyBonus,
    };
  });

  return scored.sort((a, b) => b.score - a.score)[0].day;
}

async function getDayGenres(dayOfWeek: number): Promise<string[]> {
  const assignments = await prisma.showDayAssignment.findMany({
    where: {
      dayOfWeek,
      watchlistEntry: { status: 'watching' },
    },
    include: {
      watchlistEntry: { include: { show: true } },
    },
  });

  const genres = assignments.flatMap((a) =>
    JSON.parse(a.watchlistEntry.show.genres) as string[]
  );

  return [...new Set(genres)];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/dayAssignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/dayAssignment.ts src/services/dayAssignment.test.ts
git commit -m "feat: add findBestDayForShow with genre variety consideration"
```

---

### Task 5: Promote Show from Queue

**Files:**
- Modify: `src/services/watchlist.ts`
- Modify: `src/services/watchlist.test.ts`

**Step 1: Write failing test**

```typescript
it('promotes show from queue to watching and assigns day', async () => {
  await updateSettings({ weekdayMinutes: 120 });

  const show = await cacheShow(1396);
  const entry = await addToWatchlist(show.id);
  expect(entry.status).toBe('queued');

  const promoted = await promoteFromQueue(entry.id);

  expect(promoted.status).toBe('watching');

  // Should have at least one day assignment
  const assignments = await prisma.showDayAssignment.findMany({
    where: { watchlistEntryId: entry.id },
  });
  expect(assignments.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: FAIL - promoteFromQueue doesn't exist

**Step 3: Implement promoteFromQueue**

```typescript
export async function promoteFromQueue(entryId: number) {
  const entry = await prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { show: true },
  });

  if (!entry) throw new Error('Entry not found');
  if (entry.status !== 'queued') throw new Error('Entry is not queued');

  const genres = JSON.parse(entry.show.genres) as string[];
  const bestDay = await findBestDayForShow(entry.show.episodeRuntime, genres);

  // Update status and assign to day
  await prisma.watchlistEntry.update({
    where: { id: entryId },
    data: { status: 'watching' },
  });

  await assignShowToDay(entryId, bestDay);

  return prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { show: true, dayAssignments: true },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/watchlist.ts src/services/watchlist.test.ts
git commit -m "feat: add promoteFromQueue to move shows from queue to watching"
```

---

### Task 6: Auto-Promote from Queue When Show Finishes

**Files:**
- Modify: `src/services/watchlist.ts`
- Modify: `src/services/watchlist.test.ts`

**Step 1: Write failing test**

```typescript
it('auto-promotes best queue match when show finishes', async () => {
  await updateSettings({ weekdayMinutes: 120 });

  // Watching show on Monday
  const show1 = await cacheShow(1396); // Breaking Bad
  const entry1 = await addToWatchlist(show1.id);
  await promoteFromQueue(entry1.id);

  // Queued show
  const show2 = await cacheShow(60059); // Better Call Saul
  const entry2 = await addToWatchlist(show2.id);

  // Finish the first show
  const result = await finishShow(entry1.id);

  expect(result.finishedEntry.status).toBe('finished');
  expect(result.promotedEntry).not.toBeNull();
  expect(result.promotedEntry?.status).toBe('watching');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: FAIL - finishShow doesn't exist

**Step 3: Implement finishShow**

```typescript
export async function finishShow(entryId: number) {
  const entry = await prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { dayAssignments: true, show: true },
  });

  if (!entry) throw new Error('Entry not found');

  const freedDays = entry.dayAssignments.map((a) => a.dayOfWeek);

  // Mark as finished and remove day assignments
  await removeAllAssignments(entryId);
  await prisma.watchlistEntry.update({
    where: { id: entryId },
    data: { status: 'finished' },
  });

  // Find best queue candidate for the freed days
  const promoted = await autoPromoteForDays(freedDays, entry.show.episodeRuntime);

  return {
    finishedEntry: await prisma.watchlistEntry.findUnique({
      where: { id: entryId },
      include: { show: true },
    }),
    promotedEntry: promoted,
  };
}

async function autoPromoteForDays(freedDays: number[], freedRuntime: number) {
  const queue = await prisma.watchlistEntry.findMany({
    where: { status: 'queued' },
    include: { show: true },
    orderBy: { priority: 'asc' },
  });

  if (queue.length === 0) return null;

  // Score queue entries by fit
  const scored = queue.map((entry) => {
    const runtimeDiff = Math.abs(entry.show.episodeRuntime - freedRuntime);
    return { entry, score: 100 - runtimeDiff }; // Closer runtime = higher score
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];

  // Promote the best match
  return promoteFromQueue(best.entry.id);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/watchlist.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/watchlist.ts src/services/watchlist.test.ts
git commit -m "feat: auto-promote from queue when show finishes"
```

---

## Phase 3: Scheduler Rewrite

### Task 7: Rewrite generateSchedule for Day-Based Shows

**Files:**
- Modify: `src/services/scheduler.ts`
- Modify: `src/services/scheduler.test.ts`

**Step 1: Write failing test**

```typescript
it('generates schedule based on day assignments not all shows', async () => {
  await updateSettings({ weekdayMinutes: 120 });

  // Show 1 assigned to Monday only
  const show1 = await cacheShow(1396);
  const entry1 = await addToWatchlist(show1.id);
  await promoteFromQueue(entry1.id);
  // entry1 is now watching, assigned to best day (Monday since empty)

  // Show 2 assigned to Tuesday only
  const show2 = await cacheShow(60059);
  const entry2 = await addToWatchlist(show2.id);
  await promoteFromQueue(entry2.id);
  // entry2 assigned to Tuesday (Monday has show1)

  // Generate for Monday
  const monday = new Date('2026-02-02'); // A Monday
  await generateSchedule(monday, 1);

  const mondaySchedule = await getScheduleForDay(monday);

  // Monday should only have show1 episodes
  const showIds = new Set(mondaySchedule!.episodes.map((ep) => ep.showId));
  expect(showIds.size).toBe(1);
  expect(showIds.has(show1.id)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/services/scheduler.test.ts`
Expected: FAIL - old scheduler doesn't use day assignments

**Step 3: Rewrite generateSchedule**

```typescript
export async function generateSchedule(startDate: Date, days: number): Promise<void> {
  const settings = await getSettings();

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const dayOfWeek = date.getDay();
    const budget = getDayBudget(settings, dayOfWeek);

    // Get shows assigned to this day of week
    const assignments = await prisma.showDayAssignment.findMany({
      where: {
        dayOfWeek,
        watchlistEntry: { status: 'watching' },
      },
      include: {
        watchlistEntry: { include: { show: true } },
      },
    });

    // Create schedule day
    const scheduleDay = await prisma.scheduleDay.upsert({
      where: { date },
      update: { totalMinutes: budget },
      create: { date, totalMinutes: budget },
    });

    // Clear existing episodes for this day
    await prisma.scheduledEpisode.deleteMany({
      where: { scheduleDayId: scheduleDay.id },
    });

    // Fill day with episodes from assigned shows
    let usedMinutes = 0;

    for (const assignment of assignments) {
      const entry = assignment.watchlistEntry;
      const show = entry.show;

      while (usedMinutes + show.episodeRuntime <= budget) {
        await prisma.scheduledEpisode.create({
          data: {
            scheduleDayId: scheduleDay.id,
            showId: show.id,
            season: entry.currentSeason,
            episode: entry.currentEpisode,
            runtime: show.episodeRuntime,
            status: 'pending',
          },
        });

        usedMinutes += show.episodeRuntime;

        // Advance to next episode (for multiple eps per day)
        entry.currentEpisode++;
        // Handle season rollover logic here if needed
      }
    }
  }
}

function getDayBudget(settings: Settings, dayOfWeek: number): number {
  const overrides = [
    settings.sundayMinutes,
    settings.mondayMinutes,
    settings.tuesdayMinutes,
    settings.wednesdayMinutes,
    settings.thursdayMinutes,
    settings.fridayMinutes,
    settings.saturdayMinutes,
  ];

  const override = overrides[dayOfWeek];
  if (override !== null) return override;

  return dayOfWeek === 0 || dayOfWeek === 6
    ? settings.weekendMinutes
    : settings.weekdayMinutes;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/services/scheduler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/scheduler.ts src/services/scheduler.test.ts
git commit -m "feat: rewrite generateSchedule to use day-based show assignments"
```

---

## Phase 4: UI Updates

### Task 8: Update Watchlist Page - Watching vs Queue Sections

**Files:**
- Modify: `src/views/watchlist.ejs`
- Modify: `src/routes/pages/watchlist.ts`

**Step 1: Update route to separate watching and queued**

```typescript
router.get('/watchlist', async (req, res) => {
  const watching = await prisma.watchlistEntry.findMany({
    where: { status: 'watching' },
    include: { show: true, dayAssignments: true },
    orderBy: { priority: 'asc' },
  });

  const queued = await prisma.watchlistEntry.findMany({
    where: { status: 'queued' },
    include: { show: true },
    orderBy: { priority: 'asc' },
  });

  res.render('watchlist', { watching, queued });
});
```

**Step 2: Update EJS template**

Create two sections: "Currently Watching" showing day assignments, and "Queue" with promote buttons.

**Step 3: Test manually in browser**

**Step 4: Commit**

```bash
git add src/views/watchlist.ejs src/routes/pages/watchlist.ts
git commit -m "feat: split watchlist UI into watching and queue sections"
```

---

### Task 9: Add Promote Button and API Route

**Files:**
- Modify: `src/routes/api/watchlist.ts`
- Modify: `src/views/watchlist.ejs`
- Modify: `src/routes/api/watchlist.test.ts`

**Step 1: Write failing test**

```typescript
describe('POST /api/watchlist/:id/promote', () => {
  it('promotes a queued show to watching', async () => {
    // Setup queued show
    const addRes = await request(app)
      .post('/api/watchlist')
      .send({ tmdbId: 1396 });

    const entryId = addRes.body.id;

    const res = await request(app)
      .post(`/api/watchlist/${entryId}/promote`);

    expect(res.status).toBe(200);

    const entry = await prisma.watchlistEntry.findUnique({
      where: { id: entryId },
    });
    expect(entry?.status).toBe('watching');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/api/watchlist.test.ts`
Expected: FAIL - route doesn't exist

**Step 3: Add promote route**

```typescript
router.post('/:id/promote', async (req, res) => {
  const { id } = req.params;

  try {
    const entry = await promoteFromQueue(parseInt(id));
    res.status(200).json(entry);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/routes/api/watchlist.test.ts`
Expected: PASS

**Step 5: Add promote button to UI with htmx**

**Step 6: Commit**

```bash
git add src/routes/api/watchlist.ts src/routes/api/watchlist.test.ts src/views/watchlist.ejs
git commit -m "feat: add promote API endpoint and UI button"
```

---

### Task 10: Update Schedule Page to Show Day-Specific Info

**Files:**
- Modify: `src/views/schedule.ejs`
- Modify: `src/routes/pages/schedule.ts`

**Step 1: Update route to include capacity info**

```typescript
router.get('/schedule', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const schedule = await getScheduleForDay(today);
  const capacity = await getDayCapacity(today.getDay());

  res.render('schedule', { schedule, capacity, date: today });
});
```

**Step 2: Update template to show budget/used/available**

**Step 3: Test manually**

**Step 4: Commit**

```bash
git add src/views/schedule.ejs src/routes/pages/schedule.ts
git commit -m "feat: show day capacity info on schedule page"
```

---

### Task 11: Add Finish Show Button

**Files:**
- Modify: `src/routes/api/watchlist.ts`
- Modify: `src/views/watchlist.ejs`

**Step 1: Write failing test**

```typescript
describe('POST /api/watchlist/:id/finish', () => {
  it('marks show as finished and auto-promotes from queue', async () => {
    // Setup watching show and queued show
    // ... test implementation
  });
});
```

**Step 2-6: Implement and test similar to promote**

**Step 7: Commit**

```bash
git add src/routes/api/watchlist.ts src/routes/api/watchlist.test.ts src/views/watchlist.ejs
git commit -m "feat: add finish show endpoint with auto-queue promotion"
```

---

## Phase 5: E2E Test Update

### Task 12: Update E2E Test for New Flow

**Files:**
- Modify: `src/e2e/schedule-flow.test.ts`

**Step 1: Update test to use new promote flow**

```typescript
it('completes full flow: add show -> promote -> schedule -> check-in', async () => {
  // 1. Add show (goes to queue)
  const show = await cacheShow(1396);
  const entry = await addToWatchlist(show.id);
  expect(entry.status).toBe('queued');

  // 2. Promote to watching (auto-assigns day)
  const promoted = await promoteFromQueue(entry.id);
  expect(promoted.status).toBe('watching');

  // 3. Configure settings
  await updateSettings({ weekdayMinutes: 120 });

  // 4. Generate schedule
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await generateSchedule(today, 7);

  // 5. Check that show appears on its assigned day
  // ... rest of test
});
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/e2e/schedule-flow.test.ts
git commit -m "test: update e2e tests for day-based scheduling flow"
```

---

## Summary

| Task | Description | Est. Complexity |
|------|-------------|-----------------|
| 0 | Fix runtime bug | Low |
| 1 | Add status field to WatchlistEntry | Low |
| 2 | Create ShowDayAssignment model | Medium |
| 3 | Calculate day capacity | Low |
| 4 | Find best day for show | Medium |
| 5 | Promote from queue | Medium |
| 6 | Auto-promote on finish | Medium |
| 7 | Rewrite generateSchedule | High |
| 8 | Update watchlist UI | Medium |
| 9 | Add promote button/API | Low |
| 10 | Update schedule page | Low |
| 11 | Add finish button/API | Low |
| 12 | Update E2E tests | Low |

**Total: 12 tasks + 1 prerequisite**
