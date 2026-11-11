# Gemini course extraction

The `extract-courses` Edge Function receives OCR text from the signed-in client,
verifies the Supabase user session, and sends that text to Gemini. The PDF itself
is read in the browser and is not uploaded to Supabase or Gemini.

Set the Gemini key as a Supabase Function secret; never add it to a `VITE_`
variable, source file, or browser request:

```powershell
supabase secrets set GEMINI_API_KEY=your-key
supabase functions deploy extract-courses
```

Alternatively, add `GEMINI_API_KEY` under the project's Supabase Dashboard
**Edge Functions → Secrets**, then deploy the function with the Supabase CLI.
The function uses `gemini-3.5-flash-lite` by default; `GEMINI_MODEL` can override it
as another server-side secret.
