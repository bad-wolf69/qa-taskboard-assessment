# TaskBoard — Project Management App

A Next.js 15 fullstack application for managing projects, tasks, and team members. TypeScript + Prisma + PostgreSQL on the server, React 19 + TanStack Query on the client.

## Walkthrough Video

https://drive.google.com/file/d/1z6tXycPvdNuDgb_lqrI6vC6L7gsKzhKl/view?usp=sharing

> Note: bonus Dashboard implementation and high impact bug assessment at the end of the video.

## Quick Setup (Docker — Recommended)

```bash
# Clone and enter the repo
git clone <repo-url> && cd taskboard

# Start the app and database (seeds automatically)
docker-compose up --build

# The app is now running at http://localhost:3000
```

## Manual Setup (without Docker)

Requires: Node.js 20+, PostgreSQL 15+

```bash
# Run the setup script (installs deps, sets up DB, configures git hooks)
chmod +x bin/setup
./bin/setup

# Or do it manually:
npm install
git config core.hooksPath .git-hooks
cp .env.example .env   # then edit DATABASE_URL if your local Postgres differs
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm test
npm run dev
```

## Seed Data

The seed file creates:
- 5 users across 3 projects with different roles (admin / member / viewer)
- 3 projects with realistic task distributions
- 12 tasks spanning all four statuses (`todo`, `in_progress`, `review`, `done`)

All user passwords are: `password123`

| Email | Role on which project |
|-------|----------------------|
| meera@taskboard.dev | admin on Q3 Launch & Internal Tools, member on Onboarding |
| arjun@taskboard.dev | admin on Onboarding, member on Q3 Launch |
| kavya@example.com | member on Q3 Launch |
| dev@example.com | viewer on Q3 Launch |
| lina@example.com | member on Onboarding |

## Authentication

Register or login to get a JWT token:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"meera@taskboard.dev","password":"password123"}'

# Use the returned token
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/projects
```

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in, get JWT
- `GET /api/users/me` — Current user (authenticated)

### Projects
- `GET /api/projects` — List projects you're a member of (authenticated)
- `POST /api/projects` — Create a project (authenticated; creator becomes admin)
- `GET /api/projects/:id` — Project detail with tasks and members (authenticated)
- `PATCH /api/projects/:id` — Update project (authenticated)
- `DELETE /api/projects/:id` — Delete project (authenticated)

### Tasks
- `GET /api/projects/:id/tasks` — List tasks in a project (authenticated)
- `POST /api/projects/:id/tasks` — Create a task (authenticated)
- `PATCH /api/tasks/:id` — Update a task (authenticated)
- `DELETE /api/tasks/:id` — Delete a task (authenticated)

## Tech Stack

- Node.js 20 (runtime)
- Next.js 15 (App Router) / React 19
- TypeScript 5 (strict mode)
- Prisma 6 + PostgreSQL 16
- TanStack Query 5 (client data)
- Zod 3 (schema validation)
- Tailwind CSS 3
- bcryptjs + jsonwebtoken
- Vitest 2 (testing)
