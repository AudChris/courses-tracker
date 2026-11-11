export const MAX_COURSE_TEXT_CHUNK_BYTES = 200_000;
export const MAX_COURSE_TEXT_CHUNKS = 20;

const PAGE_SEPARATOR = '\n\f\n';

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function splitByCodePoint(text) {
  const chunks = [];
  let characters = [];
  let currentBytes = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0);
    const characterBytes = codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (currentBytes + characterBytes > MAX_COURSE_TEXT_CHUNK_BYTES) {
      chunks.push(characters.join(''));
      characters = [];
      currentBytes = 0;
    }
    characters.push(character);
    currentBytes += characterBytes;
  }

  if (characters.length) chunks.push(characters.join(''));
  return chunks;
}

function splitLargePage(page) {
  const chunks = [];
  let lines = [];
  let currentBytes = 0;

  const flush = () => {
    if (!lines.length) return;
    chunks.push(lines.join(''));
    lines = [];
    currentBytes = 0;
  };

  const pageLines = page.split('\n');
  pageLines.forEach((line, index) => {
    const part = line + (index < pageLines.length - 1 ? '\n' : '');
    const partBytes = byteLength(part);

    if (partBytes > MAX_COURSE_TEXT_CHUNK_BYTES) {
      flush();
      chunks.push(...splitByCodePoint(part));
      return;
    }
    if (currentBytes + partBytes > MAX_COURSE_TEXT_CHUNK_BYTES) flush();
    lines.push(part);
    currentBytes += partBytes;
  });

  flush();
  return chunks;
}

export function splitCourseTextIntoChunks(text) {
  const chunks = [];
  let pages = [];
  let currentBytes = 0;

  const flush = () => {
    if (!pages.length) return;
    chunks.push(pages.join(PAGE_SEPARATOR));
    pages = [];
    currentBytes = 0;
  };

  for (const rawPage of String(text).split('\f')) {
    const page = rawPage.trim();
    if (!page) continue;
    const pageBytes = byteLength(page);

    if (pageBytes > MAX_COURSE_TEXT_CHUNK_BYTES) {
      flush();
      chunks.push(...splitLargePage(page));
      continue;
    }

    const separatorBytes = pages.length ? byteLength(PAGE_SEPARATOR) : 0;
    if (pages.length && currentBytes + separatorBytes + pageBytes > MAX_COURSE_TEXT_CHUNK_BYTES) {
      flush();
    }
    if (pages.length) currentBytes += byteLength(PAGE_SEPARATOR);
    pages.push(page);
    currentBytes += pageBytes;
  }

  flush();
  return chunks;
}
