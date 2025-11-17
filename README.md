# Loveboard

Loveboard is a cozy, romantic postcard board for Yassine and Nihal. It is built with plain HTML, CSS, and vanilla JavaScript plus Supabase for realtime data, simple auth, and storage. The UI is mobile-first and thumb-friendly so both of you can swap little notes, photos, doodles, audio snippets, and floating hearts on the go.

## Features
- Password gate that lets only Yassine or Nihal in.
- Mood stickers of the day with realtime updates.
- Surprise mode that softly blurs every postcard until tapped.
- Create Postcard modal with: short note (150 chars), photo upload, doodle canvas, and 15s audio recording.
- Instant syncing of postcards, moods, and floating heart reactions through Supabase realtime channels.
- Memory Lane timeline for older postcards.
- Assets (photos, doodles, audio) stored in Supabase Storage and referenced from each postcard.

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
```

3. Enable Row Level Security and add simple policies such as:
   - `postcards`: allow `insert`/`select` for `anon`.
   - `moods`: allow `insert`/`update`/`select` for `anon`.
   - `hearts`: allow `insert`/`select` for `anon`.
   (Because the board is private and protected by the passphrase gate, the lightweight policy is acceptable. Tighten if you need stricter control.)

4. Create a storage bucket named `loveboard-assets` and make it **public**.
5. In the bucket, optionally create folders `photos/`, `doodles/`, and `audio/`. The app will automatically upload files there.
6. Copy the project URL and anon key from Supabase settings and place them in `supabase.js`.

## Environment variables in production
For Netlify/Vercel you can inject the Supabase keys without checking them into git:

```html
<script>
  window.__SUPABASE_URL__ = window.__SUPABASE_URL__ || '';
  window.__SUPABASE_ANON_KEY__ = window.__SUPABASE_ANON_KEY__ || '';
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

Enjoy Loveboard!💗
