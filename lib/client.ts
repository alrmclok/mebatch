type Meta = { mode: "text" | "file" | "both"; text?: string; slugFormat: "words" | "chars";
              expiryHours: number; burn: boolean };
export type Item = { file: File; converted?: boolean };

export async function createBatch(meta: Meta, items: Item[]) {
  const res = await fetch("/api/batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...meta,
      files: items.map((i) => ({ name: i.file.name, size: i.file.size, type: i.file.type, converted: i.converted })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data as { slug: string; ownerToken: string; uploads: { name: string; path: string; url: string }[] };
}

// converted text -> File ("Convert text to file" switch)
export const textToFile = (text: string, name: string, ext: string) =>
  new File([text], `${name}.${ext.replace(/^\./, "")}`, { type: "text/plain" });

// localStorage (always try/catch)
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

export const saveOwner = (slug: string, token: string) => set(`mebatch_owner_${slug}`, token);
export const getOwner = (slug: string) => get(`mebatch_owner_${slug}`);
export const deviceId = () => get("mebatch_device") ?? (() => { const id = crypto.randomUUID(); set("mebatch_device", id); return id; })();
export const introSeen = () => get("mebatch_intro_seen") === "1";
export const markIntroSeen = () => set("mebatch_intro_seen", "1");

// Active Batch = every slug that has an owner token on this device
export function ownedSlugs(): string[] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith("mebatch_owner_")).map((k) => k.slice(14));
  } catch { return []; }
}

export const forgetOwner = (slug: string) => {
  try { localStorage.removeItem(`mebatch_owner_${slug}`); } catch {}
};