"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick: () => Promise<unknown> | unknown;
  icon?: React.ReactNode;
};

export default function AsyncButton({ onClick, icon, children, className = "", disabled, ...rest }: Props) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      {...rest}
      className={`btn ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={async () => { setLoading(true); try { await onClick(); } finally { setLoading(false); } }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}