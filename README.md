# SignageHub — Digital Signage Management Platform

> A cloud-based digital signage platform built on **Next.js 14** + **Supabase**.
> Manage screens, projects, playlists, and schedules from a modern admin dashboard.
> Display clients run fullscreen in any browser — no app installation required.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see .env.example)
cp .env.example .env.local

# 3. Run migrations in Supabase SQL Editor (in order):
#    supabase/migrations/20240305000000_digital_signage_schema.sql
#    supabase/migrations/20240306000000_public_display_rls.sql
#    supabase/migrations/20240307000000_fix_handle_new_user.sql

# 4. Start local dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → register → the platform auto-creates your workspace.

---

## Architecture

```
Admin Dashboard (/dashboard)
  ↓  Supabase Realtime (WebSocket)
Display Client (/display/<display-key>)
```

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage (`content` bucket) |
| Real-time | Supabase Realtime |
| Deployment | Vercel |

---

## Project Structure

```
app/
  dashboard/           Admin UI — screens, projects, content, schedules
  display/[screenId]/  Public fullscreen display client
  login/ register/     Auth pages

components/            Reusable UI components
hooks/                 React hooks (useUser, useToast)
lib/
  supabase/            Browser + server Supabase clients
  schedule-engine.ts   Pure TS schedule evaluation logic
  app-url.ts           Centralized URL generation

supabase/
  migrations/          SQL migration files (apply in Supabase SQL Editor)
```

---

## Key Features

- **Multi-location support** — Organize screens by location with timezone-aware scheduling
- **Playlist engine** — Ordered items with per-item duration and transitions
- **Schedule system** — Auto-switch projects by time-of-day, day-of-week, and priority
- **Push events** — Send instant commands to screens: reload, alert, sound, content override
- **Real-time sync** — Changes appear on display within ~1 second via WebSocket
- **PWA support** — Install display client as a fullscreen kiosk app
- **Dark mode** — Light / dark / system theme switching
- **Role-based access** — Owner → Admin → Editor → Viewer

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Your production domain (for display URL generation) |
| `NEXT_PUBLIC_APP_NAME` | App name shown in browser tab (default: SignageHub) |

---

## Display Client Setup

Each screen gets a unique **Display URL**:
```
https://your-app.com/display/<display-key-uuid>
```

1. Create a screen in the dashboard → copy the Display URL
2. Open the URL in a browser on the physical display PC
3. The browser displays content fullscreen, with cursor hiding and Wake Lock active
4. Install as a PWA for no-chrome fullscreen kiosk mode

---

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push to GitHub
2. Import into Vercel — Next.js is auto-detected
3. Add all environment variables in Vercel dashboard
4. Set `NEXT_PUBLIC_APP_URL` to your production domain

---

## Documentation

See the full documentation:
- [Architecture & Database Schema](./supabase/migrations/20240305000000_digital_signage_schema.sql)
- Feature guides, troubleshooting, and deployment details are in the project docs artifact

---

## Troubleshooting

**Stuck on skeleton loaders?** The new user's `organization_id` is null. Run in Supabase SQL Editor:
```sql
update public.profiles
set organization_id = '<org-id>', role = 'owner'
where id = (select id from auth.users where email = 'your@email.com');
```

**Display client shows blank?** Make sure Realtime is enabled on `screens`, `projects`, `playlist_items`, and `push_events` tables in Supabase.

**Display URL not working in production?** Set `NEXT_PUBLIC_APP_URL` to your production domain, not `localhost`.

---

*Built with ♥ using Next.js 14 + Supabase*
