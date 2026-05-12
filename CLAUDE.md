# Claude Code

This project uses the Payload CMS skill at `.claude/skills/payload/`.
Start with `.claude/skills/payload/SKILL.md` for a quick reference, then see `.claude/skills/payload/reference/` for detailed docs.


# CLAUDE.md — Elessar Records

## Stack
Payload CMS 3 + Next.js 15 (App Router) + PostgreSQL + TypeScript strict

## NEVER DO
- Read .env or .env.* files — assume vars exist, never cat/read them
- Run the dev server (npm run dev, next dev, payload dev)
- Run database migrations automatically — show the command, don't execute
- Install packages without explicit permission
- Run git commands (commit, push, pull, merge)
- Delete files without explicit confirmation
- Run npm audit, npm outdated, npx commands not directly asked

## CODE RULES
- TypeScript only, no `any`
- Payload CMS 3 syntax — no legacy v2 patterns
- All collections in src/collections/
- All access helpers in src/access/
- All utilities in src/utils/

## ASSUME (don't ask, don't verify)
- DATABASE_URI, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL exist in .env
- PostgreSQL is running and accessible
- Node and npm are installed and working
- Dependencies in package.json are already installed

## RESPONSE STYLE
- No long explanations unless asked
- Show code directly
- If multiple files change, list them at the top before showing code
- Prefer editing existing files over creating new ones when possible

0ms, application-code: 6.0s)
 GET / 200 in 57s (next.js: 5ms,