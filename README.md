# Meme Machine

An automated pipeline that generates 9 original memes every day — researching what's trending on Reddit, writing captions with Claude, generating images with AI, and publishing an interactive dashboard where you rate your favorites.

**[See a live dashboard](https://f.stableupload.dev/6bzmw24trn/zeitgeist-memes.html)** from a real pipeline run.

---

## Quickstart

```bash
git clone https://github.com/csmoove530/meme-machine.git
cd meme-machine
npm install
```

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

Run the pipeline:

```bash
npm start
```

You'll see output like this:

```
============================================================
  MEME MACHINE — Daily Meme Generation Pipeline
  2026-04-09
============================================================

[meme-intel] Scanning 5 subreddits via StableSocial...
[meme-intel] Fetching r/dankmemes...
[meme-intel] r/dankmemes: 8 image posts
[meme-intel] Fetching r/memes...
...
[meme-intel] Total: 15 trending formats

[ideate] Generating format-first meme concepts with Claude...
[ideate] Generated 3 formats, 9 meme concepts
[ideate]   Before/After: "MONDAY MORNING / FRIDAY 4:59 PM", ...

[generate] Generating 9 images via Visa CLI batch (single Touch ID approval)...
[generate] Visa CLI MCP server connected
[generate] Sending batch of 9 images — approve Touch ID now...
[generate] (1/9) OK — ...meme-machine-2026-04-09-1.jpg
...
[generate] Done: 9/9 images, total $0.54

[overlay] Processing 9 images with ImageMagick...
[overlay] Done: 9/9 memes created in ~/.meme-machine/2026-04-09

[publish] Uploading 9 memes + dashboard...
[publish] Dashboard: https://f.stableupload.dev/abc123/meme-machine-2026-04-09.html

============================================================
  MEME MACHINE — Complete!
  Memes:     9
  Topics:    3
  Cost:      $0.78
  Time:      94s
  Dashboard: https://f.stableupload.dev/abc123/meme-machine-2026-04-09.html
============================================================
```

Open the dashboard URL. Rate each meme 1-10. A leaderboard updates live as you rate.

---

## What You Need

| Dependency | What it does | Install |
|-----------|-------------|---------|
| **Node.js 18+** | Runtime | [nodejs.org](https://nodejs.org) |
| **Anthropic API key** | Claude writes meme captions | [console.anthropic.com](https://console.anthropic.com) |
| **[Visa CLI](https://github.com/nickstuddmedia/visa-cli)** | Generates images via fal.ai (paid with enrolled card) | `npm i -g @anthropic-ai/visa-cli` |
| **[agentcash](https://www.npmjs.com/package/agentcash)** | Pays for Reddit scanning + file hosting (USDC micropayments) | `npx agentcash@latest setup` |
| **ImageMagick** | Overlays Impact font text on images | `brew install imagemagick` |

### API key storage

**Option A** — Environment variable (all platforms):

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**Option B** — macOS Keychain (persists across sessions):

```bash
security add-generic-password -s meme-machine -a anthropic-api-key -w "sk-ant-api03-..."
```

The pipeline checks the environment variable first, then falls back to Keychain.

---

## How the Pipeline Works

Each run executes 5 steps in sequence. Every step is a separate module you can read and modify independently.

```
┌─────────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐
│  Meme Intel │ -> │ Ideate  │ -> │ Generate │ -> │ Overlay │ -> │ Publish │
│  (Reddit)   │    │ (Claude)│    │ (fal.ai) │    │(Magick) │    │ (HTML)  │
└─────────────┘    └─────────┘    └──────────┘    └─────────┘    └─────────┘
   ~$0.30            ~$0.02         ~$0.54           free          ~$0.20
```

### Step 1: Meme Intel (`src/meme-intel.ts`)

Scans 5 subreddits for trending meme formats via [StableSocial](https://stablesocial.dev) (paid through agentcash):

- r/dankmemes
- r/memes
- r/me_irl
- r/ProgrammerHumor
- r/MemeTemplatesOfficial

Returns the top 15 image posts sorted by score, with titles and engagement data. This feeds Claude context about what formats and vibes are resonating today.

### Step 2: Ideate (`src/ideate.ts`)

Sends the Reddit intel to Claude Sonnet with a detailed prompt that:

- Picks 3 proven meme **formats** (Before/After, Expectation vs Reality, POV, etc.)
- Writes 3 original captions per format using **universal relatable experiences**
- Generates a scene prompt for each (describing the image, no text in image)
- Returns structured JSON with `topText`, `bottomText`, and `scenePrompt` for each meme

The prompt incorporates your past rating history (if available) to learn what you find funny.

**Example output concept:**

```json
{
  "topic": "Before/After",
  "formatName": "Before/After",
  "scenePrompt": "Split image. Left side: a confident developer in a clean office, monitors showing green test results. Right side: the same developer slumped in chair, monitors filled with red error messages and stack traces. No text anywhere in the image.",
  "topText": "BEFORE DEPLOYING TO PROD",
  "bottomText": "AFTER DEPLOYING TO PROD"
}
```

### Step 3: Generate (`src/generate.ts`)

Spawns Visa CLI as an [MCP](https://modelcontextprotocol.io) child process and calls the `batch` tool to generate all 9 images in parallel. This triggers a **single Touch ID approval** for the entire batch.

- Uses fal.ai's FLUX model (ultra tier, $0.06/image)
- 1:1 aspect ratio (square memes)
- 10-minute timeout for the full batch
- Returns URLs for each generated image

### Step 4: Overlay (`src/overlay.ts`)

Downloads each image, then uses ImageMagick to apply classic meme text:

- **Impact font**, 64pt
- White fill with 4px black stroke
- Top text at top, bottom text at bottom
- Saves originals as `base_N.jpg` and memes as `meme_N.jpg`

### Step 5: Publish (`src/publish.ts`)

Uploads all meme images and an interactive HTML dashboard to [StableUpload](https://stableupload.dev) via agentcash.

The dashboard (`src/templates.ts`) includes:
- Memes grouped by format category
- 1-10 rating buttons for each meme and each format
- A live leaderboard that updates as you click
- "Save Ratings" button that copies a markdown summary to clipboard
- "Copy Share Link" button

---

## Output Files

Each run creates files in `~/.meme-machine/`:

```
~/.meme-machine/
  latest.txt              # URL of the most recent dashboard
  history.json            # Log of all runs
  2026-04-09/
    base_1.jpg             # Original AI-generated image
    meme_1.jpg             # With Impact font overlay
    base_2.jpg
    meme_2.jpg
    ...
    dashboard.html         # Local copy of the published dashboard
```

**`history.json` example:**

```json
[
  {
    "date": "2026-04-08",
    "url": "https://f.stableupload.dev/abc123/meme-machine-2026-04-08.html",
    "memeCount": 9,
    "cost": 0.78
  },
  {
    "date": "2026-04-09",
    "url": "https://f.stableupload.dev/def456/meme-machine-2026-04-09.html",
    "memeCount": 9,
    "cost": 0.82
  }
]
```

---

## Configuration

All settings are in `src/config.ts`.

### Pipeline

| Setting | Default | Options |
|---------|---------|---------|
| `TOPIC_COUNT` | `3` | Number of meme format categories |
| `MEMES_PER_TOPIC` | `3` | Memes generated per category |
| `IMAGE_TIER` | `'ultra'` | `'ultra'` ($0.06/image) or `'pro'` ($0.04/image) |
| `ASPECT_RATIO` | `'1:1'` | Any fal.ai supported ratio |

### Budget

| Setting | Default | What it controls |
|---------|---------|-----------------|
| `maxPerTransaction` | `$1.00` | Max spend on any single API call |
| `dailyCap` | `$1.50` | Hard cap — pipeline aborts if estimated cost exceeds this |

The pipeline checks the budget **before** generating images:

```
[main] Budget exceeded. Estimated: $1.62, cap: $1.50
```

If this happens, reduce `TOPIC_COUNT`, `MEMES_PER_TOPIC`, or switch `IMAGE_TIER` to `'pro'`.

### Visa CLI path

By default, the pipeline resolves Visa CLI from `node_modules`. Override with:

```bash
export VISA_CLI_MCP_PATH="/path/to/visa-cli/dist/mcp-server/index.js"
```

---

## Running on a Schedule

### Cron (any Unix system)

```bash
# Run at 5 AM PT every day, log output
0 5 * * * cd /path/to/meme-machine && npm start >> ~/.meme-machine/cron.log 2>&1
```

### Claude Code (scheduled agent)

```
/schedule "meme-machine" "0 12 * * *" "cd ~/meme-machine && npm start"
```

### After each run

Check the latest dashboard URL:

```bash
cat ~/.meme-machine/latest.txt
# https://f.stableupload.dev/abc123/meme-machine-2026-04-09.html
```

---

## The Meme Lord Skill

The repo ships with a bundled **Meme Lord** skill at `skills/meme-lord/SKILL.md` — a comprehensive guide to viral meme creation that the pipeline uses as its knowledge base. It includes:

- **Meme Hall of Fame** — The 10 most successful memes of all time (Distracted Boyfriend, Drake, Woman Yelling at Cat, etc.) analyzed for exactly *why* they worked, with replicable recipes
- **Universal Success Patterns** — Ironic contrast, emotional mismatch, confident wrongness, escalation, and more
- **Golden Rules of Virality** — 7 principles distilled from decades of meme culture
- **Your Rating History** — Every meme you've ever rated, so Claude learns what you find funny

The ideation step (`src/ideate.ts`) feeds the entire Meme Lord skill to Claude as context. This means Claude doesn't just generate random memes — it's trained on what makes memes go viral and what *you* specifically rate highly.

### How the Feedback Loop Works

```
  You rate memes ──> Ratings saved ──> Claude reads ratings ──> Better memes next time
       ▲                                                              │
       └──────────────────────────────────────────────────────────────┘
```

1. **Rate memes** in the dashboard (1-10 for each meme and each format)
2. Ratings are **auto-saved** to your browser's localStorage as you click
3. Click **"Save Ratings to Meme Lord"** to copy a structured markdown summary
4. **Paste into `skills/meme-lord/SKILL.md`** under the Rating History section
5. On the next pipeline run, Claude reads your full rating history and adjusts its output

The exported ratings include a "Learnings" section that explicitly calls out what worked (7+/10) and what flopped (3-/10), so Claude can pattern-match on your preferences.

**Example export:**

```markdown
## Meme Machine Ratings — 2026-04-09

### Format Ratings
- **Before/After**: 8/10
- **POV**: 6/10
- **Expectation vs Reality**: 7/10

### Individual Meme Ratings
1. **BEFORE DEPLOYING TO PROD / AFTER DEPLOYING TO PROD** — 9/10 (Before/After)
2. **EXPECTATION / REALITY** — 7/10 (Expectation vs Reality)
3. **NOBODY ASKED / ME AT 3AM** — 3/10 (Nobody/Me)

### Learnings
**What worked:** "BEFORE DEPLOYING TO PROD / AFTER DEPLOYING TO PROD" (9/10, Before/After), "EXPECTATION / REALITY" (7/10, Expectation vs Reality)
**What flopped:** "NOBODY ASKED / ME AT 3AM" (3/10, Nobody/Me)
```

### Pre-trained Preferences

The skill ships pre-loaded with learnings from real testing rounds:

| Meme | Score | Key Learning |
|------|-------|-------------|
| "BEFORE DEPLOYING TO PROD / AFTER DEPLOYING TO PROD" | 8/10 | Universal dev experience + ironic contrast = winner |
| "MAGA Hat Gas Pump" | 8/10 | Culturally specific + recognizable archetype + quiet defeat |
| "Git Push Chaos" (video) | 6/10 | Specific character + dramatic consequence |
| "Meal Prep vs Reality" (video) | 6/10 | Strong visual contrast + character archetypes |
| "NASA Outlook in Space" | 5/10 | Universal tech frustration + absurd context |
| News-based memes | 1/10 | Too niche, require too much context |

---

## Cost Breakdown

| Service | What | Per-run cost | Payment method |
|---------|------|-------------|----------------|
| StableSocial | Reddit scanning (5 subreddits) | ~$0.30 | USDC via agentcash |
| Anthropic API | Claude Sonnet (meme ideation) | ~$0.02 | API key |
| fal.ai | Image generation (9 images, ultra) | ~$0.54 | Card via Visa CLI |
| StableUpload | Host dashboard + images | ~$0.20 | USDC via agentcash |
| **Total** | | **~$1.06** | |

Monthly cost at daily runs: **~$32/month**.

To reduce costs:
- Switch `IMAGE_TIER` to `'pro'` (saves $0.18/run)
- Reduce `MEMES_PER_TOPIC` to `2` (saves $0.12/run)
- Reduce `TOPIC_COUNT` to `2` (saves $0.24/run)

---

## Troubleshooting

### `ANTHROPIC_API_KEY not found`

```
Error: ANTHROPIC_API_KEY not found. Set it in env or store in Keychain:
  security add-generic-password -s meme-machine -a anthropic-api-key -w "sk-ant-..."
```

Set the environment variable or store in macOS Keychain. See [API key storage](#api-key-storage).

### `agentcash: command not found`

agentcash is called via `npx agentcash@latest`, so it doesn't need a global install. But you do need to run setup first:

```bash
npx agentcash@latest setup
```

This configures your USDC wallet for micropayments.

### `magick: command not found`

ImageMagick is not installed:

```bash
# macOS
brew install imagemagick

# Ubuntu/Debian
sudo apt-get install imagemagick

# Check it works
magick --version
```

### `Budget exceeded`

The pipeline estimates cost before generating images and aborts if it would exceed `dailyCap`:

```
[main] Budget exceeded. Estimated: $1.62, cap: $1.50
```

Either increase `BUDGET.dailyCap` in `src/config.ts` or reduce the number of memes.

### `MCP request tools/call timed out`

Image generation took longer than 10 minutes. This can happen with slow network or if fal.ai is under load. The timeout is set in `src/generate.ts` at 600,000ms. Retry usually works.

### `No meme concepts generated`

Claude returned unparseable JSON. Check your API key is valid and has sufficient credits. The raw response is logged to stderr.

### Impact font not found (Linux)

The default font path is macOS-specific (`/System/Library/Fonts/Supplemental/Impact.ttf`). On Linux, update `IMPACT_FONT` in `src/config.ts`:

```typescript
// Linux — install with: sudo apt-get install fonts-liberation
export const IMPACT_FONT = '/usr/share/fonts/truetype/msttcorefonts/Impact.ttf';
```

Or use any bold font you have installed.

---

## Project Structure

```
src/
  index.ts           Orchestrates the 5-step pipeline
  config.ts          Paths, budget limits, API endpoints, pipeline settings
  meme-intel.ts      Step 1 — Scans Reddit via StableSocial for trending formats
  research.ts        (Legacy) Exa-based topic search, replaced by meme-intel
  ideate.ts          Step 2 — Claude picks formats + writes captions
  generate.ts        Step 3 — Visa CLI MCP client, batch image generation
  overlay.ts         Step 4 — ImageMagick text overlay (Impact font)
  publish.ts         Step 5 — Upload to StableUpload, build dashboard
  templates.ts       Dashboard HTML template with rating UI + leaderboard

skills/
  meme-lord/
    SKILL.md         Meme Lord knowledge base — hall of fame, success patterns,
                     golden rules of virality, and your rating history
```

---

## How It Uses MCP

The `generate.ts` module is a standalone [Model Context Protocol](https://modelcontextprotocol.io) client. It spawns Visa CLI's MCP server as a child process over stdio, initializes the protocol handshake, then calls the `batch` tool:

```typescript
// MCP JSON-RPC call
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "batch",
    "arguments": {
      "tool": "generate_image_card",
      "requests": [
        { "prompt": "A confident developer...", "aspect_ratio": "1:1" },
        { "prompt": "A cat sitting on a keyboard...", "aspect_ratio": "1:1" }
      ]
    }
  }
}
```

This means the pipeline runs headlessly — no chat UI needed. The `batch` tool generates all images with a single Touch ID approval.

---

## License

MIT
