# CardPortfolio

A sports card collection tracker built with an investment portfolio mindset. Track cost basis, allocation by sport, and acquisitions — with card-focused detail views when browsing your collection.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React, TypeScript, Tailwind CSS |
| UI | shadcn/ui |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Hosting | Vercel + Supabase |

This stack is chosen for fast MVP delivery and future mobile parity — Supabase provides native SDKs for iOS, Android, React Native, and Flutter that share the same auth, database, and storage APIs.

## Features (v1)

- **User accounts** — email/password signup and login, per-user data isolation via Row Level Security
- **Card management** — create, view, edit, and delete cards
- **Card fields** — player, year, card type, sport, card number, insert/parallel, grader, grade, cert number, purchase date/price, quantity, notes
- **Image upload** — attach a photo to each card
- **Portfolio dashboard** — total cost basis, card count, allocation by sport, recent acquisitions
- **Collection view** — card-focused grid with search and sport filters

## Getting Started

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_signup_availability.sql` (or `002a` + `002b`)
   - `supabase/migrations/003_card_valuations.sql`
   - `supabase/migrations/004_card_sales.sql`
3. Under **Authentication → Providers**, ensure Email is enabled
4. Copy your project URL and anon key from **Settings → API**

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add the same environment variables in Vercel project settings
4. Deploy

## Project Structure

```
src/
├── app/
│   ├── (app)/          # Authenticated routes (dashboard, collection, cards)
│   ├── (auth)/         # Login and signup
│   └── actions/        # Server actions (auth, card CRUD)
├── components/         # UI components
├── lib/                # Supabase clients, data fetching, constants
└── types/              # TypeScript types
supabase/
└── migrations/         # Database schema and RLS policies
```

## Roadmap

- [ ] Current value estimation via pricing APIs
- [ ] Gain/loss tracking and performance charts
- [ ] Card catalog search and auto-populate
- [ ] Android and iOS apps with feature parity
