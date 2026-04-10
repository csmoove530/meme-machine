import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { TOPIC_COUNT, MEMES_PER_TOPIC, DATA_DIR } from './config';
import type { MemeIntelResult } from './meme-intel';

/** Try to get Anthropic API key from env or macOS Keychain */
function getApiKey(): string | undefined {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    return execFileSync('security', [
      'find-generic-password', '-s', 'meme-machine', '-a', 'anthropic-api-key', '-w'
    ], { encoding: 'utf-8' }).trim();
  } catch {
    return undefined;
  }
}

export interface MemeConcept {
  topic: string;
  formatName: string;
  formatDescription: string;
  whyItsFunny: string;
  scenePrompt: string;
  topText: string;
  bottomText: string;
  // Legacy fields for compatibility
  sourceArticle: string;
  sourceUrl: string;
  storySummary: string;
  memeRationale: string;
}

export interface IdeateResult {
  topics: { name: string; concepts: MemeConcept[] }[];
}

function loadMemeLordPatterns(): string {
  // Priority 1: Bundled meme-lord skill in the repo (always available)
  const bundledPath = join(__dirname, '..', 'skills', 'meme-lord', 'SKILL.md');
  if (existsSync(bundledPath)) {
    return readFileSync(bundledPath, 'utf-8');
  }
  // Priority 2: Claude Code skills directory (if installed there)
  const skillPath = join(homedir(), '.claude/skills/meme-lord/SKILL.md');
  if (existsSync(skillPath)) {
    return readFileSync(skillPath, 'utf-8');
  }
  return '';
}

function loadRatingHistory(): string {
  // Check for rating history in data directory
  const historyPath = join(DATA_DIR, 'rating-history.md');
  if (existsSync(historyPath)) {
    return readFileSync(historyPath, 'utf-8');
  }
  return '';
}

export async function ideate(memeIntel?: MemeIntelResult): Promise<IdeateResult> {
  console.log('[ideate] Generating format-first meme concepts with Claude...');

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found. Set it in env or store in Keychain:\n' +
      '  security add-generic-password -s meme-machine -a anthropic-api-key -w "sk-ant-..."'
    );
  }
  const client = new Anthropic({ apiKey });

  const patterns = loadMemeLordPatterns();
  const history = loadRatingHistory();

  // Build meme intel section
  const memeIntelSection = memeIntel && memeIntel.formats.length > 0
    ? `## Currently Trending on Reddit RIGHT NOW
${memeIntel.trendSummary}

Top trending memes:
${memeIntel.formats.slice(0, 10).map((f, i) =>
  `${i + 1}. "${f.title}" (${f.score} pts, r/${f.subreddit})`
).join('\n')}

Use these as signals for what TONE, FORMAT, and VIBE is resonating today.`
    : '';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a professional meme creator. Your job is to create memes that would actually get upvoted on Reddit.

## APPROACH: FORMAT-FIRST (NOT news-first)

DO NOT base memes on news stories. Instead:
1. Pick ${TOPIC_COUNT} proven meme FORMATS (templates/structures that are currently popular)
2. For each format, write ${MEMES_PER_TOPIC} original captions based on UNIVERSAL RELATABLE EXPERIENCES
3. The humor comes from shared human experiences, not current events

${memeIntelSection}

## Proven Meme Formats to Choose From
Pick ${TOPIC_COUNT} of these (or similar trending formats):

- **Before/After** — Same subject in two contrasting states. "Before deploying to prod / After deploying to prod"
- **Nobody: / Me:** — Setup of "nobody asked" then absurd behavior
- **Expectation vs Reality** — What you thought vs what happened
- **Drake Approve/Reject** — Two-panel reject bad option, approve worse-but-funnier option
- **Distracted Boyfriend** — Thing I should want vs thing I actually want
- **This Is Fine** — Calm demeanor while everything is on fire
- **Expanding Brain** — Increasingly absurd takes presented as increasingly enlightened
- **POV:** — "POV: you just [relatable situation]"
- **Starter Pack** — Collection of items/behaviors that define a type of person
- **The one who...** — Group dynamic where one person is different

## UNIVERSAL TOPICS THAT ALWAYS WORK (pick from these vibes)
- Work/office life (meetings, emails, deadlines, Slack, "per my last email")
- Technology failing at the worst time (WiFi, printers, software updates)
- Adulting struggles (taxes, groceries, sleep schedules, cooking)
- Social media behavior (doomscrolling, posting then deleting, online vs IRL)
- Developer/programmer life (bugs, Stack Overflow, "it works on my machine")
- Pet owners (cats judging you, dogs being dramatic, pet logic)
- Monday mornings / Friday afternoons / Sunday scaries
- Group chat dynamics
- Gym culture / New Year's resolutions
- Coffee dependency / sleep deprivation

## User's Meme Preferences (from testing)
${history}

## Meme Lord Skill Patterns
${patterns}

## WHAT SCORES WELL (from actual user ratings)
- "BEFORE DEPLOYING TO PROD / AFTER DEPLOYING TO PROD" = 8/10 (concrete, universal, ironic contrast)
- "LAUNCHED INTO SPACE / OUTLOOK WON'T OPEN" = 5/10 (relatable tech frustration + absurd context)
- Everything based on news stories = 1/10 (too niche, not relatable enough)

The key: would a random person scrolling Reddit upvote this without ANY context? If you have to explain it, it's not funny.

## Rules
- Scene prompts describe a visual scene for image generation — NO text in the image
- Scene prompts must end with "No text anywhere in the image."
- Keep top/bottom text VERY SHORT (under 6 words each ideally)
- The caption must be funny on its own even without the image
- Each format gets 3 variations with DIFFERENT relatable topics (not 3 takes on the same joke)

## Output format (strict JSON, NO markdown fences)
{
  "topics": [
    {
      "name": "Format Name (e.g., Before/After)",
      "concepts": [
        {
          "topic": "Format Name",
          "formatName": "Before/After",
          "formatDescription": "Same subject shown in two contrasting states — the gap between expectation and reality is the joke",
          "whyItsFunny": "Everyone has experienced the horror of deploying code and watching everything break",
          "scenePrompt": "Detailed visual scene. No text anywhere in the image.",
          "topText": "SHORT TOP",
          "bottomText": "SHORT BOTTOM",
          "sourceArticle": "",
          "sourceUrl": "",
          "storySummary": "",
          "memeRationale": ""
        }
      ]
    }
  ]
}

Return ONLY valid JSON. No markdown fences. No explanation.`
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  let cleaned: string;
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    cleaned = text.replace(/^[\s\S]*?```(?:json)?\s*\n/, '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\w*\n?/g, '').trim();
    }
  }

  try {
    const result = JSON.parse(cleaned) as IdeateResult;
    const totalConcepts = result.topics.reduce((sum, t) => sum + t.concepts.length, 0);
    console.log(`[ideate] Generated ${result.topics.length} formats, ${totalConcepts} meme concepts`);
    result.topics.forEach(t => {
      console.log(`[ideate]   ${t.name}: ${t.concepts.map(c => `"${c.topText} / ${c.bottomText}"`).join(', ')}`);
    });
    return result;
  } catch (err) {
    console.error('[ideate] Failed to parse Claude response:', text.slice(0, 300));
    throw new Error('Claude returned invalid JSON for meme concepts');
  }
}
