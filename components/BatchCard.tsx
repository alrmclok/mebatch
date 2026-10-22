"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { zipSync } from "fflate";
import CopyButton from "./CopyButton";
import {
  Download,
  Trash2,
  Flag,
  Flame,
  Clock,
  FileArchive,
  Eye,
} from "lucide-react";
import { Orb, fileIcon, MODE_ICON } from "@/lib/icons";
import { fmtSize, timeLeft } from "@/lib/format";
import { deviceId, getOwner } from "@/lib/client";
import AsyncButton from "./AsyncButton";

export type BatchData = {
  slug: string;
  mode: "text" | "file" | "both";
  text: string | null;
  expiresAt: string;
  burn: boolean;
  isOwner: boolean;
  files: {
    id: string;
    name: string;
    size: number;
    mime_type: string | null;
    is_converted_text: boolean;
  }[];
};
const IMG = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const VID = ["video/mp4", "video/webm", "video/quicktime"];
const ACCENT = [
  "border-green-400",
  "border-sky-400",
  "border-amber-400",
  "border-pink-400",
  "border-violet-400",
];

async function getUrls(slug: string, ids?: string[], preview?: boolean) {
  const r = await fetch(`/api/batches/${slug}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, preview }),
  });
  if (!r.ok)
    throw new Error(
      r.status === 410
        ? "This batch was already downloaded and burned."
        : "Download failed, try again.",
    );
  return (await r.json()).urls as { id: string; name: string; url: string }[];
}

function Preview({
  slug,
  id,
  name,
  video,
}: {
  slug: string;
  id: string;
  name: string;
  video: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => {
    // lazy: only fetch when scrolled into view
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        getUrls(slug, [id], true)
          .then((u) => setSrc(u[0].url))
          .catch(() => setBad(true));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [slug, id]);
  if (bad) return null;
  return (
    <div ref={ref} className="min-h-4">
      {src &&
        (video ? (
          <div className="relative mt-2 w-fit max-w-full">
            <video
              src={`${src}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              onError={() => setBad(true)}
              className="max-h-52 max-w-full rounded-lg bg-black"
            />
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                <Eye size={12} /> Preview
              </span>
            </span>
          </div>
        ) : (
          <img
            src={src}
            alt={name}
            loading="lazy"
            className="mt-2 max-h-52 max-w-full rounded-lg"
          />
        ))}
    </div>
  );
}

export default function BatchCard({
  b,
  onDeleted,
}: {
  b: BatchData;
  onDeleted: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [reported, setReported] = useState(false);
  useEffect(() => {
    fetch(`/api/batches/${b.slug}/report?deviceId=${deviceId()}`)
      .then((r) => r.json())
      .then((d) => setReported(!!d.reported))
      .catch(() => {});
  }, [b.slug]);
  const accent =
    ACCENT[
      [...b.slug].reduce((s, c) => s + c.charCodeAt(0), 0) % ACCENT.length
    ];
  const url = () => `${location.origin}/${b.slug}`;
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 10000);
  };
  const kind =
    b.mode === "both" ? "Text + files" : b.mode === "text" ? "Text" : "Files";

  async function download(id: string) {
    try {
      const [u] = await getUrls(b.slug, [id]);
      location.href = u.url;
    } catch (e: any) {
      flash(e.message);
    }
  }

  async function zip() {
    try {
      const urls = await getUrls(b.slug);
      const entries: Record<string, Uint8Array> = {};
      for (const u of urls) {
        const buf = new Uint8Array(await (await fetch(u.url)).arrayBuffer());
        entries[u.name in entries ? `${u.id.slice(0, 4)}-${u.name}` : u.name] =
          buf;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([zipSync(entries) as BlobPart], { type: "application/zip" }),
      );
      a.download = `${b.slug}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch (e: any) {
      flash(e.message);
    }
  }

  async function del() {
    if (!confirm("Delete this batch for everyone?")) return;
    const r = await fetch(`/api/batches/${b.slug}`, {
      method: "DELETE",
      headers: { "x-owner-key": getOwner(b.slug) ?? "" },
    });
    r.ok ? onDeleted() : flash("Could not delete");
  }

  async function toggleReport() {
    const r = await fetch(`/api/batches/${b.slug}/report`, {
      method: reported ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: deviceId() }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return flash("Try again later");
    if (d.removed) return onDeleted(); // hit the report limit, batch is gone
    setReported(!reported);
    flash(
      reported
        ? "Report removed"
        : d.duplicate
          ? "Already reported"
          : "Reported. Tap again to undo",
    );
  }

  return (
    <article
      className={`space-y-3 rounded-2xl border-4 bg-white p-4 shadow-[inset_0_2px_6px_rgba(0,0,0,.1)] ${accent}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-all text-2xl sm:text-3xl font-black tracking-widest">
            {b.slug}
          </h2>
          <div className="mt-1 flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-[#e3e0f5] px-3 py-1">{kind}</span>
            <span className="rounded-full bg-[#e3e0f5] px-3 py-1">
              {b.files.length} file(s)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e3e0f5] px-3 py-1">
              <Clock size={14} /> {timeLeft(b.expiresAt)}
            </span>
            {b.burn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-200 px-3 py-1">
                <Flame size={14} /> Burns after first download
              </span>
            )}
          </div>
        </div>
        <QRCodeSVG value={url()} size={88} />
      </div>

      {b.text && (
        <div className="space-y-2">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--pearl)] p-3 font-sans">
            {b.text}
          </pre>
          <CopyButton text={b.text} label="Copy Text" />
        </div>
      )}

      {b.files.map((f) => {
        const isVid = VID.includes(f.mime_type ?? "");
        const { Icon, color } = fileIcon(f.name, f.mime_type);
        const canPreview =
          isVid || (IMG.includes(f.mime_type ?? "") && f.size <= 5 * 1048576);
        return (
          <div key={f.id} className="rounded-xl bg-[var(--pearl)] p-2">
            <div className="flex items-center gap-3">
              <Orb icon={Icon} color={color} size={40} wobble />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {f.name}
              </span>
              <span className="text-sm opacity-70">{fmtSize(f.size)}</span>
              <AsyncButton
                className="btn-green !min-h-10 !px-3"
                aria-label={`Download ${f.name}`}
                icon={<Download size={18} />}
                onClick={() => download(f.id)}
              />
            </div>
            {canPreview && (
              <Preview slug={b.slug} id={f.id} name={f.name} video={isVid} />
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {b.files.length > 0 && (
          <AsyncButton
            className="btn-green col-span-2 sm:col-auto"
            icon={<FileArchive size={18} />}
            onClick={zip}
          >
            Download .zip
          </AsyncButton>
        )}
        <CopyButton text={url} />
        <AsyncButton
          className={reported ? "btn-yellow" : ""}
          aria-pressed={reported}
          icon={<Flag size={18} fill={reported ? "currentColor" : "none"} />}
          onClick={toggleReport}
        >
          {reported ? "Reported (undo)" : "Report"}
        </AsyncButton>
        {b.isOwner && (
          <AsyncButton
            className="btn-red col-span-2 sm:col-auto"
            icon={<Trash2 size={18} />}
            onClick={del}
          >
            Delete
          </AsyncButton>
        )}
      </div>
      {msg && (
        <p role="status" className="text-sm font-bold">
          {msg}
        </p>
      )}
    </article>
  );
}
