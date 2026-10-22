"use client";
import { useEffect, useState } from "react";

const KEY = "mebatch_intro_seen";

// pose = which mascot art goes here later (swap the placeholder box for an <img>)
const STEPS = [
  {
    pose: "waving",
    text: "Hi! I'm MeBatch.",
    description: "Your personal helper friend. /j",
  },
  {
    pose: "tossing a file",
    text: "Toss files or text, get a code.",
    description: "No account, no signup. Just drop it in and hit Send.",
  },
  {
    pose: "pointing",
    text: "Share the code or the QR.",
    description: "Type the code on another device, or scan the QR.",
  },
  {
    pose: "clock",
    text: "Everything expires on its own.",
    description:
      "Pick 1 hour to 7 days. You can also burn it after the first download.",
  },
  {
    pose: "celebrating",
    text: "Ready?",
    description: "Your first batch is one tap away!",
  },
];

/** Call from a "Replay intro" button/link anywhere. */
export function replayIntro() {
  window.dispatchEvent(new Event("mebatch:intro"));
}

export default function IntroPopup() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setOpen(true);
    } catch {}
    const replay = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("mebatch:intro", replay);
    return () => window.removeEventListener("mebatch:intro", replay);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to MeBatch"
    >
      <div className="w-full max-w-sm rounded-[24px] bg-[#b9b5cf] p-2 shadow-[0_0_0_3px_#8f8ba9,inset_0_0_0_2px_#e4e1f2,0_14px_26px_rgba(0,0,0,.4)]">
        <div className="space-y-3 rounded-xl bg-[#f7f6fd] p-4 text-center shadow-[inset_0_2px_8px_rgba(0,0,0,.25)]">
          {/* mascot placeholder */}
          <div className="grid h-36 place-items-center rounded-xl border-2 border-dashed border-[#b6c3ea] text-sm text-[#6b6f8a]">
            [mascot: {s.pose}]
          </div>
          <div aria-live="polite">
            <p className="text-lg font-bold">{s.text}</p>
            <p className="mt-1 text-sm opacity-70">{s.description}</p>
          </div>
          <div className="flex justify-center gap-1.5" aria-hidden>
            {STEPS.map((_, n) => (
              <span
                key={n}
                className={`h-2.5 w-2.5 rounded-full ${n === i ? "bg-[#6a4cff]" : "bg-[#cfcbe6]"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            {last ? (
              <span />
            ) : (
              <button
                type="button"
                onClick={close}
                className="px-2 text-sm underline"
              >
                Skip
              </button>
            )}
            <div className="flex gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI(i - 1)}
                  className="btn btn-yellow"
                >
                  Back
                </button>
              )}
              <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="btn btn-green" autoFocus>
                {last ? "Let's go" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
