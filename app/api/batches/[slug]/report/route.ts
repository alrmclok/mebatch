import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { norm } from "@/lib/batch";
import { allow, clientIp, hashOf } from "@/lib/ratelimit";

const REPORT_LIMIT = 10;
type Ctx = { params: Promise<{ slug: string }> };
const dev = (id: unknown) => (typeof id === "string" && id ? hashOf("dev:" + id) : null);
const limited = () => NextResponse.json({ error: "rate_limited" }, { status: 429 });

export async function GET(req: Request, { params }: Ctx) {
  if (!(await allow(req, "rstatus", 60, 60))) return limited();
  const slug = norm((await params).slug);
  const d = dev(new URL(req.url).searchParams.get("deviceId"));
  if (!d) return NextResponse.json({ reported: false });
  const { data } = await db.from("reports").select("slug").eq("slug", slug).eq("voter_hash", d).maybeSingle();
  return NextResponse.json({ reported: !!data });
}

export async function POST(req: Request, { params }: Ctx) {
  if (!(await allow(req, "report", 10, 3600))) return limited();
  const slug = norm((await params).slug);
  const { deviceId } = await req.json().catch(() => ({}));
  const hashes = [hashOf("ip:" + clientIp(req))];
  const d = dev(deviceId);
  if (d) hashes.push(d);
  const { data } = await db.rpc("report_batch", { p_slug: slug, p_hashes: hashes, p_limit: REPORT_LIMIT });
  return NextResponse.json({ ok: true, duplicate: data === -1, removed: data >= REPORT_LIMIT });
}

export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await allow(req, "report", 10, 3600))) return limited();
  const slug = norm((await params).slug);
  const { deviceId } = await req.json().catch(() => ({}));
  const d = dev(deviceId);
  if (d) await db.rpc("unreport_batch", { p_slug: slug, p_dev: d, p_ip: hashOf("ip:" + clientIp(req)) });
  return NextResponse.json({ ok: true });
}