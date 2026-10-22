"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Window from "@/components/Window";
import BatchCard, { type BatchData } from "@/components/BatchCard";
import { getOwner, saveOwner } from "@/lib/client";

export default function BatchView({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, setState] = useState<"load" | "missing" | "limited" | BatchData>("load");

  useEffect(() => {
    (async () => {
      const key = new URLSearchParams(location.search).get("key"); // manage link restores delete access
      if (key) { saveOwner(slug, key); history.replaceState(null, "", `/${slug}`); }
      const r = await fetch(`/api/batches/${slug}`, { headers: { "x-owner-key": getOwner(slug) ?? "" } });
      setState(r.ok ? await r.json() : r.status === 429 ? "limited" : "missing");
    })();
  }, [slug]);

  return (
    <Window>
      {state === "load" && <p className="text-center">Looking for it…</p>}
      {state === "limited" && <p className="text-center font-bold">Too many tries. Give it a minute and refresh.</p>}
      {state === "missing" && (
        <div className="space-y-3 text-center">
          <p className="text-sm opacity-60">[mascot: shrugging]</p>
          <p className="text-xl font-extrabold">Couldn't find “{slug}”</p>
          <p>It might be expired, deleted, already burned, or there's a typo in the code.</p>
          <Link href="/" className="btn btn-cyan">Back home</Link>
        </div>
      )}
      {typeof state === "object" && <BatchCard b={state} onDeleted={() => router.push("/")} />}
    </Window>
  );
}