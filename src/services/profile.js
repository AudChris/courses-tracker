import { supabase } from '../lib/supabase.js';

export async function getProfile(userId) {
  const {
    data,
    error
  } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `โหลดข้อมูลโปรไฟล์ไม่สำเร็จ: ${error.message}`
    );
  }

  return data;
}

export async function updateProfile(
  userId,
  updates
) {
  const {
    data,
    error
  } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(
      'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้'
    );
  }

  return data;
}