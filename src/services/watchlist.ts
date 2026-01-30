// ABOUTME: Manages the user's watchlist of TV shows.
// ABOUTME: Handles adding, removing, reordering, and progress tracking.

import { prisma } from '../lib/db';
import type { WatchlistEntry, Show, ShowDayAssignment } from '@prisma/client';
import { assignShowToDay, findBestDayForShow } from './dayAssignment';

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

export type WatchlistStatus = 'queued' | 'watching' | 'finished' | 'dropped';

export async function updateWatchlistStatus(
  entryId: number,
  status: WatchlistStatus
): Promise<WatchlistEntryWithShow> {
  return prisma.watchlistEntry.update({
    where: { id: entryId },
    data: { status },
    include: { show: true },
  });
}

export type WatchlistEntryWithShowAndAssignments = WatchlistEntry & {
  show: Show;
  dayAssignments: ShowDayAssignment[];
};

export async function promoteFromQueue(
  entryId: number
): Promise<WatchlistEntryWithShowAndAssignments> {
  const entry = await prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { show: true },
  });

  if (!entry) throw new Error('Entry not found');
  if (entry.status !== 'queued') throw new Error('Entry is not queued');

  const genres = JSON.parse(entry.show.genres) as string[];
  const bestDay = await findBestDayForShow(entry.show.episodeRuntime, genres);

  // Update status to watching
  await prisma.watchlistEntry.update({
    where: { id: entryId },
    data: { status: 'watching' },
  });

  // Assign to best day
  await assignShowToDay(entryId, bestDay);

  // Return with relations
  const result = await prisma.watchlistEntry.findUnique({
    where: { id: entryId },
    include: { show: true, dayAssignments: true },
  });

  // This should never happen since we just updated the entry
  if (!result) throw new Error('Entry not found after update');

  return result;
}
