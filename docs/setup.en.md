# Self-Host Setup Guide

This project is a self-hosted bookmark and memo manager. You must deploy it with your own Firebase and Cloudflare resources. The original author's Firebase project, Cloudflare Worker, D1 database, and R2 bucket are not included in this repository.

## 1. Requirements

- Node.js 20 or newer
- npm
- A Firebase project
- A Cloudflare account
- Wrangler login access

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Firebase

In Firebase Console:

1. Create or open a Firebase project.
2. Go to Authentication.
3. Enable Google in Sign-in method.
4. Create a Web App.
5. Copy the Web App config values.

You will enter these values during setup:

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
```

After deployment, also add your deployed Worker domain to Firebase Authentication authorized domains.

## 4. Create Cloudflare Resources

Log in to Wrangler:

```bash
npx wrangler login
```

Create a D1 database:

```bash
npx wrangler d1 create my-bookmark
```

Create an R2 bucket:

```bash
npx wrangler r2 bucket create my-bookmark-assets
```

Copy the `database_id` from the D1 command output. You will enter it during `npm run setup:en`.

## 5. Run the Setup Wizard

Run the English setup wizard:

```bash
npm run setup:en
```

You can also run the default setup command and choose a language interactively:

```bash
npm run setup
```

The setup wizard writes these local files:

```txt
.env
.dev.vars
wrangler.toml
```

These files contain your own Firebase and Cloudflare values. They are ignored by git.

## 6. Store SESSION_SECRET

The setup wizard generates a local `SESSION_SECRET`. Store the same value as a Cloudflare Worker secret for production:

```bash
npx wrangler secret put SESSION_SECRET
```

When Wrangler asks for the value, paste the `SESSION_SECRET` printed by the setup wizard.

## 7. Verify Configuration

```bash
npm run setup:check
```

Fix any reported errors before continuing. `.dev.vars` warnings may appear when local development values are empty.

## 8. Run Locally

```bash
npm run dev:api
```

Open the local URL shown by Wrangler and test Google login.

## 9. Deploy

```bash
npm run deploy
```

After deployment, add your deployed Worker domain to Firebase Authentication authorized domains.

Example:

```txt
my-bookmark.<account>.workers.dev
```

## 10. Configure the Extension

Install the generated extension zip from the app download page. Then open the extension options page and enter your deployed Worker URL.

Example:

```txt
https://my-bookmark.<account>.workers.dev
```

You can also create an extension token in the app and use the auto-connect flow.

## Troubleshooting

If Google login fails, check Firebase authorized domains and the values in `.env`.

If API requests fail, check `wrangler.toml`, `.dev.vars`, and whether D1 migrations were applied.

If image uploads fail, check that the R2 bucket name in `wrangler.toml` exists in your Cloudflare account.
