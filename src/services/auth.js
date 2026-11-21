import { supabase, supabaseConfigError } from '../lib/supabase.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigError);
  }
  return supabase;
}

export async function signUp({
  email,
  password,
  firstName,
  lastName,
  faculty,
  major
}) {
  const client = requireSupabase();
  const { data, error } =
    await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          faculty,
          major
        }
      }
    });

  if (error) {
    throw translateAuthError(error);
  }

  return data;
}

export async function updateStudentDetails({
  firstName,
  lastName,
  faculty,
  major,
  avatarUrl
}) {
  const client = requireSupabase();
  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    faculty,
    major
  };

  if (avatarUrl) {
    userMetadata.avatar_url = avatarUrl;
  }

  const { data, error } = await client.auth.updateUser({
    data: userMetadata
  });

  if (error) {
    throw translateAuthError(error);
  }

  return data.user;
}

export async function signIn({
  email,
  password
}) {
  const client = requireSupabase();
  const { data, error } =
    await client.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw translateAuthError(error);
  }

  return data;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { data, error } =
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

  if (error) {
    throw translateAuthError(error);
  }

  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } =
    await client.auth.signOut();

  if (error) {
    throw translateAuthError(error);
  }
}

export async function resetPassword(email) {
  const client = requireSupabase();
  const { error } =
    await client.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          `${window.location.origin}/?reset=true`
      }
    );

  if (error) {
    throw translateAuthError(error);
  }
}

export function onAuthStateChange(callback) {
  const client = requireSupabase();
  return client.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
}

export async function getSession() {
  const client = requireSupabase();

  let timeoutId;
  const sessionResult = client.auth.getSession();
  const timeoutResult = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('เชื่อมต่อ Supabase ไม่สำเร็จภายใน 8 วินาที กรุณาตรวจสอบ Environment Variables และการเชื่อมต่อเครือข่าย'));
    }, 8000);
  });

  const {
    data,
    error
  } = await Promise.race([sessionResult, timeoutResult]).finally(() => {
    window.clearTimeout(timeoutId);
  });

  if (error) {
    throw translateAuthError(error);
  }

  return data.session;
}

function translateAuthError(error) {
  const message =
    String(error?.message || '').toLowerCase();

  if (
    message.includes('invalid login credentials')
  ) {
    return new Error(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    );
  }

  if (
    message.includes('email not confirmed')
  ) {
    return new Error(
      'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'
    );
  }

  if (
    message.includes('user already registered')
  ) {
    return new Error(
      'อีเมลนี้ถูกสมัครสมาชิกแล้ว'
    );
  }

  if (
    message.includes('password')
    && message.includes('6')
  ) {
    return new Error(
      'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    );
  }

  if (message.includes('rate limit')) {
    return new Error(
      'ระบบถูกเรียกใช้งานบ่อยเกินไป กรุณาลองใหม่ภายหลัง'
    );
  }

  return new Error(
    'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  );
}