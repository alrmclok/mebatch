import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getLive, isOwner } from "@/lib/batch";
import { allow } from "@/lib/ratelimit";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
if (!(await allow(req, "lookup", 30, 60)))
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const b = await getLive((await params).slug);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: files } = await db.from("batch_files")
    .select("id,name,size,mime_type,is_converted_text").eq("slug", b.slug);
  return NextResponse.json({
    slug: b.slug, mode: b.mode, text: b.text_content, expiresAt: b.expires_at,
    burn: b.burn_after_reading, files: files ?? [], isOwner: isOwner(b, req),
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const b = await getLive((await params).slug);
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!isOwner(b, req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: files } = await db.from("batch_files").select("storage_path").eq("slug", b.slug);
  if (files?.length) await db.storage.from("batches").remove(files.map((f) => f.storage_path));
  await db.from("batches").delete().eq("slug", b.slug); // cascades batch_files + reports
  return NextResponse.json({ ok: true });
}