# Loveboard

Loveboard is a cozy, romantic postcard board for Yassine and Nihal. It is built with plain HTML, CSS, and vanilla JavaScript plus Supabase for realtime data, simple auth, and storage. The UI is mobile-first and thumb-friendly so both of you can swap little notes, photos, doodles, audio snippets, and floating hearts on the go.

## Features
- Password gate that lets only Yassine or Nihal in.
- Mood stickers of the day with realtime updates.
- Surprise mode that softly blurs every postcard until tapped.
- Create Postcard modal with: short note (150 chars), photo upload, doodle canvas, and 15s audio recording.
- Instant syncing of postcards, moods, floating heart reactions, postcard emoji reactions, and comments through Supabase realtime channels + client broadcasts.
- Threaded postcard comments with inline edit/delete controls so you can reply (or tweak) in place.
- Assets (photos, doodles, audio) stored in Supabase Storage and referenced from each postcard.
- Optional push notifications so the other person gets an OS-level alert even when the tab is closed (requires HTTPS + Supabase Edge function).

## Project structure
```
index.html        # Markup and modal skeletons
styles.css        # Romantic mobile-first styles + animations
script.js         # UI interactions, Supabase reads/writes, realtime hooks
supabase.js       # Supabase client initialization (fill in your keys)
assets/           # Paper texture, icons
```

## Local setup
1. Clone or download this repository.
2. Open `supabase.js` and replace the placeholder URL/key with your Supabase project values.
3. (Optional) Update the shared passphrase(s) inside `script.js` (`USER_PASSCODES`).
4. Serve the project with any static server (e.g. `npx serve .`) or open `index.html` directly in a browser that supports `<dialog>`.

> **Note:** For audio recording to work on desktop browsers, the page usually needs to be served over `https` or `http://localhost`.

## Supabase configuration
1. Create a new project on [Supabase](https://supabase.com/).
2. In **Table editor**, create the required tables with the following SQL (runs once):

```sql
create table public.postcards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  "user" text not null check ("user" in ('Yassine','Nihal')),
  type text not null check (type in ('text','image','audio','doodle')),
  message text,
  asset_url text
);

create table public.moods (
  "user" text not null,
  "date" date not null,
  emoji text not null,
  primary key ("user", "date")
);

create table public.hearts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  "user" text not null,
  event_type text not null default 'heart'
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  "user" text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc', now())
);
create table public.postcard_reactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  postcard_id uuid references public.postcards(id) on delete cascade,
  "user" text not null,
  reaction text not null
);

create table public.postcard_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null,
  postcard_id uuid references public.postcards(id) on delete cascade,
  "user" text not null,
  comment text not null
);
```

3. Enable Row Level Security and add simple policies such as:
   - `postcards`: allow `insert`/`select` for `anon`.
   - `moods`: allow `insert`/`update`/`select` for `anon`.
   - `hearts`: allow `insert`/`select` for `anon`.
   - `push_subscriptions`: allow `insert`/`update`/`select` for `anon` (or scope to the owning user if you prefer tighter control).
   - `postcard_reactions`: allow `insert`/`select`/`delete` for `anon` (delete scoped to `auth.uid()`/`user` if you tighten security).
   - `postcard_comments`: allow `insert`/`select`/`update`/`delete` for `anon` (scope edits/deletes to the posted `user` if you later wire Supabase Auth).
   (Because the board is private and protected by the passphrase gate, the lightweight policy is acceptable. Tighten if you need stricter control.)

4. Create a storage bucket named `loveboard-assets` and make it **public**.
5. In the bucket, optionally create folders `photos/`, `doodles/`, and `audio/`. The app will automatically upload files there.
6. Copy the project URL and anon key from Supabase settings and place them in `supabase.js`.
7. (Push) Generate a VAPID key pair once using `npx web-push generate-vapid-keys`. Store the public key as `{{VAPID_PUBLIC_KEY}}` in `index.html` (via snippet injection or env) and save both keys as environment variables for your Supabase Edge function (see below).

### Push notification Edge Function

This repo ships with `supabase/functions/notify-push/index.ts`, which sends Web Push notifications to the other user. To enable it:

1. In your Supabase project, go to **Edge Functions** and deploy the function:
   ```bash
   supabase functions deploy notify-push --project-ref ijwxlyoxhlmlysfjzksl
   ```
2. Set the following function secrets in Supabase:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
3. Ensure your site is served over HTTPS so browsers allow push subscriptions.
4. When each user logs in, the app registers a service worker (`sw.js`), asks for notification permission, stores the push subscription in `push_subscriptions`, and calls the Edge function whenever a postcard/mood/heart is created so the other person receives the OS-level notification.

## Environment variables in production
For Netlify/Vercel you can inject the Supabase keys without checking them into git:

```html
<script>
  window.__SUPABASE_URL__ = window.__SUPABASE_URL__ || '';
  window.__SUPABASE_ANON_KEY__ = window.__SUPABASE_ANON_KEY__ || '';
  window.__VAPID_PUBLIC_KEY__ = window.__VAPID_PUBLIC_KEY__ || '';
</script>
```

Update `supabase.js` to read from those globals (already implemented) and override them via environment variables + inline script tags in your deployment platform, or just hardcode local values.

## Deploying
Because the project is fully static, you can deploy it anywhere:

### GitHub Pages
1. Push the repository to GitHub.
2. In Settings → Pages, select the main branch and `/` root.
3. Add an Actions workflow (optional) to build; none is strictly required because files are static.

### Netlify
1. Create a new site from GitHub (or drag and drop the folder in the Netlify UI).
2. Build command: `npm run build` (or leave empty) and publish directory: `/`.
3. Add the inline script snippet with environment variables in **Site settings → Build & deploy → Post processing → Snippet injection**.

### Vercel
1. Import the repository.
2. Set Framework preset to **Other**.
3. Leave build command/output blank so Vercel serves the static files directly.

After deploying, test:
- Logging in as each user (passphrase).
- Creating a postcard with every attachment type.
- Switching surprise mode, mood stickers, and verifying realtime updates on two devices.
- Long-press to ensure floating hearts sync.
- Allowing notifications on desktop + phone and confirming that the other user receives an alert when you post a postcard, change mood, or send hearts (requires HTTPS + deployed Edge function).

Enjoy Loveboard!💗
