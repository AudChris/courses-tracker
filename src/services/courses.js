import { supabase } from '../lib/supabase.js';

const COURSE_COLUMNS =
  'id,user_id,code,name,credits,category,year,semester,status,grade,note,created_at';

function getCourseCodePattern(code) {
  return code.trim().replace(/[\\%_]/g, '\\$&');
}

export async function getCourses(userId) {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('user_id', userId)
    .order('year', { ascending: true })
    .order('semester', { ascending: true })
    .order('code', { ascending: true });

  if (error) {
    throw new Error(`โหลดรายการวิชาไม่สำเร็จ: ${error.message}`);
  }

  return data;
}

export async function createCourse(userId, course) {
  const codePattern = getCourseCodePattern(course.code);
  const { data: existingCourse, error: lookupError } = await supabase
    .from('courses')
    .select('id')
    .eq('user_id', userId)
    .ilike('code', codePattern)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`ตรวจสอบรหัสวิชาไม่สำเร็จ: ${lookupError.message}`);
  }

  if (existingCourse) {
    throw new Error(`รหัสวิชา ${course.code.trim()} มีอยู่ในรายการแล้ว`);
  }

  const { data, error } = await supabase
    .from('courses')
    .insert({ ...course, user_id: userId })
    .select(COURSE_COLUMNS)
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: duplicate, error: duplicateLookupError } = await supabase
        .from('courses')
        .select('id')
        .eq('user_id', userId)
        .ilike('code', codePattern)
        .limit(1)
        .maybeSingle();

      if (duplicateLookupError) {
        throw new Error(`ตรวจสอบรหัสวิชาซ้ำไม่สำเร็จ: ${duplicateLookupError.message}`);
      }

      if (duplicate) {
        throw new Error(`รหัสวิชา ${course.code.trim()} มีอยู่ในรายการแล้ว`);
      }
    }
    throw new Error(`เพิ่มรายวิชาไม่สำเร็จ: ${error.message}`);
  }

  return data;
}

export async function updateCourseStatus(userId, courseId, status) {
  const { data, error } = await supabase
    .from('courses')
    .update({ status })
    .eq('id', courseId)
    .eq('user_id', userId)
    .select(COURSE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`บันทึกสถานะวิชาไม่สำเร็จ: ${error.message}`);
  }

  return data;
}

export async function updateCourseGrade(userId, courseId, grade) {
  const { data, error } = await supabase
    .from('courses')
    .update({ grade: grade || null })
    .eq('id', courseId)
    .eq('user_id', userId)
    .select(COURSE_COLUMNS)
    .single();

  if (error) {
    throw new Error(`บันทึกเกรดไม่สำเร็จ: ${error.message}`);
  }

  return data;
}

export async function deleteCourse(userId, courseId) {
  const { data, error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error) {
    throw new Error(`ลบรายวิชาไม่สำเร็จ: ${error.message}`);
  }

  return data;
}
