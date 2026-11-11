import { supabase } from '../lib/supabase.js';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

export async function uploadStudentAvatar(userId, file) {
  if (!AVATAR_TYPES.has(file.type)) {
    throw new Error('รองรับไฟล์ JPG, PNG หรือ WebP เท่านั้น');
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('ขนาดรูปโปรไฟล์ต้องไม่เกิน 5 MB');
  }

  const path = `${userId}/profile.${AVATAR_TYPES.get(file.type)}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: '0',
      contentType: file.type,
      upsert: true
    });

  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) {
      throw new Error(
        `ไม่พบ Storage bucket "${AVATAR_BUCKET}" กรุณาสร้าง bucket นี้ใน Supabase Storage`
      );
    }
    throw new Error(`อัปโหลดรูปโปรไฟล์ไม่สำเร็จ: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);

  return `${data.publicUrl}?v=${Date.now()}`;
}
