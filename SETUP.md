# Setup Instructions

## Environment Variables
Create a file named `.env.local` in this directory and add your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup
1. Go to your Supabase Project Dashboard.
2. Open the SQL Editor.
3. Run the content of `supabase/schema.sql`.

## Running the App
```bash
npm run dev
```
