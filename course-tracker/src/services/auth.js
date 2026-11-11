import { supabase } from '../lib/supabase.js';

export async function signUp({
  email,
  password,
  firstName,
  lastName,
  faculty,
  major
}) {
  const { data, error } =
    await supabase.auth.signUp({
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
  const userMetadata = {
    first_name: firstName,
    last_name: lastName,
    faculty,
    major
  };

  if (avatarUrl) {
    userMetadata.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase.auth.updateUser({
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
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    throw translateAuthError(error);
  }

  return data;
}

export async function signInWithGoogle() {
  const { data, error } =
    await supabase.auth.signInWithOAuth({
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
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw translateAuthError(error);
  }
}

export async function resetPassword(email) {
  const { error } =
    await supabase.auth.resetPasswordForEmail(
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
  return supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
}

export async function getSession() {
  const {
    data,
    error
  } = await supabase.auth.getSession();

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