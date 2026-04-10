import { execFileSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { MAGICK_BIN, IMPACT_FONT, todayDir } from './config';
import type { GeneratedImage } from './generate';

export interface OverlaidMeme {
  concept: GeneratedImage['concept'];
  localPath: string;
  filename: string;
  cost: number;
}

/** Download an image URL to a local path */
function download(url: string, dest: string): void {
  const result = execFileSync('curl', ['-sL', '-o', dest, url], {
    timeout: 30_000,
    encoding: 'utf-8',
  });
}

/** Overlay top/bottom text on an image using ImageMagick */
function overlayText(inputPath: string, outputPath: string, topText: string, bottomText: string): void {
  // Auto-size: use percentage of image width for font size
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

export async function overlay(images: GeneratedImage[]): Promise<OverlaidMeme[]> {
  console.log(`[overlay] Processing ${images.length} images with ImageMagick...`);

  const dir = todayDir();
  const results: OverlaidMeme[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.imageUrl.endsWith('.png') ? 'png' : 'jpg';
    const baseName = `base_${i + 1}.${ext}`;
    const memeName = `meme_${i + 1}.jpg`;
    const basePath = join(dir, baseName);
    const memePath = join(dir, memeName);

    try {
      console.log(`[overlay] (${i + 1}/${images.length}) Downloading & overlaying...`);
      download(img.imageUrl, basePath);
      overlayText(basePath, memePath, img.concept.topText, img.concept.bottomText);
      results.push({
        concept: img.concept,
        localPath: memePath,
        filename: memeName,
        cost: img.cost,
      });
    } catch (err: any) {
      console.error(`[overlay] Failed for meme ${i + 1}:`, err.message);
    }
  }

  console.log(`[overlay] Done: ${results.length}/${images.length} memes created in ${dir}`);
  return results;
}
