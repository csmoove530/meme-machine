import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { STABLE_UPLOAD_URL, HISTORY_FILE, LATEST_FILE } from './config';
import { buildDashboardHtml } from './templates';
import type { OverlaidMeme } from './overlay';
import type { IdeateResult } from './ideate';

interface UploadResult {
  uploadUrl: string;
  publicUrl: string;
}

/** Upload a file to StableUpload via agentcash CLI */
function uploadFile(filename: string, contentType: string, localPath: string): UploadResult {
  // Step 1: Get upload slot
  const body = JSON.stringify({ filename, contentType, tier: '10mb' });
  const slotResult = execFileSync('npx', [
    'agentcash@latest', 'fetch',
    '--method', 'POST',
    '--body', body,
    STABLE_UPLOAD_URL,
  ], { encoding: 'utf-8', timeout: 30_000, maxBuffer: 1024 * 1024 });

  const slot = JSON.parse(slotResult);
  const data = slot.data || slot;
  const uploadUrl = data.uploadUrl;
  const publicUrl = data.publicUrl;

  if (!uploadUrl) throw new Error('No uploadUrl in StableUpload response');

  // Step 2: PUT the file
  execFileSync('curl', [
    '-sX', 'PUT',
    uploadUrl,
    '-H', `Content-Type: ${contentType}`,
    '--data-binary', `@${localPath}`,
  ], { timeout: 60_000 });

  return { uploadUrl, publicUrl };
}

export async function publish(
  memes: OverlaidMeme[],
  ideateResult: IdeateResult,
  totalCost: number,
): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  console.log(`[publish] Uploading ${memes.length} memes + dashboard...`);

  // Upload each meme (image or video)
  const uploadedMemes: { meme: OverlaidMeme; mediaUrl: string }[] = [];

  for (let i = 0; i < memes.length; i++) {
    const meme = memes[i];
    const isVideo = meme.mediaType === 'video';
    const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
    console.log(`[publish] (${i + 1}/${memes.length}) Uploading ${meme.filename}...`);
    try {
      const result = uploadFile(
        `meme-machine-${date}-${meme.filename}`,
        contentType,
        meme.localPath,
      );
      uploadedMemes.push({ meme, mediaUrl: result.publicUrl });
      console.log(`[publish] OK — ${result.publicUrl.slice(-50)}`);
    } catch (err: any) {
      // For videos, fall back to the original fal.ai URL (already hosted)
      if (isVideo && meme.mediaUrl) {
        uploadedMemes.push({ meme, mediaUrl: meme.mediaUrl });
        console.log(`[publish] Upload failed, using fal.ai URL directly`);
      } else {
        console.error(`[publish] Failed to upload ${meme.filename}:`, err.message);
      }
    }
  }

  // Group by topic
  const topicGroups = ideateResult.topics.map(topic => ({
    name: topic.name,
    memes: uploadedMemes.filter(um =>
      topic.concepts.some(c => c.topText === um.meme.concept.topText)
    ),
  }));

  // Build dashboard HTML
  const dashboardHtml = buildDashboardHtml(topicGroups, date, totalCost, 'PLACEHOLDER');

  // Write dashboard locally
  const { todayDir } = await import('./config');
  const dashboardPath = `${todayDir()}/dashboard.html`;
  writeFileSync(dashboardPath, dashboardHtml, 'utf-8');

  // Upload dashboard
  console.log('[publish] Uploading dashboard...');
  let dashboardUrl = `file://${dashboardPath}`;
  try {
    const result = uploadFile(
      `meme-machine-${date}.html`,
      'text/html',
      dashboardPath,
    );
    dashboardUrl = result.publicUrl;

    // Rewrite with correct share URL
    const finalHtml = dashboardHtml.replace('PLACEHOLDER', dashboardUrl);
    writeFileSync(dashboardPath, finalHtml, 'utf-8');
    // Re-upload with correct URL
    execFileSync('curl', [
      '-sX', 'PUT',
      result.uploadUrl.replace(result.publicUrl, result.uploadUrl),
      '-H', 'Content-Type: text/html',
      '--data-binary', `@${dashboardPath}`,
    ], { timeout: 30_000 }).toString();
  } catch (err: any) {
    console.error('[publish] Dashboard upload failed, using local file:', err.message);
  }

  // Save to latest.txt
  writeFileSync(LATEST_FILE, dashboardUrl, 'utf-8');

  // Append to history.json
  let history: { date: string; url: string; memeCount: number; cost: number }[] = [];
  if (existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')); } catch { }
  }
  history.push({ date, url: dashboardUrl, memeCount: uploadedMemes.length, cost: totalCost });
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');

  console.log(`[publish] Dashboard: ${dashboardUrl}`);
  return dashboardUrl;
}
