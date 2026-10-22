import { createHash } from "crypto";
import { db } from "./supabase";

export const norm = (s: string) => s.toLowerCase().trim();
export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

export async function getLive(slug: string) {
  const { data } = await db.from("batches").select("*").eq("slug", norm(slug))
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  return data;
}

export const isOwner = (b: { owner_hash: string }, req: Request) => {
  const k = req.headers.get("x-owner-key");
  return !!k && hashKey(k) === b.owner_hash;
};