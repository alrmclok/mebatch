import { createHash } from "crypto";
import { db } from "./supabase";

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
export const hashOf = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export async function allow(req: Request, bucket: string, max: number, secs: number) {
  const { data } = await db.rpc("rate_hit", {
    p_key: `${bucket}:${hashOf(clientIp(req))}`, p_max: max, p_secs: secs,
  });
  return data !== false; // fail open if the db call errors
}