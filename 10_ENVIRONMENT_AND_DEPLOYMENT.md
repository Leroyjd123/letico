# lectio — environment & deployment guide

**Version:** 1.0  
**Last Updated:** 2026-03-28

---

## 1. prerequisites

| tool | version | install |
|---|---|---|
| Node.js | ≥ 20.0.0 | `nvm install 20` |
| pnpm | ≥ 9.0.0 | `npm i -g pnpm@9` |
| Supabase CLI | latest | `npm i -g supabase` |
| Git | any | — |

---

## 2. local setup

```bash
# 1. clone
git clone https://github.com/your-org/lectio.git
cd lectio

# 2. install all dependencies (all workspaces)
pnpm install

# 3. copy environment variables
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 4. run database migration
pnpm db:migrate

# 5. seed Bible data (66 books, all verses)
pnpm db:seed

# 6. verify seed (must print "✓ 31,102 verses seeded")
pnpm db:verify

# 7. start all services
pnpm dev
# web → http://localhost:3000
# api → http://localhost:4000
```

---

## 3. environment variables

### apps/web (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### apps/api (.env)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
```

**security rules:**
- `SUPABASE_SERVICE_ROLE_KEY` must never appear in any frontend file, build output, or client-side bundle
- `NEXT_PUBLIC_*` variables are exposed to the browser by design — only put public-safe values there
- Never commit `.env` files — `.gitignore` must include `.env` and `.env.local`

---

## 4. supabase setup

### create project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your users
3. Copy: Project URL, anon key, service role key → paste into `.env` files

### run migrations

```bash
# link to your supabase project
supabase link --project-ref your-project-ref

# push all migrations
supabase db push
```

### enable realtime

In Supabase dashboard:
- Table Editor → `verse_reads` → Enable Realtime

### email OTP config

In Supabase dashboard:
- Authentication → Settings → Email Auth → Enable "Email OTP"
- Set OTP expiry to 300 seconds (5 minutes)

---

## 5. database migrations

Migrations live in `apps/api/supabase/migrations/`. Naming convention: `NNN_description.sql`.

```bash
# create a new migration
supabase migration new add_archived_verse_reads

# apply pending migrations
supabase db push

# reset to clean state (dev only — DESTROYS ALL DATA)
supabase db reset
```

**rules:**
- Never modify an existing migration file that has been applied to any environment
- New changes always go in a new migration file
- Migrations are run in sequential order by filename prefix (001, 002, etc.)

---

## 6. running storybook

```bash
cd apps/web
pnpm storybook
# opens at http://localhost:6006
```

---

## 7. running tests

```bash
# all unit tests
pnpm test

# with coverage
pnpm test --coverage

# watch mode
pnpm test --watch

# e2e (requires apps running + test Supabase project)
pnpm e2e
```

---

## 8. production deployment

### frontend — vercel

1. Connect GitHub repo to Vercel
2. Set root directory: `apps/web`
3. Build command: `pnpm build` (Turbo handles caching)
4. Output: `.next`
5. Add environment variables in Vercel dashboard (not in code)

### api — vercel functions

1. Add `apps/api` as a second Vercel project OR use a serverless adapter
2. NestJS serverless adapter: `@nestjs/platform-express` + Vercel adapter
3. Alternatively: deploy as a standalone Node process on Railway, Render, or Fly.io

### database — supabase

1. Run migrations on production: `supabase db push --project-ref prod-ref`
2. Run seed on first deploy: `pnpm db:seed --env=production`
3. Enable Realtime on `verse_reads` in production dashboard

---

## 9. ci/cd (github actions)

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test --coverage
      - run: pnpm lint
```

---

## 10. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
