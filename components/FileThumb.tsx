"use client";
import { useEffect, useState } from "react";
import { Orb, fileIcon } from "@/lib/icons";

export default function FileThumb({ file, size = 44 }: { file: File; size?: number }) {
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  const img = file.type.startsWith("image/");
  const vid = /^video\/(mp4|webm|quicktime)$/.test(file.type);

  useEffect(() => {
    if (!img && !vid) return;
    const u = URL.createObjectURL(file); // local only, nothing is uploaded
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, img, vid]);

  if (!url || bad) {
    const { Icon, color } = fileIcon(file.name, file.type);
    return <Orb icon={Icon} color={color} size={size} wobble />;
  }
  const cls = "shrink-0 rounded-lg bg-black object-cover ring-1 ring-black/20";
  const style = { width: size, height: size };
  return img ? (
    <img src={url} alt="" style={style} className={cls} onError={() => setBad(true)} />
  ) : (
    <video src={`${url}#t=0.1`} preload="metadata" muted playsInline style={style} className={cls} onError={() => setBad(true)} />
  );
}