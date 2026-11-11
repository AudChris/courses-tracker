import { supabase } from '../lib/supabase.js';
import { CATEGORIES } from '../config/constants.js';
import {
  MAX_COURSE_TEXT_CHUNKS,
  splitCourseTextIntoChunks
} from '../utils/course-text-chunks.js';

const MAX_COURSES = 200;

export async function extractCoursesWithGemini(text, { faculty, major, onProgress = () => {} }) {
  const chunks = splitCourseTextIntoChunks(text);
  if (chunks.length > MAX_COURSE_TEXT_CHUNKS) {
    throw new Error('ข้อความ OCR มีขนาดใหญ่มากเกินไป กรุณาแบ่ง PDF เป็นส่วนย่อยแล้วลองใหม่');
  }

  const courses = [];
  const seenCodes = new Set();

  for (const [index, chunk] of chunks.entries()) {
    const part = index + 1;
    onProgress({ part, totalParts: chunks.length });

    const { data, error } = await supabase.functions.invoke('extract-courses', {
      body: { text: chunk, faculty, major }
    });

    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try {
          const responseBody = await error.context.clone().json();
          if (typeof responseBody.error === 'string') message = responseBody.error;
        } catch {
          message = error.message;
        }
      }
      throw new Error(`เรียก Gemini ไม่สำเร็จ (ส่วน ${part}/${chunks.length}): ${message}`);
    }
    if (!Array.isArray(data?.courses) || data.courses.length > MAX_COURSES) {
      throw new Error(`Gemini ส่งผลลัพธ์รายวิชาในรูปแบบที่ไม่ถูกต้อง (ส่วน ${part}/${chunks.length})`);
    }

    const partCodes = new Set();
    const partCourses = data.courses.map((course) => {
      const code = typeof course.code === 'string' ? course.code.trim() : '';
      const name = typeof course.name === 'string' ? course.name.trim() : '';
      const category = course.category;
      const credits = course.credits;
      const normalizedCode = code.toLocaleUpperCase();

      if (
        !code
        || code.length > 30
        || !name
        || name.length > 150
        || (credits !== null && (
          typeof credits !== 'number'
          || !Number.isFinite(credits)
          || credits < 0
          || credits > 30
        ))
        || !CATEGORIES.includes(category)
        || partCodes.has(normalizedCode)
      ) {
        throw new Error('Gemini ส่งข้อมูลรายวิชาที่ไม่สมบูรณ์หรือซ้ำ กรุณาลองอ่านไฟล์อีกครั้ง');
      }

      partCodes.add(normalizedCode);
      return { code, name, credits, category };
    });

    for (const course of partCourses) {
      const normalizedCode = course.code.toLocaleUpperCase();
      if (seenCodes.has(normalizedCode)) continue;
      seenCodes.add(normalizedCode);
      courses.push(course);
      if (courses.length > MAX_COURSES) {
        throw new Error('พบรายวิชามากกว่า 200 รายการ กรุณาแบ่ง PDF ตามหมวดวิชาแล้วลองใหม่');
      }
    }
  }

  return courses;
}
