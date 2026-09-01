import Link from "next/link";
import { loadOne } from "@/lib/load";

interface Download {
  mimeType: string;
  version: number;
  sha256: string;
  contentBase64?: string;
}

/** Document bytes metadata from GET /v1/documents/:id/download (body omitted). */
export default async function DocumentPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await loadOne<Download>(`/v1/documents/${id}/download`);
  const bytes = d?.contentBase64 ? Math.floor((d.contentBase64.length * 3) / 4) : 0;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Document</h1>
      <p className="mb-4 text-sm"><Link href="/documents" style={{ color: "var(--bo-primary)" }}>← Vault</Link></p>
      {!d ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Download unavailable.</p>
      ) : (
        <dl className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <div className="flex justify-between py-1"><dt>MIME</dt><dd>{d.mimeType}</dd></div>
          <div className="flex justify-between py-1"><dt>Version</dt><dd>{d.version}</dd></div>
          <div className="flex justify-between py-1"><dt>SHA-256</dt><dd className="max-w-md truncate font-mono text-xs">{d.sha256}</dd></div>
          <div className="flex justify-between py-1"><dt>Size</dt><dd>{bytes.toLocaleString("en-IN")} bytes</dd></div>
        </dl>
      )}
    </main>
  );
}
