import { defineConfig, loadEnv } from 'vite';

function getSupabasePublicKeyType(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return 'publishable';

  const segments = key.split('.');
  if (segments.length !== 3 || !segments[1]) return 'invalid';

  try {
    const payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    return claims.role === 'anon' ? 'anon' : 'privileged';
  } catch {
    return 'invalid';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const secretVariables = Object.keys(env).filter(
    (name) => name.startsWith('VITE_')
      && /(?:API_KEY|SECRET|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN)/i.test(name)
      && name !== 'VITE_SUPABASE_ANON_KEY'
  );

  if (secretVariables.length) {
    throw new Error(
      `ห้ามใส่คีย์ลับในตัวแปร VITE_ ซึ่งจะถูกฝังในไฟล์หน้าเว็บ: ${secretVariables.join(', ')}`
    );
  }

  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  if (supabaseKey && !['anon', 'publishable'].includes(getSupabasePublicKeyType(supabaseKey))) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY ต้องเป็น publishable key หรือ anon key เท่านั้น ห้ามใช้ service_role หรือ secret key'
    );
  }

  return {};
});
