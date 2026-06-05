# Self-Host Setup

This project is designed for self-hosting. The original author's Firebase and Cloudflare resources are not included in this repository.

## 1. Install Dependencies

```bash
npm install
```

## 2. Create Firebase Configuration

Create a Firebase project and enable Google sign-in.

In Firebase Console:

1. Create or open a Firebase project.
2. Go to Authentication.
3. Enable Google as a sign-in provider.
4. Create a Web App.
5. Copy the Web App config values.

You will need these values:

```txt
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
```

## 3. Create Cloudflare Resources

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

Keep the D1 database id from the Wrangler output. You will enter it during setup.

## 4. Run the Setup Wizard

```bash
npm run setup
```

The setup wizard writes:

```txt
.env
.dev.vars
wrangler.toml
```

These files are local-only and ignored by git.

## 5. Store the Production Session Secret

The setup wizard generates a `SESSION_SECRET` for local development. Store the same value as a Cloudflare Worker secret:

```bash
npx wrangler secret put SESSION_SECRET
```

Paste the generated secret when Wrangler asks for the value.

## 6. Verify Configuration

```bash
npm run setup:check
```

Fix any missing values before continuing.

## 7. Run Locally

```bash
npm run dev:api
```

Open the local URL shown by Wrangler and test Google login.

## 8. Deploy

```bash
npm run deploy
```

After deployment, add your Worker domain to Firebase Authentication authorized domains.

## 9. Configure the Extension

Install the generated extension zip from the app download page, then open the extension options page and enter your deployed Worker URL.

Example:

```txt
https://my-bookmark.<account>.workers.dev
```

You can also create an extension token in the app and use the auto-connect flow.

## Troubleshooting

If Google login fails, check Firebase authorized domains and the values in `.env`.

If API requests fail, check `wrangler.toml`, `.dev.vars`, and whether D1 migrations were applied.

If image uploads fail, check that the R2 bucket name in `wrangler.toml` exists in your Cloudflare account.
