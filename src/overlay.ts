import { execFileSync } from 'child_process';
import { join } from 'path';
import { MAGICK_BIN, IMPACT_FONT, MEDIA_MODE, todayDir } from './config';
import type { GeneratedMedia } from './generate';

export interface OverlaidMeme {
  concept: GeneratedMedia['concept'];
  localPath: string;
  mediaUrl: string;
  filename: string;
  mediaType: 'video' | 'image';
  cost: number;
}

/** Download a URL to a local path */
function download(url: string, dest: string): void {
  execFileSync('curl', ['-sL', '-o', dest, url], {
    timeout: 60_000,
    encoding: 'utf-8',
  });
}

/** Overlay top/bottom text on an image using ImageMagick */
function overlayText(inputPath: string, outputPath: string, topText: string, bottomText: string): void {
  execFileSync(MAGICK_BIN, [
    inputPath,
    '-gravity', 'North',
    '-font', IMPACT_FONT,
    '-pointsize', '64',
    '-stroke', 'black', '-strokewidth', '4',
    '-fill', 'white',
    '-annotate', '+0+20', topText.toUpperCase(),
    '-gravity', 'South',
    '-font', IMPACT_FONT,
    '-pointsize', '64',
    '-stroke', 'black', '-strokewidth', '4',
    '-fill', 'white',
    '-annotate', '+0+20', bottomText.toUpperCase(),
    outputPath,
  ], { timeout: 30_000 });
}

export async function overlay(media: GeneratedMedia[]): Promise<OverlaidMeme[]> {
  const dir = todayDir();
  const results: OverlaidMeme[] = [];

  if (MEDIA_MODE === 'video') {
    // Video mode: download videos locally, no text overlay (captions shown in dashboard)
    console.log(`[overlay] Downloading ${media.length} videos (no text overlay for video)...`);

    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      const filename = `meme_${i + 1}.mp4`;
      const localPath = join(dir, filename);

      try {
        console.log(`[overlay] (${i + 1}/${media.length}) Downloading video...`);
        download(item.mediaUrl, localPath);
        results.push({
          concept: item.concept,
          localPath,
          mediaUrl: item.mediaUrl,
          filename,
          mediaType: 'video',
          cost: item.cost,
        });
      } catch (err: any) {
        console.error(`[overlay] Failed for video ${i + 1}:`, err.message);
      }
    }
  } else {
    // Image mode: download + apply Impact font text overlay
    console.log(`[overlay] Processing ${media.length} images with ImageMagick...`);

    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      const ext = item.mediaUrl.endsWith('.png') ? 'png' : 'jpg';
      const baseName = `base_${i + 1}.${ext}`;
      const memeName = `meme_${i + 1}.jpg`;
      const basePath = join(dir, baseName);
      const memePath = join(dir, memeName);

      try {
        console.log(`[overlay] (${i + 1}/${media.length}) Downloading & overlaying...`);
        download(item.mediaUrl, basePath);
        overlayText(basePath, memePath, item.concept.topText, item.concept.bottomText);
        results.push({
          concept: item.concept,
          localPath: memePath,
          mediaUrl: item.mediaUrl,
          filename: memeName,
          mediaType: 'image',
          cost: item.cost,
        });
      } catch (err: any) {
        console.error(`[overlay] Failed for meme ${i + 1}:`, err.message);
      }
    }
  }

  console.log(`[overlay] Done: ${results.length}/${media.length} memes in ${dir}`);
  return results;
}
