import { describe, expect, it } from "vitest";
import { HashEmbedder, KnowledgeIndex, chunkText } from "./rag.js";

describe("chunking (15 §3)", () => {
  it("splits with overlap and hashes content", () => {
    // varied content so overlapping windows differ
    const content = Array.from({ length: 2000 }, (_, i) => String.fromCharCode(65 + (i % 26))).join("");
    const chunks = chunkText(content, { sizeChars: 800, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]!.content).toHaveLength(800);
    // overlap: chunk[1] starts 680 chars into chunk[0]
    expect(chunks[1]!.content.slice(0, 50)).toBe(chunks[0]!.content.slice(680, 730));
    expect(chunks[0]!.hash).not.toBe(chunks[1]!.hash);
  });

  it("short documents yield a single chunk", () => {
    expect(chunkText("short")).toHaveLength(1);
    expect(chunkText("")).toHaveLength(0);
  });
});

describe("permission-filtered retrieval (15 §4 hard rule)", () => {
  const embedder = new HashEmbedder();

  it("returns only tenant-scoped, project-allowed chunks with citations", async () => {
    const index = new KnowledgeIndex();
    await index.ingest({ tenantId: "t-1", projectId: "pA", docTitle: "Verde BOQ", version: 2, content: "cement opc 53 grade rate per bag for Verde Residences structure works" }, embedder);
    await index.ingest({ tenantId: "t-1", projectId: "pB", docTitle: "Atrium BOQ", version: 1, content: "cement opc 53 grade atrium commercial concrete supply" }, embedder);
    await index.ingest({ tenantId: "t-2", projectId: "pZ", docTitle: "Other Tenant", version: 1, content: "cement opc 53 grade totally different tenant contract" }, embedder);

    // caller scoped to pA only
    const hits = await index.retrieve("cement rate", { tenantId: "t-1", projectIds: ["pA"] }, embedder);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.citation.startsWith("Verde BOQ"))).toBe(true);
    expect(hits.every((h) => !h.citation.includes("Atrium"))).toBe(true);
  });

  it("cross-tenant leakage is impossible", async () => {
    const index = new KnowledgeIndex();
    await index.ingest({ tenantId: "t-2", docTitle: "Secret", version: 1, content: "cement pricing secret clause" }, embedder);
    const hits = await index.retrieve("cement pricing secret", { tenantId: "t-1" }, embedder);
    expect(hits).toHaveLength(0);
  });
});
