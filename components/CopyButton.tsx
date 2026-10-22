"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyButton({
  text, label = "Copy link", className = "btn-cyan", icon,
}: {
  text: string | (() => string); // function form reads location at click time
  label?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      setState("ok");
    } catch { setState("err"); }
    clearTimeout(t.current);
    t.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" onClick={copy} className={`btn ${state === "ok" ? "btn-green" : className}`}>
      {state === "ok" ? <Check size={18} /> : icon ?? <Copy size={18} />}
      <span aria-live="polite">{state === "ok" ? "Copied!" : state === "err" ? "Couldn't copy" : label}</span>
    </button>
  );
}