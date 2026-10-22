import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const bucket = () => db.storage.from("batches");

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Unauthorized", { status: 401 });

  // 1. expired batches (includes burned ones)
  const { data: expired } = await db.from("batches").select("slug")
    .lte("expires_at", new Date().toISOString());
  for (const { slug } of expired ?? []) {
    const { data: f } = await db.from("batch_files").select("storage_path").eq("slug", slug);
    if (f?.length) await bucket().remove(f.map((x) => x.storage_path));
    await db.from("batches").delete().eq("slug", slug);
  }

  // 2. orphan sweep: storage folders with no batches row
  const { data: rows } = await db.from("batches").select("slug");
  const live = new Set((rows ?? []).map((r) => r.slug));
  const { data: folders } = await bucket().list("", { limit: 1000 });
  let swept = 0;
  for (const fo of folders ?? []) {
    if (live.has(fo.name)) continue;
    const { data: objs } = await bucket().list(fo.name, { limit: 1000 });
    if (objs?.length) await bucket().remove(objs.map((o) => `${fo.name}/${o.name}`));
    swept++;
  }

  // housekeeping: old rate limit rows
  await db.from("rate_limits").delete().lt("window_start", new Date(Date.now() - 86400_000).toISOString());

  return NextResponse.json({ expired: expired?.length ?? 0, swept });
}