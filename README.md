# Pantrypal by BugBytes

Pantrypal is an Expo and React Native app for tracking pantry items and expiry dates, checking food nutrition, and finding recipes from ingredients on hand.

## What it includes

- Home calendar with weekly and monthly expiry views
- Searchable pantry with food categories, expiry status, nutrition details, and item removal
- Add-food form with quantity units, category, symbol, and expiry date
- Recipe search, pantry ingredient matching, and favorites
- Optional local expiry reminders with a selectable lead time
- Guest mode with local pantry storage
- Optional Supabase accounts and pantry sync across devices
- USDA FoodData Central and TheMealDB access through the local API server or Cloudflare Worker

## Source layout

```text
App.js                  Main Expo application
expiryNotifications.js  Local expiry reminder scheduling
supabase.js              Supabase client configuration
supabase/schema.sql     Pantry snapshot table and row-level security
server/index.mjs         Local API for USDA and TheMealDB requests
worker/index.js          Cloudflare API proxy for USDA and TheMealDB
wrangler.jsonc           Cloudflare Worker deployment configuration
.env.example             Safe template for local environment values
app.json                 Expo app configuration
package.json             Dependencies and development commands
package-lock.json        Locked dependency versions
```

The Expo entry point is `App.js`.

## Requirements

- Node.js supported by Expo SDK 58 (Node 22.13+ or Node 24.3+)
- Expo Go or an iOS/Android simulator
- A Supabase project for account creation and cloud sync
- A USDA FoodData Central API key for nutrition lookups

## Run locally

1. Clone this repository and open a terminal in the project folder.
2. Install packages and create a local environment file:

   ```sh
   npm install
   cp .env.example .env
   ```

3. In `.env`, set `FDC_API_KEY`. To enable accounts, also set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Start the local API server in one terminal:

   ```sh
   npm run api
   ```

5. Start Expo in a second terminal:

   ```sh
   npx expo start --clear
   ```

The sample API URL `http://localhost:3001` is for an iOS simulator. For a physical phone, set `EXPO_PUBLIC_API_URL` to the computer's LAN IP, such as `http://192.168.1.20:3001`. Keep both devices on the same network. Restart Expo after changing environment values.

Pantry tracking works offline without an account. USDA nutrition and recipe search need an internet connection and the local API server.

## Team

**BugBytes** — Pantrypal project team.
