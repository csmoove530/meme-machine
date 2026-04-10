import { spawn, ChildProcess } from 'child_process';
import { ASPECT_RATIO } from './config';
import type { MemeConcept } from './ideate';

export interface GeneratedImage {
  concept: MemeConcept;
  imageUrl: string;
  cost: number;
}

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
 * Generate all images using Visa CLI's `batch` tool.
 * This triggers a SINGLE Touch ID approval for all images,
 * then generates them all in parallel on the server.
 */
export async function generate(concepts: MemeConcept[]): Promise<GeneratedImage[]> {
  console.log(`[generate] Generating ${concepts.length} images via Visa CLI batch (single Touch ID approval)...`);
  console.log(`[generate] You will be prompted for Touch ID ONCE to approve all ${concepts.length} images ($${(concepts.length * 0.06).toFixed(2)} total).`);

  const mcp = new VisaCliMcp();
  const results: GeneratedImage[] = [];

  try {
    await mcp.initialize();
    console.log('[generate] Visa CLI MCP server connected');

    // Build batch requests array
    const requests = concepts.map(concept => ({
      prompt: concept.scenePrompt,
      aspect_ratio: ASPECT_RATIO,
    }));

    console.log(`[generate] Sending batch of ${requests.length} images — approve Touch ID now...`);

    // Single batch call = single Touch ID prompt
    const batchResult = await mcp.callTool('batch', {
      tool: 'generate_image_card',
      requests,
      user_context: `Meme Machine: batch generating ${concepts.length} memes`,
    }, 600_000); // 10 minute timeout for batch

    // Parse batch results
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
            results.push({
              concept: concepts[i],
              imageUrl: url,
              cost: 0.06,
            });
            console.log(`[generate] (${results.length}/${concepts.length}) OK — ${url.slice(-40)}`);
          }
        }
      } catch {
        // Try to extract URLs from non-JSON text
        const urls = block.text.match(/https:\/\/[^\s"]+\.(jpg|png|jpeg)/g) || [];
        for (let i = 0; i < urls.length && i < concepts.length; i++) {
          results.push({ concept: concepts[i], imageUrl: urls[i], cost: 0.06 });
        }
      }
    }
  } finally {
    mcp.close();
  }

  const totalCost = results.length * 0.06;
  console.log(`[generate] Done: ${results.length}/${concepts.length} images, total $${totalCost.toFixed(2)}`);
  return results;
}
