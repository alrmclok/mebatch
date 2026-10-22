"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import FileThumb from "@/components/FileThumb";
import CopyButton from "@/components/CopyButton";
import IntroPopup, { replayIntro } from "@/components/IntroPopup";
import {
  Upload,
  Download,
  Copy,
  X,
  RotateCcw,
  KeyRound,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Window from "@/components/Window";
import { Orb, fileIcon, MODE_ICON } from "@/lib/icons";
import { fmtSize, timeLeft } from "@/lib/format";
import { uploadFile } from "@/lib/upload";
import {
  createBatch,
  textToFile,
  saveOwner,
  getOwner,
  ownedSlugs,
  forgetOwner,
  type Item,
} from "@/lib/client";
import AsyncButton from "@/components/AsyncButton";

type Mode = "text" | "file" | "both";
type Job = {
  name: string;
  pct: number;
  state: "wait" | "up" | "done" | "err";
  cancel?: () => void;
};
type ActiveItem = {
  slug: string;
  expiresAt: string;
  name: string;
  isText: boolean;
};
const LABEL: Record<Mode, string> = {
  text: "Only text",
  file: "Only file",
  both: "Both",
};
const PAGE = 6;

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"send" | "receive">("send");
  const [mode, setMode] = useState<Mode>("both");
  const [text, setText] = useState("");
  const [convert, setConvert] = useState(false);
  const [fname, setFname] = useState("note");
  const [fext, setFext] = useState("txt");
  const [files, setFiles] = useState<File[]>([]);
  const [slugFormat, setSlugFormat] = useState<"words" | "chars">("words");
  const [expiryHours, setExpiryHours] = useState(24);
  const [burn, setBurn] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ slug: string; key: string } | null>(null);
  const [code, setCode] = useState("");
  const [active, setActive] = useState<ActiveItem[]>([]);
  const [pg, setPg] = useState(0);
  const [drag, setDrag] = useState(false);
  const pending = useRef<{
    slug: string;
    key: string;
    urls: string[];
    files: File[];
  } | null>(null);

  const showText = mode !== "file";
  const showFiles = mode !== "text";

  // drag anywhere + paste anywhere
  useEffect(() => {
    const add = (l: FileList | File[]) => {
      const arr = Array.from(l); // copy now, the browser empties the list after the event
      setMode((m) => (m === "text" ? "both" : m));
      setFiles((f) => [...f, ...arr]);
    };
    const over = (e: DragEvent) => {
      e.preventDefault();
      setDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDrag(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (e.dataTransfer?.files.length) {
        setTab("send");
        add(e.dataTransfer.files);
      }
    };
    const paste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) add(e.clipboardData.files);
    };
    addEventListener("dragover", over);
    addEventListener("dragleave", leave);
    addEventListener("drop", drop);
    addEventListener("paste", paste);
    return () => {
      removeEventListener("dragover", over);
      removeEventListener("dragleave", leave);
      removeEventListener("drop", drop);
      removeEventListener("paste", paste);
    };
  }, []);

  // Active Batch = batches whose owner token is on this device
  useEffect(() => {
    (async () => {
      const out: ActiveItem[] = [];
      for (const slug of ownedSlugs()) {
        const r = await fetch(`/api/batches/${slug}`, {
          headers: { "x-owner-key": getOwner(slug) ?? "" },
        });
        if (r.ok) {
          const b = await r.json();
          out.push({
            slug,
            expiresAt: b.expiresAt,
            name: b.files[0]?.name ?? "",
            isText: !b.files.length,
          });
        } else if (r.status === 404) {
          forgetOwner(slug); // expired, burned, or deleted: drop the stale token
        }
      }
      setActive(out);
    })();
  }, [done]);

  // success screen once every upload is done (also covers retries)
  useEffect(() => {
    if (
      jobs.length &&
      pending.current &&
      jobs.every((j) => j.state === "done")
    ) {
      const t = setTimeout(
        () =>
          setDone({ slug: pending.current!.slug, key: pending.current!.key }),
        800,
      );
      return () => clearTimeout(t);
    }
  }, [jobs]);

  const setJob = (i: number, p: Partial<Job>) =>
    setJobs((j) => j.map((x, k) => (k === i ? { ...x, ...p } : x)));

  function run(i: number, file: File, url: string) {
    setJob(i, { state: "up", pct: 0 });
    const { promise, cancel } = uploadFile(url, file, (pct) =>
      setJob(i, { pct }),
    );
    setJob(i, { cancel });
    return promise
      .then(() => setJob(i, { state: "done", pct: 100 }))
      .catch(() => setJob(i, { state: "err" }));
  }

  async function send() {
    setError("");
    const hasText = showText && text.trim().length > 0;
    const items: Item[] = showFiles ? files.map((file) => ({ file })) : [];
    if (hasText && convert)
      items.push({
        file: textToFile(text, fname || "note", fext || "txt"),
        converted: true,
      });
    const rawText = hasText && !convert;
    if (!items.length && !rawText)
      return setError("Add some text or a file first");

    setBusy(true);
    try {
      const m: Mode =
        items.length && rawText ? "both" : items.length ? "file" : "text";
      const res = await createBatch(
        {
          mode: m,
          text: rawText ? text : undefined,
          slugFormat,
          expiryHours,
          burn,
        },
        items,
      );
      saveOwner(res.slug, res.ownerToken);
      const fl = items.map((i) => i.file);
      pending.current = {
        slug: res.slug,
        key: res.ownerToken,
        urls: res.uploads.map((u) => u.url),
        files: fl,
      };
      if (!fl.length) {
        setDone({ slug: res.slug, key: res.ownerToken });
      } else {
        setJobs(fl.map((f) => ({ name: f.name, pct: 0, state: "wait" })));
        await Promise.all(fl.map((f, i) => run(i, f, res.uploads[i].url)));
      }
    } catch (e: any) {
      setError(e.message);
    }
    setBusy(false);
  }

  const reset = () => {
    pending.current = null;
    setDone(null);
    setJobs([]);
    setFiles([]);
    setText("");
    setError("");
  };
  const link = (s: string) => `${location.origin}/${s}`;
  const copy = (s: string) => navigator.clipboard.writeText(s);
  const go = () =>
    code.trim() &&
    router.push("/" + encodeURIComponent(code.trim().toLowerCase()));
  const pages = Math.ceil(active.length / PAGE);

  return (
    <Window>
      {drag && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-teal-600/80 text-2xl font-extrabold text-white">
          Drop files to add them
        </div>
      )}
      <IntroPopup />

      <div className="flex justify-center items-start gap-3 pb-1">
        <button
          className={`btn btn-green flex-1 sm:flex-none ${tab !== "send" ? "dim" : ""}`}
          onClick={() => setTab("send")}
        >
          <Upload size={20} /> Send
        </button>
        <button
          className={`btn btn-cyan flex-1 sm:flex-none ${tab !== "receive" ? "dim" : ""}`}
          onClick={() => setTab("receive")}
        >
          <Download size={20} /> Receive
        </button>
      </div>
      <p className="text-center text-sm opacity-60">
        [mascot: {tab === "send" ? "tossing a file" : "catching a file"}]
      </p>

      {tab === "receive" && (
        <div className="space-y-3">
          <input
            className="field text-center text-2xl font-bold tracking-widest"
            placeholder="happy-lime-cloud"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            aria-label="Batch code"
          />
          <button className="btn btn-cyan w-full" onClick={go}>
            Go
          </button>
        </div>
      )}

      {tab === "send" && !done && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["text", "file", "both"] as Mode[]).map((m) => {
              const { Icon, color } = MODE_ICON[m];
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`flex min-h-11 flex-col items-center gap-1 rounded-2xl p-2 ${mode === m ? "bg-[#e3e0f5] ring-2 ring-[#8f8aae]" : "opacity-70"}`}
                >
                  <Orb icon={Icon} color={color} size={52} wobble />
                  <span className="text-xs font-bold sm:text-sm">
                    {LABEL[m]}
                  </span>
                </button>
              );
            })}
          </div>

          {showText && (
            <div className="space-y-2">
              <textarea
                className="field"
                rows={5}
                placeholder="Paste or type text…"
                value={text}
                maxLength={100000}
                onChange={(e) => setText(e.target.value)}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={convert}
                  onChange={(e) => setConvert(e.target.checked)}
                />{" "}
                Convert text to file after sending
              </label>
              {convert && (
                <div className="flex items-center gap-2">
                  <input
                    className="field"
                    value={fname}
                    onChange={(e) => setFname(e.target.value)}
                    aria-label="File name"
                    placeholder="file name"
                  />
                  <span>.</span>
                  <input
                    className="field !w-24"
                    value={fext}
                    onChange={(e) => setFext(e.target.value)}
                    aria-label="Extension"
                    placeholder="txt"
                  />
                </div>
              )}
            </div>
          )}

          {showFiles && (
            <label className="block cursor-pointer rounded-2xl border-[3px] border-dashed border-[var(--lav)] bg-white p-5 sm:p-7 text-center font-semibold">
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const arr = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  setFiles((f) => [...f, ...arr]);
                }}
              />
              <span className="hidden sm:inline">Drop, paste, or click</span>
              <span className="sm:hidden">Tap</span> to add files
            </label>
          )}

          {!jobs.length &&
            showFiles &&
            files.map((f, i) => {
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm"
                >
                  <FileThumb file={f} size={44} />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-sm opacity-70">{fmtSize(f.size)}</span>
                  <button
                    className="btn !min-h-9 !px-3"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((_, k) => k !== i))}
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          {jobs.map((j, i) => {
            const f = pending.current?.files[i];
            const { Icon, color } = fileIcon(j.name);
            return (
              <div
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-white p-2 shadow-sm"
              >
                {f ? (
                  <FileThumb file={f} size={44} />
                ) : (
                  <Orb icon={Icon} color={color} size={44} wobble />
                )}
                <span className="min-w-0 flex-1 truncate">{j.name}</span>
                <span className="text-xs tabular-nums">{j.pct}%</span>
                {j.state === "up" && (
                  <button
                    className="btn !min-h-9 !px-3"
                    onClick={() => j.cancel?.()}
                  >
                    Cancel
                  </button>
                )}
                {j.state === "err" && (
                  <button
                    className="btn btn-yellow !min-h-9 !px-3"
                    onClick={() =>
                      run(
                        i,
                        pending.current!.files[i],
                        pending.current!.urls[i],
                      )
                    }
                  >
                    <RotateCcw size={16} /> Retry
                  </button>
                )}
                {j.state === "done" && <span aria-label="done">✔</span>}
                <progress
                  className="h-3 w-full accent-[#2aa9bf]"
                  value={j.pct}
                  max={100}
                />
              </div>
            );
          })}

          <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
            <label className="flex items-center justify-between gap-2">
              Code
              <select
                className="field !w-auto"
                value={slugFormat}
                onChange={(e) => setSlugFormat(e.target.value as any)}
              >
                <option value="words">3 words</option>
                <option value="chars">5 characters</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              Expires
              <select
                className="field !w-auto"
                value={expiryHours}
                onChange={(e) => setExpiryHours(+e.target.value)}
              >
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-2">
              <input
                type="checkbox"
                checked={burn}
                onChange={(e) => setBurn(e.target.checked)}
              />{" "}
              Burn after reading
            </label>
          </div>
          {slugFormat === "chars" && (
            <p className="text-sm opacity-75">
              ⚠ Short codes are easier to guess. Skip them for private stuff.
            </p>
          )}
          {error && (
            <p role="alert" className="font-bold text-red-700">
              {error}
            </p>
          )}
          <AsyncButton
            className="btn-green w-full"
            icon={<Upload size={20} />}
            onClick={send}
          >
            {busy ? "Sending…" : "Send"}
          </AsyncButton>
        </div>
      )}

      {tab === "send" && done && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm opacity-60">[mascot: celebrating]</p>
          <div className="break-all text-2xl sm:text-3xl font-black tracking-widest">
            {done.slug}
          </div>
          <QRCodeSVG value={link(done.slug)} size={140} />
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton text={() => link(done.slug)} />
            <CopyButton
              text={() => `${link(done.slug)}?key=${done.key}`}
              label="Copy manage link"
              className="btn-yellow"
              icon={<KeyRound size={18} />}
            />
          </div>
          <p className="text-sm opacity-70">
            Save the manage link if you want to delete this later from another
            device.
          </p>
          <button className="btn" onClick={reset}>
            Send another
          </button>
        </div>
      )}

      <section className="panel">
        <h2 className="mb-3 text-lg font-extrabold">Active Batch</h2>
        {active.length === 0 ? (
          <p className="text-center text-sm opacity-70">
            [mascot: dancing] Nothing here yet
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {pages > 1 && (
              <button
                className="btn !h-10 !w-10 !p-0 shrink-0"
                aria-label="Previous"
                disabled={pg === 0}
                onClick={() => setPg(pg - 1)}
              >
                <ChevronLeft />
              </button>
            )}
            <div className="grid flex-1 grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:grid-cols-6">
              {active.slice(pg * PAGE, pg * PAGE + PAGE).map((b) => {
                const { Icon, color } = b.isText
                  ? MODE_ICON.text
                  : fileIcon(b.name);
                return (
                  <a
                    key={b.slug}
                    href={`/${b.slug}`}
                    className="flex flex-col items-center gap-1 text-center"
                  >
                    <Orb icon={Icon} color={color} size={56} wobble />
                    <span className="break-all text-xs font-bold">
                      {b.slug}
                    </span>
                    <span className="text-[11px] opacity-70">
                      {timeLeft(b.expiresAt)}
                    </span>
                  </a>
                );
              })}
            </div>
            {pages > 1 && (
              <button
                className="btn !h-10 !w-10 !p-0 shrink-0"
                aria-label="Next"
                disabled={pg >= pages - 1}
                onClick={() => setPg(pg + 1)}
              >
                <ChevronRight />
              </button>
            )}
          </div>
        )}
      </section>
      <p className="text-xs opacity-80">
        Fan project, not affiliated with Inanimate Insanity.{" "}
        <button type="button" onClick={replayIntro} className="underline">
          Replay intro
        </button>
      </p>
    </Window>
  );
}
