# Supabase data security

The app uses the public/anon key in the browser, so database access must be
restricted with Row Level Security; client-side `user_id` filters are not an
access control boundary.

`VITE_SUPABASE_ANON_KEY` is a public key, not a secret. The Vite configuration
rejects Supabase service-role/secret keys and other secret-like `VITE_` variable
names before they are bundled. Do not try to hide a privileged key in frontend
code, HTML, or a built asset; anyone can inspect those files.

Apply the migration to the existing Supabase project after confirming the
`public.courses`, `public.profiles`, and Storage schemas match the app:

```powershell
supabase db push
```

The migration allows signed-in users to read and change only their own course
rows and profile, and limits avatar uploads to the caller's `avatars/<user-id>/`
folder. Restrictive ownership policies also fence existing permissive policies
on these records. Review the existing policies on these tables and
`storage.objects` before deployment, and never expose the service-role key:
service-role access bypasses RLS. Public avatar buckets continue to serve
avatar images publicly by design; the Storage policies restrict writes.

Do not grant the service-role key to the browser or store Gemini credentials in
any `VITE_` variable. The Gemini key belongs only in Supabase Function Secrets.
If a service-role, Gemini, or other private key was ever committed or deployed
in a frontend bundle, revoke/rotate it immediately; deleting it from source
does not make the exposed value secret again. Restrict any provider-supported
public API keys to the required APIs and app origins, and keep private keys
server-side.
