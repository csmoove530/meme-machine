#!/usr/bin/env node
/**
 * Meme Machine — Daily automated meme generation pipeline
 *
 * Pipeline: Meme Intel (Reddit) -> Ideate (Claude picks formats + writes captions) -> Generate (Visa CLI) -> Overlay (ImageMagick) -> Publish (StableUpload)
 *
 * Usage:
 *   npm run meme-machine
 *   npx tsx scripts/meme-machine/index.ts
 */

import { scanMemeIntel } from './meme-intel';
import { ideate } from './ideate';
import { generate } from './generate';
import { overlay } from './overlay';
import { publish } from './publish';
import { BUDGET } from './config';

async function main() {
  const startTime = Date.now();
  let totalCost = 0;

  console.log('');
  console.log('='.repeat(60));
  console.log('  MEME MACHINE — Daily Meme Generation Pipeline');
  console.log('  ' + new Date().toISOString().slice(0, 10));
  console.log('='.repeat(60));
  console.log('');

  try {
    // ── Step 1: Meme Intel (Reddit scan via StableSocial) ──────────
    const memeIntel = await scanMemeIntel();

    // ── Step 2: Ideate (Claude picks formats + writes captions) ───
    const concepts = await ideate(memeIntel);
    totalCost += 0.02; // Claude API call
    const allConcepts = concepts.topics.flatMap(t => t.concepts);

    if (allConcepts.length === 0) {
      console.error('[main] No meme concepts generated. Aborting.');
      process.exit(1);
    }

    // ── Step 3: Generate ──────────────────────────────────────────
    if (totalCost + (allConcepts.length * 0.06) > BUDGET.dailyCap) {
      console.error(`[main] Budget exceeded. Estimated: $${(totalCost + allConcepts.length * 0.06).toFixed(2)}, cap: $${BUDGET.dailyCap}`);
      process.exit(1);
    }

    const images = await generate(allConcepts);
    totalCost += images.reduce((sum, img) => sum + img.cost, 0);

    if (images.length === 0) {
      console.error('[main] No images generated. Aborting.');
      process.exit(1);
    }

    // ── Step 4: Overlay ───────────────────────────────────────────
    const memes = await overlay(images);

    if (memes.length === 0) {
      console.error('[main] No memes created. Aborting.');
      process.exit(1);
    }

    // ── Step 5: Publish ───────────────────────────────────────────
    const dashboardUrl = await publish(memes, concepts, totalCost + 0.20);
    totalCost += 0.20; // StableUpload

    // ── Done ──────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    console.log('');
    console.log('='.repeat(60));
    console.log('  MEME MACHINE — Complete!');
    console.log(`  Memes:     ${memes.length}`);
    console.log(`  Topics:    ${concepts.topics.length}`);
    console.log(`  Cost:      $${totalCost.toFixed(2)}`);
    console.log(`  Time:      ${elapsed}s`);
    console.log(`  Dashboard: ${dashboardUrl}`);
    console.log('='.repeat(60));
    console.log('');

  } catch (err: any) {
    console.error('');
    console.error('[main] Pipeline failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
