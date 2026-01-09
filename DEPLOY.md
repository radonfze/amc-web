# 🚀 Deployment Guide (Vercel)

Your Pryzo AMC application is Next.js-native, making Vercel the perfect host.

## 1. Prerequisites
- **GitHub Repository**: Ensure your code is pushed to GitHub.
- **Supabase Project**: You clearly have one (`aws-1-ap-northeast-2...`).

## 2. Environment Variables
When importing the project in Vercel, expand the **"Environment Variables"** section and add:

| Name | Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://crbzguhnmlfsdtdcmvmk.supabase.co` | *Found in Supabase -> Settings -> API* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `(Get from Supabase Dashboard > Settings > API)` | *Your Public Anon Key* |

> **Note**: Your project uses `@supabase/ssr` and client-side auth, so you generally don't need the Service Role key for the frontend content.

## 2.5 Database Credentials (For Admin Access)
If you need to connect directly via a DB Client (TablePlus, DBeaver) or for the migration script:
- **Host**: `aws-1-ap-northeast-2.pooler.supabase.com`
- **User**: `postgres.crbzguhnmlfsdtdcmvmk`
- **Password**: `adminR@DON@89`
- **Port**: `6543` / `5432`
- **Database**: `postgres`

## 3. Database Migration
Your database schema is managed by `scripts/migrate_view.js`.

**⚠️ Important**: This script currently contains a **hardcoded connection string** to your Production DB.
`postgresql://postgres.crbzguhnmlfsdtdcmvmk:adminR%40DON%4089@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`

### How to Migrate:
Since the script points directly to the cloud DB, you should **run it from your local machine**:
```bash
node scripts/migrate_view.js
```
This will apply all Tables, RLS Policies, and Functions to the live database.

## 4. PWA Configuration
Vercel automatically serves your app over **HTTPS**, which is required for the Service Worker (`sw.js`) to function.
- **Manifest**: Located at `public/manifest.json`.
- **Icons**: Ensure `public/icons` are committed.

## 5. Verification after Deploy
1.  **Visit URL**: Open your Vercel URL on a mobile device.
2.  **Install App**: Tap "Add to Home Screen".
3.  **Offline Test**: Turn off data -> Open App -> Should load "Today's Visits".

**Ready to Ship! 🚢**
