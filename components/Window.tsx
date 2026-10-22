"use client";
import { useState } from "react";
import Link from "next/link";

function Dot({ c, label, onClick, className = "" }: { c: string; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`h-8 w-8 place-items-center rounded-full ${className || "grid"}`}>
      <span className={`h-4 w-4 rounded-full ring-1 ring-black/25 shadow-[inset_0_2px_2px_rgba(255,255,255,.7)] ${c}`} />
    </button>
  );
}

export default function Window({ children }: { children: React.ReactNode }) {
  const [min, setMin] = useState(false);
  const [max, setMax] = useState(false);
  return (
    <main className="flex min-h-screen justify-center px-2 py-3 sm:px-3 sm:py-6">
      <div className={`h-fit w-full rounded-[22px] bg-[linear-gradient(#dcd8ef,#a9a4c8)] p-2 shadow-[0_6px_0_#8480a6,0_14px_26px_rgba(0,0,0,.35),inset_0_2px_0_#fff] transition-[max-width] sm:rounded-[28px] sm:p-3 ${max ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="overflow-hidden rounded-xl bg-[var(--pearl)] shadow-[inset_0_2px_8px_rgba(0,0,0,.25)]">
          <header className="relative flex items-center justify-center border-b-2 border-[#b6c3ea] px-2 py-2 sm:py-3">
            <span className="absolute left-0 top-1/2 flex -translate-y-1/2 sm:left-2">
              <Dot c="bg-red-500" label="Home" onClick={() => location.assign("/")} />
              <Dot c="bg-yellow-400" label={min ? "Restore" : "Minimize"} onClick={() => setMin(!min)} />
              <Dot c="bg-green-500" label={max ? "Shrink" : "Maximize"} onClick={() => setMax(!max)} className="hidden sm:grid" />
            </span>
            <Link href="/" className="logo text-2xl sm:text-3xl">MeBatch<sup className="text-xs">™</sup></Link>
          </header>
          {/* hidden (not unmounted) so uploads and state survive minimizing */}
          <div className={min ? "hidden" : "space-y-4 p-3 sm:p-4"}>{children}</div>
        </div>
      </div>
    </main>
  );
}