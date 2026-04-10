import { spawn, ChildProcess } from 'child_process';
import { ASPECT_RATIO, MEDIA_MODE, COST_PER_ITEM } from './config';
import type { MemeConcept } from './ideate';

export interface GeneratedMedia {
  concept: MemeConcept;
  mediaUrl: string;
  mediaType: 'video' | 'image';
  cost: number;
}

// Keep backward compat alias
export type GeneratedImage = GeneratedMedia;

/**
 * Persistent Visa CLI MCP connection.
 * Spawns visa-cli's MCP server as a child process with stdio transport.
 */
class VisaCliMcp {
  private child: ChildProcess;
  private buffer = '';
  private pendingResolvers = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  private ready = false;

  constructor() {
    // Resolve Visa CLI MCP server — installed as a dependency or globally
    const serverPath = process.env.VISA_CLI_MCP_PATH
      || require.resolve('@anthropic-ai/visa-cli/dist/mcp-server/index.js');
    this.child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.child.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.child.stderr!.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg && !msg.includes('[info]') && !msg.includes('[INFO]')) {
        console.error(`[visa-cli] ${msg.slice(0, 200)}`);
      }
    });
  }

  private processBuffer() {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id && this.pendingResolvers.has(msg.id)) {
          const { resolve, reject } = this.pendingResolvers.get(msg.id)!;
          this.pendingResolvers.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch { /* not JSON */ }
    }
  }

  private send(method: string, params: any, timeoutMs = 120_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingResolvers.set(id, { resolve, reject });
      this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pendingResolvers.has(id)) {
          this.pendingResolvers.delete(id);
          reject(new Error(`MCP request ${method} timed out after ${timeoutMs / 1000}s`));
        }
      }, timeoutMs);
    });
  }

  async initialize(): Promise<void> {
    await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'meme-machine', version: '1.0.0' },
    });
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    this.ready = true;
  }

  async callTool(name: string, args: Record<string, any>, timeoutMs?: number): Promise<any> {
    if (!this.ready) throw new Error('MCP not initialized');
    return this.send('tools/call', { name, arguments: args }, timeoutMs);
  }

  close() {
    try { this.child.stdin!.end(); } catch {}
    this.child.kill();
  }
}

/**
 * Generate all media using Visa CLI.
 *
 * Image mode: uses `batch` tool for a single Touch ID approval, all in parallel.
 * Video mode: generates one at a time (each needs its own approval, ~60-90s each).
 */
export async function generate(concepts: MemeConcept[]): Promise<GeneratedMedia[]> {
  const isVideo = MEDIA_MODE === 'video';
  const toolName = isVideo ? 'generate_video_tempo_card' : 'generate_image_card';
  const costPer = COST_PER_ITEM;
  const totalEstimate = (concepts.length * costPer).toFixed(2);

  console.log(`[generate] Mode: ${MEDIA_MODE.toUpperCase()}`);
  console.log(`[generate] Generating ${concepts.length} ${MEDIA_MODE}s via Visa CLI ($${totalEstimate} total)...`);

  const mcp = new VisaCliMcp();
  const results: GeneratedMedia[] = [];

  try {
    await mcp.initialize();
    console.log('[generate] Visa CLI MCP server connected');

    if (isVideo) {
      // Video mode: one at a time (each needs Touch ID, ~60-90s generation)
      for (let i = 0; i < concepts.length; i++) {
        const concept = concepts[i];
        console.log(`[generate] (${i + 1}/${concepts.length}) "${concept.topText} / ${concept.bottomText}" — approve Touch ID ($${costPer})...`);

        try {
          const result = await mcp.callTool(toolName, {
            prompt: concept.scenePrompt,
            aspect_ratio: ASPECT_RATIO,
            user_context: `Meme Machine: generating video ${i + 1}/${concepts.length}`,
          }, 300_000); // 5 minute timeout per video

          const url = extractMediaUrl(result, 'mp4');
          if (url) {
            results.push({ concept, mediaUrl: url, mediaType: 'video', cost: costPer });
            console.log(`[generate] ✓ Done — ${url.slice(-50)}`);
          } else {
            console.error(`[generate] ✗ No video URL in response`);
          }
        } catch (err: any) {
          console.error(`[generate] ✗ Failed: ${err.message?.slice(0, 100)}`);
        }
      }
    } else {
      // Image mode: batch for single Touch ID approval
      const requests = concepts.map(concept => ({
        prompt: concept.scenePrompt,
        aspect_ratio: ASPECT_RATIO,
      }));

      console.log(`[generate] Sending batch of ${requests.length} images — approve Touch ID now...`);

      const batchResult = await mcp.callTool('batch', {
        tool: toolName,
        requests,
        user_context: `Meme Machine: batch generating ${concepts.length} memes`,
      }, 600_000);

      const content = batchResult.content || [];
      for (const block of content) {
        if (block.type !== 'text') continue;
        try {
          const parsed = JSON.parse(block.text);
          const batchResults = parsed.results || [];

          for (let i = 0; i < batchResults.length; i++) {
            const r = batchResults[i];
            if (!r.success) {
              console.error(`[generate] Image ${i + 1} failed: ${r.error || 'unknown'}`);
              continue;
            }
            const url = r.data?.imageUrl || r.urls?.[0] || '';
            if (url && i < concepts.length) {
              results.push({ concept: concepts[i], mediaUrl: url, mediaType: 'image', cost: costPer });
              console.log(`[generate] (${results.length}/${concepts.length}) OK — ${url.slice(-40)}`);
            }
          }
        } catch {
          const urls = block.text.match(/https:\/\/[^\s"]+\.(jpg|png|jpeg)/g) || [];
          for (let i = 0; i < urls.length && i < concepts.length; i++) {
            results.push({ concept: concepts[i], mediaUrl: urls[i], mediaType: 'image', cost: costPer });
          }
        }
      }
    }
  } finally {
    mcp.close();
  }

  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  console.log(`[generate] Done: ${results.length}/${concepts.length} ${MEDIA_MODE}s, total $${totalCost.toFixed(2)}`);
  return results;
}

/** Extract a media URL from MCP tool result */
function extractMediaUrl(result: any, ext: string): string {
  const content = result.content || [];
  for (const block of content) {
    if (block.type !== 'text') continue;
    try {
      const parsed = JSON.parse(block.text);
      return parsed.videoUrl || parsed.imageUrl || parsed.urls?.[0] || '';
    } catch {
      const regex = new RegExp(`https://[^\\s"]+\\.${ext}`, 'g');
      const urls = block.text.match(regex) || [];
      if (urls.length) return urls[0];
    }
  }
  return '';
}
