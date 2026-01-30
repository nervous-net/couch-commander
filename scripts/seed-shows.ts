// ABOUTME: Seed script to add Rodney's shows to the database.
// ABOUTME: Run with: npx tsx scripts/seed-shows.ts

import { prisma } from '../src/lib/db';
import { searchShows, getShowDetails } from '../src/services/tmdb';

const currentShows = [
  'Brooklyn Nine-Nine',
  'Chuck',
  'Community',
  'Emily in Paris',
  'Fringe',
  'Invincible',
  'Leverage',
  'Murder, She Wrote',
  'Mythic Quest',
  'Numb3rs',
  'Once Upon a Time',
  'Only Murders in the Building',
  'Parks and Recreation',
  'Resident Alien',
  "Schitt's Creek",
  'Severance',
  'Ted Lasso',
  'The Expanse',
  'The Great British Bake Off',
  'The West Wing',
  'Will Trent',
  'Murderbot',
  'Without a Trace',
];

const queueShows = [
  'A Man on the Inside',
  'Elsbeth',
  'High Potential',
  'Nobody Wants This',
  'The Lord of the Rings: The Rings of Power',
  'Stranger Things',
  'The Night Agent',
  'Wednesday',
  'Shrinking',
  'Side Quest',
  'The Rookie',
  'Modern Family',
  'Stargate SG-1',
  'The Golden Girls',
  'The Goldbergs',
  'Invasion',
  'Acapulco',
  'Monarch: Legacy of Monsters',
  'The Orville',
  'Reacher',
  'Silicon Valley',
  'Stick',
  'The Studio',
  'Towards Zero',
  'Twisted Metal',
  'The Witcher',
  'Rick and Morty',
  "Bob's Burgers",
  'Watson',
  '30 Rock',
  '3 Body Problem',
  'Star Trek: The Next Generation',
  'The Residence',
  'The Paper',
  'Obi-Wan Kenobi',
  'The Muppet Show',
  'His Dark Materials',
  'Colombo',
  'Blockbuster',
];

async function addShow(name: string, status: 'watching' | 'queued', priority: number) {
  try {
    const results = await searchShows(name);
    if (results.length === 0) {
      console.log(`❌ Not found: ${name}`);
      return null;
    }

    const tmdbId = results[0].id;
    const details = await getShowDetails(tmdbId);

    // Check if show already exists
    let show = await prisma.show.findUnique({ where: { tmdbId } });
    if (!show) {
      show = await prisma.show.create({
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

    // Create watchlist entry
    const entry = await prisma.watchlistEntry.create({
      data: {
        showId: show.id,
        status,
        priority,
      },
    });

    console.log(`✅ ${status === 'watching' ? '📺' : '📋'} ${details.name} (${details.episodeRuntime}min)`);
    return entry;
  } catch (error) {
    console.log(`❌ Error adding ${name}:`, (error as Error).message);
    return null;
  }
}

async function main() {
  console.log('\n=== Adding Current Shows (Watching) ===\n');

  let priority = 0;
  for (const name of currentShows) {
    await addShow(name, 'watching', priority++);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('\n=== Adding Queue Shows ===\n');

  priority = 0;
  for (const name of queueShows) {
    await addShow(name, 'queued', priority++);
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('\n=== Done! ===\n');

  const watchingCount = await prisma.watchlistEntry.count({ where: { status: 'watching' } });
  const queuedCount = await prisma.watchlistEntry.count({ where: { status: 'queued' } });

  console.log(`📺 Watching: ${watchingCount}`);
  console.log(`📋 Queue: ${queuedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
