# MeBatch

Share text or files between devices with **no account**. Sender gets a short code (`happy-lime-cloud` or `k7m2x`), receiver types it in or scans the QR. Everything expires on its own.

Name is a nod to MePhone from Inanimate Insanity. The UI is styled after the **MeLife** screen from the same show (framed window, glossy orbs, teal backdrop).

- **Stack:** Next.js 16 (App Router, Turbopack) on Vercel, Supabase (Postgres + private Storage bucket), Tailwind CSS v4, `lucide-react`, `qrcode.react`, `fflate`
- **Scope rule:** small project. No accounts, no analytics, no extra services.
- **Mascot:** black silhouette of an animated object, still **placeholders** (`[mascot: ...]` text). Poses: Send = tossing a file, Receive = catching, empty Active Batch = dancing, not found = shrugging, send success = celebrating.

> **Using this README in a new chat:** paste it, then attach only the files you want changed (for example `components/BatchCard.tsx`). Ask for edits in "change this -> to this" form. Replies should stay token-lean but decent quality.

---

## 1. How it works

1. Browser calls `POST /api/batches` with metadata + file list. Server validates, creates the batch, returns a **slug**, an **owner token**, and a **signed upload URL per file**.
2. Browser uploads each file **directly to Supabase Storage** (XHR PUT, so progress/cancel/retry work). Vercel's 4.5 MB body limit never applies.
3. Receiver opens `/<slug>` -> `GET /api/batches/<slug>` returns metadata (no file URLs). Downloads/previews call `POST /api/batches/<slug>/download`, which returns **60-second signed URLs**.
4. Owner token is stored in `localStorage`; only its SHA-256 hash is stored on the server.
5. A daily Vercel cron deletes expired batches + their files, sweeps orphaned storage folders, and keeps the free Supabase project awake.

All DB access goes through route handlers using the **service role key** (RLS is on, with **no policies**, so the anon key can't read anything).

---

## 2. Setup

### Env vars (`.env.local` and Vercel project settings)
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # service_role / "secret" key. NEVER prefix with NEXT_PUBLIC_
CRON_SECRET=...                 # any long random string
```
Restart `npm run dev` after editing `.env.local`.

### Packages
```
npm i @supabase/supabase-js qrcode.react lucide-react fflate
```

### Supabase
1. **Storage:** create a **private** bucket named exactly `batches`.
2. **SQL Editor:** run the SQL below once.

```sql
create table batches (
  slug text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  slug_format text not null check (slug_format in ('words','chars')),
  mode text not null check (mode in ('text','file','both')),
  text_content text,
  owner_hash text not null,
  burn_after_reading boolean not null default false,
  report_count int not null default 0,
  total_bytes bigint not null default 0
);

create table batch_files (
  id uuid primary key default gen_random_uuid(),
  slug text not null references batches(slug) on delete cascade,
  storage_path text not null,
  name text not null,
  size bigint not null check (size > 0),
  mime_type text,
  is_converted_text boolean not null default false
);

create table reports (
  slug text not null references batches(slug) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (slug, voter_hash)
);

create index on batches (expires_at);
create index on batch_files (slug);

alter table batches enable row level security;
alter table batch_files enable row level security;
alter table reports enable row level security;
-- no policies on purpose: only the service role key can touch these

create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table rate_limits enable row level security;

-- true = allowed, false = blocked
create function rate_hit(p_key text, p_max int, p_secs int) returns boolean
language plpgsql as $$
declare h int;
begin
  insert into rate_limits as r (key, hits) values (p_key, 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_secs) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_secs) then now() else r.window_start end
  returning hits into h;
  return h <= p_max;
end $$;

-- returns new report count, or -1 if already reported. Deletes the batch at p_limit.
create function report_batch(p_slug text, p_hashes text[], p_limit int) returns int
language plpgsql as $$
declare c int;
begin
  if exists (select 1 from reports where slug = p_slug and voter_hash = any(p_hashes)) then
    return -1;
  end if;
  insert into reports (slug, voter_hash) select p_slug, unnest(p_hashes) on conflict do nothing;
  update batches set report_count = report_count + 1 where slug = p_slug returning report_count into c;
  if c >= p_limit then delete from batches where slug = p_slug; end if;
  return coalesce(c, 0);
end $$;

-- undo a report made from this device
create function unreport_batch(p_slug text, p_dev text, p_ip text) returns boolean
language plpgsql as $$
begin
  if not exists (select 1 from reports where slug = p_slug and voter_hash = p_dev) then
    return false;
  end if;
  delete from reports where slug = p_slug and voter_hash in (p_dev, p_ip);
  update batches set report_count = greatest(report_count - 1, 0) where slug = p_slug;
  return true;
end $$;
```

### Cron
`vercel.json` in the project root (same folder as `package.json`):
```json
{ "crons": [{ "path": "/api/cron", "schedule": "0 3 * * *" }] }
```
Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. Cron only runs on the deployed site. Local test:
`curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/cron` -> `{"expired":0,"swept":0}`.

---

## 3. File map

```
app/
  layout.tsx                      fonts: Nunito (body), Playfair Display italic 700 (logo)
  globals.css                     Tailwind v4 import + theme classes (see section 6)
  page.tsx                        Home: Send/Receive tabs, Active Batch
  [slug]/page.tsx                 server wrapper: Suspense + await params -> <BatchView/>
  [slug]/BatchView.tsx            client: fetch batch, render BatchCard / not-found
  api/batches/route.ts            POST create
  api/batches/[slug]/route.ts     GET lookup, DELETE (owner)
  api/batches/[slug]/download/route.ts   POST signed URLs (+preview, burn)
  api/batches/[slug]/report/route.ts     GET status, POST report, DELETE unreport
  api/cron/route.ts               daily cleanup
components/
  Window.tsx                      framed window + traffic-light buttons
  AsyncButton.tsx                 button that spins + locks while its action runs
  BatchCard.tsx                   one batch (used on /[slug])
  FileThumb.tsx                   local thumbnail for queued files (image/video first frame)
lib/
  supabase.ts                     service-role client `db`
  slug.ts                         makeSlug("words" | "chars")
  batch.ts                        norm, hashKey, getLive, isOwner
  ratelimit.ts                    allow(), clientIp(), hashOf()
  upload.ts                       uploadFile(url, file, onProgress) -> {promise, cancel}
  client.ts                       createBatch, textToFile, owner/device helpers, intro flag
  format.ts                       fmtSize, timeLeft
  icons.tsx                       fileIcon(), MODE_ICON, <Orb/>
vercel.json
```

### lib contracts
- `getLive(slug)` -> batch row or `null` (checks `expires_at > now`). Slugs are normalised lowercase via `norm()`.
- `isOwner(batch, req)` compares `sha256(x-owner-key header)` to `owner_hash`.
- `allow(req, bucket, max, secs)` -> `boolean`; keyed by hashed IP; **fails open** if the DB call errors.
- `uploadFile(url, file, onProgress)` -> XHR `PUT` with `FormData` (`cacheControl`, and the file under an **empty field name**, which Supabase expects).
- `createBatch(meta, items)` -> `{ slug, ownerToken, uploads: [{ name, path, url }] }` (same order as `items`).
- `textToFile(text, name, ext)` -> `File` (`text/plain`).
- localStorage keys: `mebatch_owner_<slug>` (owner token), `mebatch_device` (random uuid for reports), `mebatch_intro_seen` (`"1"` after first-visit popup). Always wrap storage in try/catch.
- `ownedSlugs()` lists slugs that have an owner token on this device; `forgetOwner(slug)` removes a stale token.

---

## 4. API reference

| Route | Body / headers | Success | Errors |
|---|---|---|---|
| `POST /api/batches` | `{mode, text?, slugFormat, expiryHours, burn, files:[{name,size,type,converted}]}` | `{slug, ownerToken, uploads:[{name,path,url}]}` | 400 validation, 429 rate limit (10/hr), 503 storage full, 500 |
| `GET /api/batches/[slug]` | optional `x-owner-key` | `{slug, mode, text, expiresAt, burn, files:[{id,name,size,mime_type,is_converted_text}], isOwner}` | 404 `not_found`, 429 (30/min) |
| `DELETE /api/batches/[slug]` | `x-owner-key` | `{ok:true}` (removes storage files, cascades rows) | 403, 404 |
| `POST /api/batches/[slug]/download` | `{ids?: string[], preview?: boolean}` | `{urls:[{id,name,url}]}` (60 s signed URLs) | 404, **410 `gone`** (already burned), 400 `not_previewable`, 429 (60/min) |
| `GET /api/batches/[slug]/report?deviceId=` | | `{reported}` | 429 |
| `POST /api/batches/[slug]/report` | `{deviceId}` | `{ok, duplicate, removed}` | 429 (10/hr shared bucket) |
| `DELETE /api/batches/[slug]/report` | `{deviceId}` | `{ok}` | 429 |
| `GET /api/cron` | `Authorization: Bearer $CRON_SECRET` | `{expired, swept}` | 401 |

Server-enforced rules (also checked in the browser where practical):
- Max **20 MB** per file, **50 MB** per batch, **10 files**, file size > 0, names sanitised (no `/ \ ..`, 100 chars), text <= 100,000 chars.
- Expiry options: 1 h / **24 h (default)** / 3 d / 7 d.
- Global storage guard: reject new batches (503) when stored bytes + new > ~850 MB.
- Slug collision (`23505`) retries up to 5 times.
- If any file is a **converted text file**, `text_content` is stored as `null` (the text lives in the file).
- **Burn after reading:** first non-preview download (single file or zip) sets `expires_at = now()` with an atomic conditional update; later callers get 410. Files stay in Storage until cron removes them. **Previews never burn.**
- **Previews:** images <= 5 MB (png/jpeg/gif/webp) and videos (mp4/webm/quicktime). Anything else -> 400.
- **Reports:** 10 reports (`REPORT_LIMIT` in the report route) deletes the batch. One report per device hash and per IP hash per batch. Unreport only works while the batch still exists.

---

## 5. Pages and behavior

### Home (`app/page.tsx`)
- `Window` frame, **Send | Receive** tabs (equal width on phones), mascot placeholder line, then **Active Batch** panel.
- **Send:** mode toggle (Only text / Only file / Both, orbs), text box, "Convert text to file after sending" (name + extension fields), file drop zone (click, drag-and-drop **anywhere on the page**, paste with Ctrl+V), queue with `FileThumb` previews, per-file progress/cancel/retry, options (slug format, expiry, burn), Send button (`AsyncButton`).
- After a successful upload: big code, QR, **Copy link**, **Copy manage link** (`/<slug>?key=<ownerToken>`), "Send another". The success screen appears 800 ms after every job is done (also after retries).
- **Receive:** one input, Enter or **Go** -> `/<code>`.
- **Active Batch:** built from owner tokens in `localStorage`; each is looked up with `x-owner-key`; 404s call `forgetOwner`. Shown as an orb grid with paging arrows (6 per page).
- 5-character slugs show a "easier to guess" warning.

### `/[slug]`
- `app/[slug]/page.tsx` is a **server** component: `<Suspense>` around an inner async component that `await`s `params` (required by Next 16's prerender checks), rendering `<BatchView slug=... />`.
- `BatchView` (client) reads `?key=` once, saves it as the owner token, strips it from the URL, fetches the batch, and shows `BatchCard`, a loading state, a rate-limit message, or a friendly not-found.

### BatchCard
- Header: slug (big), QR, badges (type, file count, time left, burn warning). Accent border color comes from a hash of the slug.
- Raw text: shown in full with **Copy Text**.
- Files: orb icon, name, size, per-file download. Lazy `Preview` (IntersectionObserver): images show inline; videos show a first frame (`preload="metadata"`, `#t=0.1`) with a small **Preview** pill (not a play button, because it isn't playable).
- Actions: **Download .zip** (client-side with `fflate`, files only, includes converted text files, named `<slug>.zip`), **Copy link**, **Delete** (owner only, with `confirm`), **Report** toggle (reported state is filled flag + yellow; tap again to undo).
- Action row is responsive (stacked / 2-column / inline). Messages appear in a `role="status"` line.

### Window (`components/Window.tsx`)
- Red dot -> back to `/` (full reload). Yellow -> minimize/restore (content is hidden, not unmounted, so uploads survive). Green -> widen window; **hidden on phones**.
- Safe on mobile: smaller padding and radius under `sm`.

### AsyncButton
- Wraps any async `onClick`; shows a spinning `Loader2`, disables itself and sets `aria-busy` until the promise settles. Use it for anything that takes time (send, download, zip, delete, report). Instant actions (copy) stay plain buttons.

---

## 6. Visual design (MeLife style)

Reference: the MeLife screen from Inanimate Insanity: thick lavender-gray bezel, white screen, red/yellow/green dots top-left, italic serif title, thin blue divider, glossy circular icons with flat silhouettes, large pale circular arrow buttons, teal backdrop with a lighter bottom stripe.

- **Backdrop:** `linear-gradient(#1b8ea6 0, #2aa9bf 82%, #8be6ef 82%)`, fixed.
- **Frame:** silver-lavender gradient bezel (`#dcd8ef -> #a9a4c8`) with bevel shadow; inner surface `--pearl` (`#f7f6fd`); title bar separated by a `#b6c3ea` line.
- **Tokens (`:root`):** `--ink:#1f2330`, `--lav:#cfcbe6`, `--pearl:#f7f6fd`.
- **Fonts:** Nunito (UI, via `--font-body`), Playfair Display italic 700 for the logo (`.logo`, via `--font-display`). Share code is large, bold, wide letter-spacing.
- **Classes in `globals.css`:** `.btn` (glossy pill, min height 44 px, inset highlight + hard bottom shadow), color variants `.btn-green .btn-cyan .btn-yellow .btn-red`, `.dim` (inactive tab), `.field` (inputs), `.panel` (inset white panel), `.logo`. `.btn svg { flex-shrink: 0; }` prevents icons collapsing in narrow buttons. A small-screen rule reduces `.btn` padding. `prefers-reduced-motion` disables animation.
- **Orbs (`lib/icons.tsx`):** `<Orb icon color size/>` = colored circle + radial gloss + dark Lucide icon. `fileIcon(name, mime)` picks icon + color by extension (image=pink, archive=amber, audio=violet, video=red, code=teal, sheet=green, text/doc=sky, fallback=slate). `MODE_ICON` = Type / File / Files orbs.
- **Accessibility rules:** never color alone (icon + label always), visible focus ring (`#6a4cff`), 44 px targets where practical, reduced motion respected.
- **Tailwind gotcha:** class names must appear as **full strings** in source (no `` `bg-${c}-300` ``).
- Tailwind v4 is assumed (`@import "tailwindcss";`). For v3 use the three `@tailwind` directives instead.

---

## 7. Known issues / TODO

- **First-visit mascot popup is not built.** Hooks: `{/* TODO: <IntroPopup /> */}` near the top of `page.tsx`, and a "Replay intro" TODO in the footer. Spec: several short dialogue steps (mascot changes pose each step), Next / Back / Skip / "Let's go", remembers via `mebatch_intro_seen`, wrapped in try/catch. Draft lines: "Hi! I'm MeBatch." (waving) / "Toss files or text, get a code." (tossing) / "Share the code or the QR." (pointing) / "Everything expires on its own." (clock) / "Ready?" (celebrating).
- **Mascot art:** placeholders only.
- **Large images (> 5 MB)** show no preview; the spec's "Tap to preview" button is not built.
- **Video previews** cost Supabase egress (browser may fetch more than the first frame). If egress climbs, switch to a tap-to-preview button.
- **Latest `BatchCard` action row uses classes that may not exist:**
  - `xs:` is **not** a default Tailwind breakpoint. Define it in `globals.css` (Tailwind v4): `@theme { --breakpoint-xs: 30rem; }`, otherwise `xs:grid xs:grid-cols-2` does nothing.
  - `col-span-none` is **not** a Tailwind class; use `sm:col-auto` instead.
  - `btn-gray` is **not defined**; add `.btn-gray { background-color: #ddd; }` to `globals.css` or remove it.
- If uploads return 401, add header `apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY` on the XHR (should not normally be needed for signed URLs).
- A failed/abandoned upload leaves its batch row behind until the daily cron cleans it up.
- Out of scope for v1: phone share-sheet, passwords, adding files to an existing batch, dark mode, accounts/analytics.

---

## 8. Conventions for future edits

- Keep it lean; no new services. Prefer Tailwind utilities; put reusable glossy styling in `globals.css`.
- Any slow action uses `AsyncButton` so people see it was pressed.
- When reading files from an `<input>` / `DataTransfer` / clipboard, **copy to an array first** (`Array.from(...)`) before calling `setState`; the browser empties the list right after the event.
- Server code only: `lib/supabase.ts`, `SUPABASE_SERVICE_ROLE_KEY`. Never import them in client components.
- New API routes: add a rate-limit bucket via `allow()`, and use `getLive()` so expired batches are never served.
- Next 16: any component reading `params`/`searchParams`/`useParams` needs a `<Suspense>` boundary (or read `location` inside an effect, as `BatchView` does for `?key=`).
- Free-plan limits (verify in the dashboard): ~1 GB storage, 50 MB max file, ~5 GB egress/month, 500 MB DB; free projects pause after a week of inactivity (the cron keeps it awake).
