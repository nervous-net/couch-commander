// Add a show by TMDB ID
import { getShowDetails } from '../src/services/tmdb';
import { prisma } from '../src/lib/db';

const tmdbId = parseInt(process.argv[2]);
const status = process.argv[3] || 'queued';

if (!tmdbId) {
  console.log('Usage: npx tsx scripts/add-show.ts <tmdb_id> [watching|queued]');
  process.exit(1);
}

async function main() {
  const details = await getShowDetails(tmdbId);

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

  const maxPriority = await prisma.watchlistEntry.aggregate({
    where: { status },
    _max: { priority: true },
  });

  const entry = await prisma.watchlistEntry.create({
    data: {
      showId: show.id,
      status,
      priority: (maxPriority._max.priority || 0) + 1,
    },
  });

  console.log(`✅ Added ${details.name} (${details.episodeRuntime}min) as ${status}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
