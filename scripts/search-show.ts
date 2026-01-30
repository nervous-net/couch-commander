// Quick search script
import { searchShows, getShowDetails } from '../src/services/tmdb';
import { prisma } from '../src/lib/db';

const query = process.argv[2];
if (!query) {
  console.log('Usage: npx tsx scripts/search-show.ts "show name"');
  process.exit(1);
}

async function main() {
  const results = await searchShows(query);
  console.log(`\nResults for "${query}":\n`);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.id}: ${r.name} (${r.firstAirDate?.slice(0,4) || '?'})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
