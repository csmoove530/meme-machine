/**
 * Meme Intel — Scans Reddit for trending meme formats via StableSocial (agentcash).
 * Uses paid API ($0.06/subreddit) since Reddit blocks unauthenticated JSON API.
 */

import { execFileSync } from 'child_process';

const SUBREDDITS = [
  'dankmemes',
  'memes',
  'me_irl',
  'ProgrammerHumor',
  'MemeTemplatesOfficial',
];

const STABLE_SOCIAL_REDDIT = 'https://stablesocial.dev/api/reddit/subreddit';

export interface TrendingFormat {
  title: string;
  score: number;
  subreddit: string;
  imageUrl: string | null;
  permalink: string;
  numComments: number;
}

export interface MemeIntelResult {
  formats: TrendingFormat[];
  trendSummary: string;
}

/** Fetch a subreddit via StableSocial (agentcash handles payment) */
function fetchSubreddit(name: string): TrendingFormat[] {
  try {
    const body = JSON.stringify({ handle: name, max_posts: 10 });
    const result = execFileSync('npx', [
      'agentcash@latest', 'fetch',
      '--method', 'POST',
      '--body', body,
      STABLE_SOCIAL_REDDIT,
    ], { encoding: 'utf-8', timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });

    const parsed = JSON.parse(result);
    const data = parsed.data || parsed;

    // StableSocial returns async — check for token (need to poll)
    if (data.token) {
      // Poll for results
      return pollForResults(data.token);
    }

    // Direct results
    const posts = data.posts || data.data?.posts || [];
    return extractFormats(posts, name);
  } catch (err: any) {
    console.error(`[meme-intel] r/${name} failed:`, err.message?.slice(0, 100));
    return [];
  }
}

/** Poll StableSocial job for results */
function pollForResults(token: string): TrendingFormat[] {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    // Wait between polls
    execFileSync('sleep', ['3']);

    try {
      const result = execFileSync('npx', [
        'agentcash@latest', 'fetch',
        `https://stablesocial.dev/api/jobs?token=${token}`,
      ], { encoding: 'utf-8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });

      const parsed = JSON.parse(result);
      const data = parsed.data || parsed;

      if (data.status === 'finished' && data.data) {
        const posts = data.data.posts || data.data.activities || [];
        return extractFormats(posts, 'unknown');
      }
      if (data.status === 'failed') {
        console.error('[meme-intel] Job failed:', data.error);
        return [];
      }
      // Still pending, keep polling
    } catch (err: any) {
      console.error('[meme-intel] Poll error:', err.message?.slice(0, 100));
    }
  }
  console.error('[meme-intel] Poll timed out');
  return [];
}

/** Extract trending format data from posts */
function extractFormats(posts: any[], subreddit: string): TrendingFormat[] {
  return posts
    .filter((p: any) => {
      const url = p.url || p.media_url || '';
      return /\.(jpg|jpeg|png|gif|webp)/i.test(url) || p.is_image;
    })
    .map((p: any) => ({
      title: p.title || p.text || '',
      score: p.score || p.upvotes || p.likes || 0,
      subreddit: p.subreddit || subreddit,
      imageUrl: p.url || p.media_url || p.thumbnail || null,
      permalink: p.permalink || p.link || '',
      numComments: p.num_comments || p.comments_count || 0,
    }))
    .sort((a: TrendingFormat, b: TrendingFormat) => b.score - a.score);
}

export async function scanMemeIntel(): Promise<MemeIntelResult> {
  console.log(`[meme-intel] Scanning ${SUBREDDITS.length} subreddits via StableSocial...`);

  const allFormats: TrendingFormat[] = [];

  for (const sub of SUBREDDITS) {
    console.log(`[meme-intel] Fetching r/${sub}...`);
    const formats = fetchSubreddit(sub);
    allFormats.push(...formats);
    console.log(`[meme-intel] r/${sub}: ${formats.length} image posts`);
  }

  // Sort by score and take top 15
  const topFormats = allFormats
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  // Build summary
  const subredditCounts: Record<string, number> = {};
  topFormats.forEach(f => {
    subredditCounts[f.subreddit] = (subredditCounts[f.subreddit] || 0) + 1;
  });

  const topSubs = Object.entries(subredditCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([sub, count]) => `r/${sub} (${count})`)
    .join(', ');

  const trendSummary = topFormats.length > 0
    ? `Top ${topFormats.length} trending memes today from ${topSubs}. ` +
      `Top titles: ${topFormats.slice(0, 5).map(f => `"${f.title}" (${f.score} pts, r/${f.subreddit})`).join('; ')}`
    : 'No trending formats found today.';

  console.log(`[meme-intel] Total: ${topFormats.length} trending formats`);

  return { formats: topFormats, trendSummary };
}
