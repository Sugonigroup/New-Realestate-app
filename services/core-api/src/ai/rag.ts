import { createHash } from "node:crypto";

/**
 * RAG service (Phase 6, 15): ingestion chunking, embedding via port,
 * PERMISSION-FILTERED retrieval with citations. The scope filter is applied
 * inside retrieval — never by the model (15 §4 hard rule).
 */

export interface ChunkOptions {
  sizeChars: number; // ~500 tokens
  overlapChars: number;
}

export const DEFAULT_CHUNK: ChunkOptions = { sizeChars: 800, overlapChars: 120 };

export interface TextChunk {
  index: number;
  content: string;
  hash: string;
}

export function chunkText(content: string, opts: ChunkOptions = DEFAULT_CHUNK): TextChunk[] {
  const clean = content.replace(/\r\n/g, "\n");
  if (clean.length === 0) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < clean.length) {
    const end = Math.min(start + opts.sizeChars, clean.length);
    const piece = clean.slice(start, end);
    chunks.push({ index, content: piece, hash: createHash("sha256").update(piece).digest("hex").slice(0, 16) });
    if (end === clean.length) break;
    start = end - opts.overlapChars;
    index += 1;
  }
  return chunks;
}

/** Embedding port — deterministic hash embedder for tests/shadow; real adapter via gateway. */
export interface EmbeddingPort {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export class HashEmbedder implements EmbeddingPort {
  readonly dimensions = 64;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array<number>(this.dimensions).fill(0);
      const tokens = t.toLowerCase().split(/\W+/).filter(Boolean);
      for (const tok of tokens) {
        const h = createHash("sha256").update(tok).digest();
        const i0 = h[0]! % this.dimensions;
        const i1 = h[1]! % this.dimensions;
        v[i0] = (v[i0] ?? 0) + 1;
        v[i1] = (v[i1] ?? 0) + 0.5;
      }return v;
    });
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface IndexedChunk {
  chunk: TextChunk;
  embedding: number[];
  tenantId: string;
  projectId?: string;
  docTitle: string;
  version: number;
}

export interface RetrievalHit {
  chunk: TextChunk;
  score: number;
  citation: string; // "doc title vN · chunk i"
}

/**
 * In-memory index with the EXACT permission filter the pgvector query will use:
 * tenant always; project only within the caller's scope (07 §8, 15 §4).
 */
export class KnowledgeIndex {
  private readonly entries: IndexedChunk[] = [];

  async ingest(
    input: { tenantId: string; projectId?: string; docTitle: string; version: number; content: string },
    embedder: EmbeddingPort,
    opts?: ChunkOptions,
  ): Promise<number> {
    const chunks = chunkText(input.content, opts);
    const embeddings = await embedder.embed(chunks.map((c) => c.content));
    chunks.forEach((c, i) => {
      this.entries.push({
        chunk: c,
        embedding: embeddings[i]!,
        tenantId: input.tenantId,
        projectId: input.projectId,
        docTitle: input.docTitle,
        version: input.version,
      });
    });
    return chunks.length;
  }

  async retrieve(
    query: string,
    scope: { tenantId: string; projectIds?: string[] },
    embedder: EmbeddingPort,
    topK = 5,
  ): Promise<RetrievalHit[]> {
    const [q] = await embedder.embed([query]);
    const hits = this.entries
      .filter((e) => e.tenantId === scope.tenantId)
      .filter((e) => !scope.projectIds || (e.projectId !== undefined && scope.projectIds.includes(e.projectId)))
      .map((e) => ({
        chunk: e.chunk,
        score: cosineSimilarity(q!, e.embedding),
        citation: `${e.docTitle} v${e.version} · chunk ${e.chunk.index}`,
      }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return hits;
  }
}
