"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

const CLASSES = ["drawing", "contract", "boq", "invoice", "approval", "certificate", "site_photo", "policy", "other"] as const;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(new Error("could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function UploadForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [folderPath, setFolder] = useState("/inbox");
  const [docClass, setClass] = useState<(typeof CLASSES)[number]>("other");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("choose a file"); return; }
    setBusy(true);
    setError(null);
    try {
      const contentBase64 = await readBase64(file);
      await browserApi().post("/v1/documents", {
        projectId: projectId || undefined,
        folderPath: folderPath.startsWith("/") ? folderPath : `/${folderPath}`,
        name: name || file.name,
        docClass,
        mimeType: file.type || "application/octet-stream",
        contentBase64,
      });
      setName("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3">
      <input placeholder="Name (defaults to file)" value={name} onChange={(e) => setName(e.target.value)} className="w-44 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Folder /path" value={folderPath} onChange={(e) => setFolder(e.target.value)} className="w-36 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={docClass} onChange={(e) => setClass(e.target.value as (typeof CLASSES)[number])} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
