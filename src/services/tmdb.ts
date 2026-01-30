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
  if (!key || key === 'your_tmdb_api_key_here') {
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
