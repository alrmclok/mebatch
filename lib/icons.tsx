import {
  File, FileText, FileImage, FileArchive, FileAudio, FileVideo, FileCode, FileSpreadsheet,
  Type, Files, type LucideIcon,
} from "lucide-react";

// Pick an icon + orb color from the file name / mime type
const RULES: [RegExp, LucideIcon, string][] = [
  [/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i, FileImage, "bg-pink-300"],
  [/\.(zip|rar|7z|tar|gz)$/i, FileArchive, "bg-amber-300"],
  [/\.(mp3|wav|ogg|flac|m4a)$/i, FileAudio, "bg-violet-400"],
  [/\.(mp4|mov|webm|mkv|avi)$/i, FileVideo, "bg-red-400"],
  [/\.(js|ts|tsx|jsx|py|lua|json|html|css|cs|cpp|java|sh)$/i, FileCode, "bg-teal-300"],
  [/\.(csv|xls|xlsx|ods)$/i, FileSpreadsheet, "bg-green-400"],
  [/\.(txt|md|pdf|doc|docx|rtf)$/i, FileText, "bg-sky-300"],
];

export function fileIcon(name: string, mime?: string | null): { Icon: LucideIcon; color: string } {
  for (const [re, Icon, color] of RULES) if (re.test(name)) return { Icon, color };
  if (mime?.startsWith("image/")) return { Icon: FileImage, color: "bg-pink-300" };
  return { Icon: File, color: "bg-slate-300" }; // fallback
}

// Send-tab mode toggle
export const MODE_ICON = {
  text: { Icon: Type, color: "bg-sky-300" },
  file: { Icon: File, color: "bg-amber-300" },
  both: { Icon: Files, color: "bg-green-400" },
} as const;

// Glossy orb with a dark "silhouette" icon inside
export function Orb({ icon: Icon, color = "bg-sky-300", size = 64 }: { icon: LucideIcon; color?: string; size?: number }) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ring-1 ring-black/20 shadow-[inset_0_-6px_10px_rgba(0,0,0,.18),0_3px_5px_rgba(0,0,0,.25)] ${color}`}
      style={{ width: size, height: size }}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(255,255,255,.85),transparent_55%)]" />
      <Icon className="relative text-slate-800/75" size={size * 0.5} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2} aria-hidden />
    </span>
  );
}