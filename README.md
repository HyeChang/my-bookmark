# My Bookmark

Self-hosted bookmark and memo manager built with Firebase Authentication, Cloudflare Workers, Cloudflare D1, and Cloudflare R2.

## What You Need

- Node.js 20 or newer
- npm
- A Firebase project with Google sign-in enabled
- A Cloudflare account with Workers, D1, and R2 enabled

## Quick Start

Install dependencies:

```bash
npm install
```

Create local configuration files:

```bash
npm run setup
```

Verify the generated configuration:

```bash
npm run setup:check
```

Run locally:

```bash
npm run dev:api
```

Deploy to Cloudflare:

```bash
npm run deploy
```

Detailed setup steps are in [docs/self-host.md](docs/self-host.md).

## Local-Only Files

These files contain your own Firebase and Cloudflare values and are ignored by git:

```txt
.env
.dev.vars
wrangler.toml
```

Do not commit those files to a public repository.

## Browser Extension

The extension does not use the original author's Worker URL. After deploying your own app, open the extension options page and enter your Worker URL, or use the extension auto-connect flow inside the app.

## License

MIT
