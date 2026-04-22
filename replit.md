# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`)

## Applications

### PRD Sprint Planner (`artifacts/sprint-planner`)
- React + Vite frontend at `/` (port 19948)
- Deep indigo/slate dark UI
- Pages: Home (generator), Results (PRD + tasks + sprints), Features library, Admin dashboard

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- Routes: `/features`, `/prds`, `/tasks`, `/sprints`, `/admin/stats`, `/admin/recent-activity`, `/ai/generate-prd`
- AI generation: `POST /api/ai/generate-prd` — uses GPT to generate full PRD, tasks, and sprint plan from a feature idea

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `features` — feature ideas with title, description, status (pending/generating/completed/failed)
- `prds` — generated PRDs with overview, goals, user stories, tech requirements, success metrics
- `tasks` — individual tasks with type, priority, effort points, risk level, dependencies
- `sprints` — sprint groupings with sprint number, goal, effort totals

## AI Logic

The `/api/ai/generate-prd` endpoint:
1. Accepts a featureId
2. Calls GPT-5.4 with a comprehensive prompt
3. AI returns structured JSON with PRD sections, tasks, and sprint assignments
4. Smart logic computes priority scores and risk scores
5. Dependencies are detected and stored
6. Tasks are assigned to sprints based on AI output

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
