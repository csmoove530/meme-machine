import { execFileSync } from 'child_process';
import { EXA_SEARCH_URL } from './config';

export interface Article {
  title: string;
  url: string;
  highlights: string[];
  publishedDate: string | null;
}

export interface ResearchResults {
  funny: Article[];
  wholesome: Article[];
}

/** Run Exa search via agentcash CLI (npx agentcash fetch) */
function exaSearch(query: string, category: string): Article[] {
  const body = JSON.stringify({
    query,
    category,
    numResults: 10,
    startPublishedDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    type: 'neural',
    contents: {
      highlights: { numSentences: 2, highlightsPerUrl: 1 },
      text: { maxCharacters: 300 },
    },
  });

  try {
    const result = execFileSync('npx', [
      'agentcash@latest', 'fetch',
      '--method', 'POST',
      '--body', body,
      EXA_SEARCH_URL,
    ], { encoding: 'utf-8', timeout: 60_000, maxBuffer: 1024 * 1024 });

    const parsed = JSON.parse(result);
    const data = parsed.data || parsed;
    return (data.results || []).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      highlights: r.highlights || [],
      publishedDate: r.publishedDate || null,
    }));
  } catch (err: any) {
    console.error(`[research] Exa search failed for "${query}":`, err.message);
    return [];
  }
}

export async function research(): Promise<ResearchResults> {
  console.log('[research] Searching for trending funny/lighthearted topics...');

  // Use varied queries to get diverse results — not the same stories every time
  const funnyQueries = [
    'absurd ironic funny news story that went viral today',
    'hilarious workplace technology fail trending this week',
    'funny unexpected plot twist news story lighthearted',
    'embarrassing public fail wholesome reaction trending',
    'ironic backfire situation funny news viral today',
  ];
  const wholesomeQueries = [
    'funny viral internet moment wholesome humor today',
    'unexpected wholesome twist trending story this week',
    'hilarious animals doing human things viral video',
    'funny technology malfunction public embarrassment trending',
    'absurd but true story that sounds fake viral',
  ];

  // Pick random queries each run for variety
  const funnyQuery = funnyQueries[Math.floor(Math.random() * funnyQueries.length)];
  const wholesomeQuery = wholesomeQueries[Math.floor(Math.random() * wholesomeQueries.length)];

  console.log(`[research] Query 1: "${funnyQuery}"`);
  const funny = exaSearch(funnyQuery, 'news');
  console.log(`[research] Found ${funny.length} funny articles`);

  console.log(`[research] Query 2: "${wholesomeQuery}"`);
  const wholesome = exaSearch(wholesomeQuery, 'news');
  console.log(`[research] Found ${wholesome.length} wholesome articles`);

  return { funny, wholesome };
}
