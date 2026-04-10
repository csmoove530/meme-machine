import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ── Paths ─────────────────────────────────────────────────────────────────────
export const DATA_DIR = join(homedir(), '.meme-machine');
export const LATEST_FILE = join(DATA_DIR, 'latest.txt');
export const HISTORY_FILE = join(DATA_DIR, 'history.json');

export function todayDir(): string {
  const date = new Date().toISOString().slice(0, 10);
  const dir = join(DATA_DIR, date);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Budget ────────────────────────────────────────────────────────────────────
export const BUDGET = {
  maxPerTransaction: 1.0,
  dailyCap: 5.00, // higher cap for video mode ($0.30/clip x 9 = $2.70)
  exa: 0.05,
  claude: 0.05,
  falAi: 0.60,
  stableUpload: 0.30,
};

// ── Content policy ───────────────────────────────────────────────────────────
// All generated content MUST be safe for work. This is non-negotiable.
// Scene prompts are checked against this policy before generation.
export const SFW_POLICY = {
  enabled: true,
  rules: [
    'No nudity, sexual content, or suggestive imagery',
    'No violence, gore, or graphic imagery (cartoon slapstick OK)',
    'No hate speech, slurs, or discriminatory content',
    'No drug/alcohol abuse depictions',
    'No profanity in captions (PG-13 max)',
    'All scenes must be workplace-appropriate',
  ],
};

// ── Pipeline config ───────────────────────────────────────────────────────────
export const TOPIC_COUNT = 3;
export const MEMES_PER_TOPIC = 3;

// Media mode: 'video' (default, $0.30/clip, 6s, 1280x720) or 'image' ($0.06/image)
export const MEDIA_MODE: 'video' | 'image' = 'video';
export const IMAGE_TIER = 'ultra' as const; // ultra ($0.06) or pro ($0.04) — image mode only
export const ASPECT_RATIO = MEDIA_MODE === 'video' ? '16:9' : '1:1';

// Per-item cost for budget calculations
export const COST_PER_ITEM = MEDIA_MODE === 'video' ? 0.30 : 0.06;

// ── API endpoints ─────────────────────────────────────────────────────────────
export const EXA_SEARCH_URL = 'https://stableenrich.dev/api/exa/search';
export const STABLE_UPLOAD_URL = 'https://stableupload.dev/api/upload';
export const AGENTCASH_FETCH_URL = 'agentcash'; // marker — we use MCP tools

// ── Visa CLI ──────────────────────────────────────────────────────────────────
export const VISA_CLI_BIN = 'visa-cli';

// ── ImageMagick ───────────────────────────────────────────────────────────────
export const MAGICK_BIN = 'magick';
export const IMPACT_FONT = '/System/Library/Fonts/Supplemental/Impact.ttf';

// ── Ensure data dir exists on import ──────────────────────────────────────────
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
