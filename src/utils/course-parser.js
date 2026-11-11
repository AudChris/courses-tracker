const COURSE_CODE_PATTERN = /\b(?:[A-Z]{1,6}\s*[-.]?\s*\d{3,5}|\d{5,10})\b/i;
const SECTION_HEADING_PATTERN = /หมวด|วิชาศึกษาทั่วไป|วิชาเอก|วิชาเฉพาะ|วิชาเลือก|วิชาเสรี|general education|major courses|elective/i;

function getCourseCategory(section) {
  if (/วิชา(?:เลือก)?เสรี|หมวดเสรี|free elective/i.test(section)) return 'วิชาเสรี';
  if (/วิชาเลือก|หมวดเลือก|elective/i.test(section)) return 'วิชาเลือก';
  if (/ศึกษาทั่วไป|วิชาทั่วไป|หมวดทั่วไป|general education/i.test(section)) {
    return 'หมวดทั่วไป';
  }
  if (/วิชาเอก|วิชาเฉพาะ|วิชาแกน|major|core course/i.test(section)) {
    return 'วิชาเอก';
  }
  return 'อื่น ๆ';
}

function parseCourseLine(line, category) {
  const codeMatch = line.match(COURSE_CODE_PATTERN);
  if (!codeMatch) return null;

  const code = codeMatch[0].replace(/\s+/g, '').toUpperCase();
  let name = line.slice(codeMatch.index + codeMatch[0].length)
    .replace(/^[\s:：\-–—•|]+/, '')
    .trim();
  let credits = null;
  const creditWithUnits = name.match(
    /\s*(\d{1,2}(?:\.\d)?)\s*(?:\(\s*\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*\)|หน่วยกิต|หน่วย|credits?)\s*$/i
  );
  const trailingCredit = name.match(/\s+(\d{1,2}(?:\.\d)?)\s*$/);
  const creditMatch = creditWithUnits || trailingCredit;

  if (creditMatch) {
    const value = Number(creditMatch[1]);
    if (value >= 0 && value <= 30) {
      credits = value;
      name = name.slice(0, creditMatch.index).trim();
    }
  }

  name = name.replace(/[\s|•\-–—]+$/, '').trim();
  if (name.length < 2) return null;

  return { code, name, credits, category };
}

export function extractCoursesFromText(text) {
  const courses = [];
  const seenCodes = new Set();
  let section = '';

  String(text)
    .replace(/\u200b/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .forEach((line) => {
      if (SECTION_HEADING_PATTERN.test(line)) {
        section = line;
      }

      const course = parseCourseLine(line, getCourseCategory(section));
      if (!course || seenCodes.has(course.code)) return;
      seenCodes.add(course.code);
      courses.push(course);
    });

  return courses;
}

export function extractCourseTextForGemini(text) {
  return String(text)
    .replace(/\u200b/g, '')
    .split('\f')
    .map((page) => {
      const lines = page.split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, ' ').trim());
      const selectedLines = new Set();

      lines.forEach((line, index) => {
        if (!line) return;
        if (SECTION_HEADING_PATTERN.test(line)) selectedLines.add(index);
        if (!COURSE_CODE_PATTERN.test(line)) return;

        const previousLine = lines[index - 1];
        if (
          previousLine
          && !COURSE_CODE_PATTERN.test(previousLine)
          && !SECTION_HEADING_PATTERN.test(previousLine)
        ) {
          selectedLines.add(index - 1);
        }

        selectedLines.add(index);
        const codeMatch = line.match(COURSE_CODE_PATTERN);
        const inlineCourseName = codeMatch
          && line.slice(codeMatch.index + codeMatch[0].length).trim().length > 0;
        const followingLineLimit = inlineCourseName ? 1 : 2;
        for (let offset = 1; offset <= followingLineLimit; offset += 1) {
          const nextLine = lines[index + offset];
          if (!nextLine || COURSE_CODE_PATTERN.test(nextLine) || SECTION_HEADING_PATTERN.test(nextLine)) {
            break;
          }
          selectedLines.add(index + offset);
        }
      });

      return [...selectedLines]
        .sort((first, second) => first - second)
        .map((index) => lines[index])
        .join('\n');
    })
    .filter(Boolean)
    .join('\n\f\n');
}
