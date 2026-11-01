# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability**, or use [this link](https://github.com/indhu-prakash/careerbuddy/security/advisories/new).

Please include:
- what the issue is and where it is (file, route or page)
- steps to reproduce it
- what an attacker could do with it

You'll get a reply within 7 days. Once the issue is fixed, you'll be credited in the advisory unless you'd rather stay anonymous.

## Scope

In scope: this repository's code and the live app at https://careerbuddy-ecru.vercel.app.

Out of scope:
- denial-of-service or load testing against the live app
- issues in third-party services (Supabase, Vercel, OpenRouter) themselves; report those to the vendor
- testing that accesses other users' data beyond the minimum needed to show the issue

## Supported versions

Only the latest version on `main` is supported.
