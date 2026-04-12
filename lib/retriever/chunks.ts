import fs from "fs";
import path from "path";
import { CONFIG } from "@/lib/config";

export type RawChunk = {
  chunk_id: string;
  policy_version: string;
  title: string;
  text: string;
};

let cached: RawChunk[] | null = null;

/** Split markdown into coarse sections (PoC chunking). */
export function loadPolicyChunks(): RawChunk[] {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "policy.md");
  const md = fs.readFileSync(file, "utf-8");
  const sections = md.split(/^##\s+/m).filter(Boolean);
  const chunks: RawChunk[] = [];
  let idx = 0;
  for (const block of sections) {
    const lines = block.trim().split("\n");
    const title = lines[0]?.trim() ?? "section";
    const text = lines.slice(1).join("\n").trim() || block.trim();
    if (!text) continue;
    chunks.push({
      chunk_id: `policy-chunk-${idx++}`,
      policy_version: CONFIG.policyVersion,
      title,
      text: `## ${title}\n\n${text}`,
    });
  }
  if (chunks.length === 0) {
    chunks.push({
      chunk_id: "policy-chunk-0",
      policy_version: CONFIG.policyVersion,
      title: "policy",
      text: md,
    });
  }
  cached = chunks;
  return chunks;
}
