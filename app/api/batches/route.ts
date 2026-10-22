import { NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "crypto";
import { db } from "@/lib/supabase";
import { makeSlug } from "@/lib/slug";
import { allow } from "@/lib/ratelimit";

const MB = 1024 * 1024;
const EXPIRY = [1, 24, 72, 168];
const safeName = (n: string) =>
  n
    .replace(/[\\/]/g, "_")
    .replace(/\.\.+/g, ".")
    .replace(/[^\w.\- ]/g, "_")
    .trim()
    .slice(0, 100) || "file";
const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!(await allow(req, "create", 10, 3600)))
    return bad("Slow down, try again later", 429);
  const b = await req.json().catch(() => null);
  if (!b) return bad("Bad request");

  const files: {
    name: string;
    size: number;
    type?: string;
    converted?: boolean;
  }[] = b.files ?? [];
  const text: string | null = b.text?.trim() ? b.text : null;
  const slugFormat = b.slugFormat === "chars" ? "chars" : "words";
  const hours = EXPIRY.includes(b.expiryHours) ? b.expiryHours : 24;
  const mode = b.mode;

  if (!["text", "file", "both"].includes(mode)) return bad("Bad mode");
  if (mode !== "file" && !text && !files.length) return bad("Nothing to send");
  if (mode === "file" && !files.length) return bad("Add a file");
  if (text && text.length > 100_000) return bad("Text too long");
  if (files.length > 10) return bad("Max 10 files");
  if (files.some((f) => !(f.size > 0) || f.size > 20 * MB))
    return bad("Each file must be 1 byte to 20 MB");
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > 50 * MB) return bad("Max 50 MB per batch");

  // global storage guard
  const { data: all } = await db.from("batches").select("total_bytes");
  const used = (all ?? []).reduce((s, r) => s + Number(r.total_bytes), 0);
  if (used + total > 850 * MB)
    return bad("MeBatch is full right now, try again soon", 503);

  const ownerToken = randomBytes(16).toString("hex");
  const ownerHash = createHash("sha256").update(ownerToken).digest("hex");

  let slug = "";
  for (let i = 0; i < 5; i++) {
    slug = makeSlug(slugFormat);
    const { error } = await db.from("batches").insert({
      slug,
      expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
      slug_format: slugFormat,
      mode,
      text_content: text && !files.some((f) => f.converted) ? text : null,
      owner_hash: ownerHash,
      burn_after_reading: !!b.burn,
      total_bytes: total,
    });
    if (!error) break;
    // in the slug insert loop
    if (error.code !== "23505" || i === 4) {
      console.error("batches insert:", error);
      return bad("Could not create batch: " + error.message, 500);
    }
  }

  const uploads = [];
  for (const f of files) {
    const name = safeName(f.name);
    const id = randomUUID();
    const path = `${slug}/${id}-${name}`;
    const { data, error } = await db.storage
      .from("batches")
      .createSignedUploadUrl(path);
    // in the uploads loop
    if (error) {
      console.error("signed upload:", error);
      await db.from("batches").delete().eq("slug", slug);
      return bad("Upload setup failed: " + error.message, 500);
    }
    await db.from("batch_files").insert({
      id,
      slug,
      storage_path: path,
      name,
      size: f.size,
      mime_type: f.type || null,
      is_converted_text: !!f.converted,
    });
    uploads.push({ name, path, url: data.signedUrl });
  }

  return NextResponse.json({ slug, ownerToken, uploads });
}
