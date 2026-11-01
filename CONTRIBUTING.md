# Contributing to CareerBuddy

Thanks for your interest in improving CareerBuddy! Bug reports, ideas, docs fixes and code are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/indhu-prakash/careerbuddy/issues) first, so we can agree on the approach before you spend time on code.
- **Security issues:** don't open a public issue. See [SECURITY.md](SECURITY.md).
- **Small fixes** (typos, docs, obvious bugs) can go straight to a pull request.

## Local setup

You need Node.js 22, a free [Supabase](https://supabase.com) project and a free [OpenRouter](https://openrouter.ai/keys) API key. Use your own keys; never ask for or share the production ones.

1. Fork the repo and clone your fork.
2. Follow [Getting started](README.md#7-getting-started) in the README: copy `.env.example` to `.env`, fill it in, then run:

   ```bash
   npm install
   npm run db:deploy
   npm run db:seed
   npm run supabase:setup
   npm run dev
   ```

3. Open `http://localhost:3000/api/health` to check that the database and keys are wired up.

Notes:
- The free OpenRouter models are slow (up to about a minute per analysis) and rate-limited. That's expected.
- Supabase's built-in mailer sends only a few sign-in emails per hour. If you hit the limit, wait or configure custom SMTP in your Supabase project.
- Voice transcription uses paid models (fractions of a cent per minute) and needs HTTPS or `localhost` for microphone access.

## Project layout

- `src/app` — pages and API routes (`src/app/api/v1`)
- `src/features/<module>/components` — UI per feature
- `src/lib` — server logic; deterministic scoring lives in `src/lib/scoring`
- `prisma` — schema, migrations and seed data
- `tests` — Vitest suite

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and the reasons behind it.

## Making changes

1. Create a branch from `main`: `git checkout -b fix/short-description`.
2. Keep pull requests focused on one change.
3. Match the style of the surrounding code. API route handlers call `requireUser()` and scope every query by the user id.
4. Add or update tests for logic changes, especially scoring and parsing code.
5. Changing `prisma/schema.prisma`? Run `npm run db:migrate -- --name <change>` and `npm run docs:db`, and commit both.
6. Never commit `.env` files, API keys, real resumes or personal data.

Before opening a pull request, run:

```bash
npm run lint
npx tsc --noEmit
npm test
```

CI runs the same checks on every pull request.

## Pull requests

- Describe what changed and why, and link the issue it closes.
- Add screenshots for UI changes.
- A maintainer will review it. Small follow-up changes are normal.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE), and you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
