import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getLive } from "@/lib/batch";
import { allow } from "@/lib/ratelimit";

const IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const VID = ["video/mp4", "video/webm", "video/quicktime"];
const MB = 1024 * 1024;
const previewable = (f: { mime_type: string | null; size: number }) =>
  (IMG.includes(f.mime_type ?? "") && f.size <= 5 * MB) ||
  VID.includes(f.mime_type ?? "");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await allow(req, "dl", 60, 60)))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const b = await getLive((await params).slug);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { ids, preview } = await req.json().catch(() => ({}));
  let q = db
    .from("batch_files")
    .select("id,name,size,mime_type,storage_path")
    .eq("slug", b.slug);
  if (Array.isArray(ids) && ids.length) q = q.in("id", ids);
  const { data: files } = await q;
  if (!files?.length)
    return NextResponse.json({ error: "no_files" }, { status: 404 });

  if (preview) {
    if (files.some((f) => !previewable(f)))
      return NextResponse.json({ error: "not_previewable" }, { status: 400 });
  } else if (b.burn_after_reading) {
    // atomic: only the first caller flips expires_at, everyone else gets 410
    const now = new Date().toISOString();
    const { data: won } = await db
      .from("batches")
      .update({ expires_at: now })
      .eq("slug", b.slug)
      .gt("expires_at", now)
      .select("slug");
    if (!won?.length)
      return NextResponse.json({ error: "gone" }, { status: 410 });
  }

  const urls = [];
  for (const f of files) {
    const { data } = await db.storage
      .from("batches")
      .createSignedUrl(
        f.storage_path,
        60,
        preview ? undefined : { download: f.name },
      );
    if (data) urls.push({ id: f.id, name: f.name, url: data.signedUrl });
  }
  return NextResponse.json({ urls });
}
