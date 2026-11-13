import './style.css';
import {
  getSession,
  onAuthStateChange,
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  updateStudentDetails
} from './services/auth.js';
import {
  createCourse,
  deleteCourse,
  getCourses,
  updateCourseGrade,
  updateCourseStatus
} from './services/courses.js';
import { getProfile } from './services/profile.js';
import { uploadStudentAvatar } from './services/avatar.js';
import { extractCoursesWithGemini } from './services/course-ai.js';
import {
  COURSE_STATUS,
  CATEGORIES,
  GRADES,
  STATUS_LABELS
} from './config/constants.js';

const app = document.querySelector('#app');
let currentSession = null;
const THEME_STORAGE_KEY = 'course-tracker-theme';
let currentTheme = getInitialTheme();

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch (error) {
    console.warn('ไม่สามารถอ่านการตั้งค่าธีมได้', error);
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function themeToggleMarkup() {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'dark' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง';
  const icon = nextTheme === 'dark' ? '☾' : '☀';
  const text = nextTheme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง';
  return `<button class="theme-toggle" type="button" data-theme-toggle aria-label="${label}" title="${label}">
    <span class="theme-toggle-icon" aria-hidden="true">${icon}</span><span>${text}</span>
  </button>`;
}

function setTheme(theme, persist = false) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn('ไม่สามารถบันทึกการตั้งค่าธีมได้', error);
    }
  }
  app.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    const label = nextTheme === 'dark' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('.theme-toggle-icon').textContent = nextTheme === 'dark' ? '☾' : '☀';
    button.lastElementChild.textContent = nextTheme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง';
  });
}

setTheme(currentTheme);

app.addEventListener('click', (event) => {
  if (!event.target.closest?.('[data-theme-toggle]')) return;
  setTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
});
let authMessage = null;
let dashboardRequest = 0;
let pendingDashboardMessage = null;
let dashboardNavigationWired = false;
let profilePromptDismissed = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function avatarMarkup(className, name, avatarUrl) {
  return `
    <span class="${className}">
      <span class="avatar-fallback">${escapeHtml(name.charAt(0).toUpperCase())}</span>
      ${avatarUrl
        ? `<img class="avatar-image" src="${escapeHtml(avatarUrl)}" alt="รูปโปรไฟล์ของ ${escapeHtml(name)}">`
        : ''}
    </span>
  `;
}

function initMotion(container, { countStats = false } = {}) {
  if (
    !container
    || !('IntersectionObserver' in window)
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const motionItems = container.querySelectorAll([
    '.auth-showcase',
    '.auth-card > .mobile-brand',
    '.auth-heading',
    '.auth-switch',
    '.auth-form',
    '.auth-divider',
    '.google-button',
    '.auth-terms',
    '.dashboard-sidebar',
    '.dashboard-header',
    '.student-card',
    '.stat-card',
    '.learning-progress-card',
    '.gpa-card',
    '.course-highlight-card',
    '.courses-panel',
    '.course-row',
    '.empty-courses',
    '.add-course-page-header',
    '.add-course-page-card'
  ].join(','));

  if (!motionItems.length) return;

  container.classList.add('motion-active');
  const items = Array.from(motionItems);
  items.forEach((item, index) => {
    item.classList.add('motion-item');
    item.style.setProperty('--motion-delay', `${Math.min(index * 55, 330)}ms`);
  });

  const animateCount = (card) => {
    if (!countStats || card.dataset.countAnimated) return;
    const value = card.querySelector('strong')?.firstChild;
    const target = Number(value?.textContent);
    if (!value || !Number.isFinite(target) || target <= 0) return;

    card.dataset.countAnimated = 'true';
    const duration = 720;
    const startedAt = performance.now();
    const frame = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - ((1 - progress) ** 3);
      value.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    };
    window.requestAnimationFrame(frame);
  };

  const observerRoot = container.matches('.dashboard-content')
    ? container
    : null;
  const observer = new IntersectionObserver((entries, activeObserver) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      target.classList.add('is-visible');
      animateCount(target);
      activeObserver.unobserve(target);
    });
  }, {
    root: observerRoot,
    rootMargin: '0px 0px -24px 0px',
    threshold: 0.08
  });

  items.forEach((item) => observer.observe(item));

  if (!window.matchMedia('(pointer: fine)').matches) return;
  const statCards = container.querySelectorAll('.stat-card');
  statCards.forEach((card) => {
    let pointerFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      pointerX = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      pointerY = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      card.dataset.pointerActive = 'true';
      if (pointerFrame) return;

      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        card.style.setProperty('--pointer-x', `${pointerX * 100}%`);
        card.style.setProperty('--pointer-y', `${pointerY * 100}%`);
        card.style.setProperty('--tilt-x', `${(0.5 - pointerY) * 3}deg`);
        card.style.setProperty('--tilt-y', `${(pointerX - 0.5) * 3}deg`);
      });
    });
    card.addEventListener('pointerleave', () => {
      if (pointerFrame) {
        window.cancelAnimationFrame(pointerFrame);
        pointerFrame = 0;
      }
      delete card.dataset.pointerActive;
    });
  });
}

function navigate(path) {
  window.history.pushState({}, '', path);
  authMessage = null;
  render();
}

function render() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (currentSession) {
    if (path !== '/dashboard' && path !== '/courses/new') {
      window.history.replaceState({}, '', '/dashboard');
      path = '/dashboard';
    }
    renderDashboard(path);
    return;
  }

  if (path === '/dashboard' || path === '/courses/new') {
    window.history.replaceState({}, '', '/login');
    path = '/login';
  }

  renderAuthPage(path === '/register' ? 'register' : 'login');
}

function renderAuthPage(mode) {
  const isRegister = mode === 'register';
  const message = authMessage
    ? `<p class="form-message ${authMessage.type}" role="${authMessage.type === 'error' ? 'alert' : 'status'}">${escapeHtml(authMessage.text)}</p>`
    : '';

  app.innerHTML = `
    <main class="auth-layout">
      <section class="auth-showcase" aria-label="เกี่ยวกับ Course Tracker">
        <a class="brand" href="/" data-route="/">
          <span class="brand-mark" aria-hidden="true"><svg class="brand-book-icon" viewBox="0 0 24 24" fill="none"><path d="M12 7.5C10.5 6.4 8.7 6 5 6v12c3.7 0 5.5.4 7 1.5m0-12C13.5 6.4 15.3 6 19 6v12c-3.7 0-5.5.4-7 1.5m0-12v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="brand-copy"><strong>Course Tracker</strong></span>
        </a>
        <div class="showcase-content">
          <p class="eyebrow">· Student life</p>
          <h1>ทุกวิชา<br>ทุกความก้าวหน้า<br><span>อยู่ในที่เดียว</span></h1>
          <p class="showcase-description">จัดการเส้นทางการเรียนของคุณอย่างเป็นระบบ แล้วไปให้ถึงเป้าหมายทีละขั้น</p>
        </div>
        <p class="showcase-footer">พื้นที่จัดการการเรียนในแบบของคุณ</p>
      </section>

      <section class="auth-panel">
        <div class="auth-card">
          <div class="auth-topbar">${themeToggleMarkup()}</div>
          <div class="mobile-brand">
            <span class="brand-mark" aria-hidden="true"><svg class="brand-book-icon" viewBox="0 0 24 24" fill="none"><path d="M12 7.5C10.5 6.4 8.7 6 5 6v12c3.7 0 5.5.4 7 1.5m0-12C13.5 6.4 15.3 6 19 6v12c-3.7 0-5.5.4-7 1.5m0-12v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <span class="brand-copy"><strong>Course Tracker</strong></span>
          </div>
          <div class="auth-heading">
            <p class="eyebrow">${isRegister ? 'เริ่มต้นเส้นทางของคุณ' : 'ยินดีต้อนรับกลับมา'}</p>
            <h2>${isRegister ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}</h2>
            <p>${isRegister ? 'สมัครสมาชิกเพื่อเริ่มติดตามการเรียนของคุณ' : 'เข้าสู่ระบบเพื่อจัดการแผนการเรียนต่อ'}</p>
          </div>

          <div class="auth-switch" aria-label="เลือกหน้าเข้าสู่ระบบหรือสมัครสมาชิก">
            <a href="/login" data-route="/login" class="${isRegister ? '' : 'active'}" ${isRegister ? '' : 'aria-current="page"'}>เข้าสู่ระบบ</a>
            <a href="/register" data-route="/register" class="${isRegister ? 'active' : ''}" ${isRegister ? 'aria-current="page"' : ''}>สมัครสมาชิก</a>
          </div>

          <form id="auth-form" class="auth-form">
            ${isRegister ? `
              <div class="register-fields">
                <div class="register-field">
                  <label for="first-name">ชื่อจริง</label>
                  <input id="first-name" name="firstName" type="text" autocomplete="given-name" placeholder="ชื่อจริง" required maxlength="80">
                </div>
                <div class="register-field">
                  <label for="last-name">นามสกุล</label>
                  <input id="last-name" name="lastName" type="text" autocomplete="family-name" placeholder="นามสกุล" required maxlength="80">
                </div>
                <div class="register-field">
                  <label for="faculty">คณะ</label>
                  <input id="faculty" name="faculty" type="text" autocomplete="organization" placeholder="ชื่อคณะ" required maxlength="120">
                </div>
                <div class="register-field">
                  <label for="major">สาขา</label>
                  <input id="major" name="major" type="text" autocomplete="off" placeholder="ชื่อสาขา" required maxlength="120">
                </div>
              </div>
            ` : ''}
            <label for="email">อีเมล</label>
            <input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
            <label for="password">รหัสผ่าน</label>
            <input id="password" name="password" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}" placeholder="${isRegister ? 'อย่างน้อย 6 ตัวอักษร' : 'กรอกรหัสผ่านของคุณ'}" minlength="6" required>
            ${isRegister ? `
              <label for="confirm-password">ยืนยันรหัสผ่าน</label>
              <input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" minlength="6" required>
            ` : `
              <button class="text-button forgot-password" id="forgot-password" type="button">ลืมรหัสผ่าน?</button>
            `}
            ${message}
            <button class="primary-button" type="submit">
              <span>${isRegister ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div class="auth-divider"><span>หรือดำเนินการต่อด้วย</span></div>
          <button class="google-button" id="google-sign-in" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.15a11 11 0 0 0 0 9.9l3.69-2.84z"/><path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0a11 11 0 0 0-9.85 6.05l3.69 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>Google</span>
          </button>
          <p class="auth-terms">การดำเนินการต่อแสดงว่าคุณยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว</p>
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll('[data-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.dataset.route);
    });
  });

  app.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
  app.querySelector('#google-sign-in').addEventListener('click', async () => {
    await runAuthAction(() => signInWithGoogle());
  });

  const forgotPasswordButton = app.querySelector('#forgot-password');
  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener('click', handlePasswordReset);
  }

  initMotion(app.querySelector('.auth-layout'));
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const email = String(values.get('email')).trim();
  const password = String(values.get('password'));

  if (window.location.pathname.replace(/\/+$/, '') === '/register') {
    const firstName = String(values.get('firstName')).trim();
    const lastName = String(values.get('lastName')).trim();
    const faculty = String(values.get('faculty')).trim();
    const major = String(values.get('major')).trim();
    const confirmPassword = String(values.get('confirmPassword'));

    if (!firstName || !lastName || !faculty || !major) {
      setMessage('error', 'กรุณากรอกชื่อจริง นามสกุล คณะ และสาขาให้ครบถ้วน');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('error', 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    await runAuthAction(async () => {
      const data = await signUp({
        email,
        password,
        firstName,
        lastName,
        faculty,
        major
      });
      if (!data.session) {
        setMessage('success', 'สมัครสมาชิกสำเร็จแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี');
      }
    });
    return;
  }

  await runAuthAction(() => signIn({ email, password }));
}

async function handlePasswordReset() {
  const email = app.querySelector('#email').value.trim();
  if (!email) {
    setMessage('error', 'กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน');
    app.querySelector('#email').focus();
    return;
  }

  await runAuthAction(async () => {
    await resetPassword(email);
    setMessage('success', 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว');
  });
}

async function runAuthAction(action) {
  const submitButton = app.querySelector('.primary-button');
  const googleButton = app.querySelector('#google-sign-in');
  if (submitButton) submitButton.disabled = true;
  if (googleButton) googleButton.disabled = true;
  clearMessage();

  try {
    await action();
  } catch (error) {
    setMessage('error', error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false;
    if (googleButton?.isConnected) googleButton.disabled = false;
  }
}

function setMessage(type, text) {
  authMessage = { type, text };
  const form = app.querySelector('#auth-form');
  if (!form) return;

  form.querySelector('.form-message')?.remove();
  const message = document.createElement('p');
  message.className = `form-message ${type}`;
  message.setAttribute('role', type === 'error' ? 'alert' : 'status');
  message.textContent = text;
  form.insertBefore(message, form.querySelector('.primary-button'));
}

function clearMessage() {
  authMessage = null;
  const message = app.querySelector('.form-message');
  if (message) message.remove();
}

async function renderDashboard(path = '/dashboard') {
  const requestId = ++dashboardRequest;
  const user = currentSession.user;
  app.innerHTML = `
    <main class="dashboard-page">
      <aside class="dashboard-sidebar">
        <a class="brand" href="/" data-dashboard-home>
          <span class="brand-mark" aria-hidden="true"><svg class="brand-book-icon" viewBox="0 0 24 24" fill="none"><path d="M12 7.5C10.5 6.4 8.7 6 5 6v12c3.7 0 5.5.4 7 1.5m0-12C13.5 6.4 15.3 6 19 6v12c-3.7 0-5.5.4-7 1.5m0-12v12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span class="brand-copy"><strong>Course Tracker</strong></span>
        </a>
        <div class="sidebar-label">เมนูหลัก</div>
        <a class="sidebar-link ${path === '/dashboard' ? 'active' : ''}" href="/dashboard" data-dashboard-route="/dashboard" ${path === '/dashboard' ? 'aria-current="page"' : ''}>
          <span aria-hidden="true">▦</span> ภาพรวม
        </a>
        <a class="sidebar-link ${path === '/courses/new' ? 'active' : ''}" href="/courses/new" data-dashboard-route="/courses/new" ${path === '/courses/new' ? 'aria-current="page"' : ''}>
          <span aria-hidden="true">＋</span> เพิ่มรายวิชา
        </a>
        <div class="sidebar-bottom">
          <div class="sidebar-user">
            ${avatarMarkup(
              'user-avatar',
              user.user_metadata?.first_name || user.email || 'S',
              user.user_metadata?.avatar_url || user.user_metadata?.picture
            )}
            <span class="sidebar-user-copy"><strong>${escapeHtml(user.email || 'นักศึกษา')}</strong><small>บัญชีนักศึกษา</small></span>
          </div>
          <button id="sign-out" class="sidebar-sign-out" type="button">ออกจากระบบ <span aria-hidden="true">↗</span></button>
        </div>
      </aside>
      <section class="dashboard-content">
        <header class="dashboard-header">
          <div>
            <p class="eyebrow">พื้นที่จัดการการเรียนของคุณ</p>
            <h1>ภาพรวมการเรียน</h1>
          </div>
          <div class="dashboard-header-tools">
            ${themeToggleMarkup()}
            <div class="dashboard-date">${new Intl.DateTimeFormat('th-TH', {
              dateStyle: 'long'
            }).format(new Date())}</div>
          </div>
        </header>
        <div class="dashboard-loading" role="status">
          <span class="loading-spinner" aria-hidden="true"></span>
          <span>กำลังโหลดข้อมูล Dashboard...</span>
        </div>
      </section>
    </main>
  `;
  wireDashboardNavigation();
  wireAvatarFallbacks();
  app.querySelector('#sign-out').addEventListener('click', handleSignOut);
  try {
    if (path === '/courses/new') {
      const [profile, courses] = await Promise.all([
        getProfile(user.id),
        getCourses(user.id)
      ]);
      if (requestId !== dashboardRequest || !currentSession) return;
      renderAddCoursePage(profile, courses);
      return;
    }

    const [profile, courses] = await Promise.all([
      getProfile(user.id),
      getCourses(user.id)
    ]);

    if (requestId !== dashboardRequest || !currentSession) return;
    renderDashboardContent(profile, courses, path);
  } catch (error) {
    if (requestId !== dashboardRequest || !currentSession) return;
    app.querySelector('.dashboard-loading')?.remove();
    app.querySelector('.dashboard-content').insertAdjacentHTML(
      'beforeend',
      `<div class="dashboard-error" role="alert">
        <p>${escapeHtml(error.message || 'โหลด Dashboard ไม่สำเร็จ')}</p>
        <button id="retry-dashboard" class="secondary-button" type="button">ลองอีกครั้ง</button>
      </div>`
    );
    app.querySelector('#retry-dashboard').addEventListener(
      'click',
      () => renderDashboard(path)
    );
  }
}

function renderDashboardContent(profile, courses, path = '/dashboard') {
  const user = currentSession.user;
  const profileData = getStudentDetails(profile, user);
  const { name, faculty, major } = profileData;
  const normalizeStatus = (course) => course.status || COURSE_STATUS.NOT_STARTED;
  const completed = courses.filter(
    (course) => normalizeStatus(course) === COURSE_STATUS.COMPLETED
  ).length;
  const inProgress = courses.filter(
    (course) => normalizeStatus(course) === COURSE_STATUS.IN_PROGRESS
  ).length;
  const notStarted = courses.filter(
    (course) => normalizeStatus(course) === COURSE_STATUS.NOT_STARTED
  ).length;
  const creditsForStatus = (status) => courses.reduce((total, course) => {
    const courseStatus = normalizeStatus(course);
    return courseStatus === status
      ? total + (Number(course.credits) || 0)
      : total;
  }, 0);
  const totalCredits = courses.reduce(
    (total, course) => total + (Number(course.credits) || 0),
    0
  );
  const completedCredits = creditsForStatus(COURSE_STATUS.COMPLETED);
  const progressPercent = totalCredits
    ? Math.round((completedCredits / totalCredits) * 100)
    : 0;
  const gradePoints = {
    A: 4,
    'B+': 3.5,
    B: 3,
    'C+': 2.5,
    C: 2,
    'D+': 1.5,
    D: 1,
    F: 0
  };
  const gradedCourses = courses.filter((course) => (
    normalizeStatus(course) === COURSE_STATUS.COMPLETED
    && Object.hasOwn(gradePoints, String(course.grade || '').trim().toUpperCase())
    && Number(course.credits) > 0
  ));
  const gpaCredits = gradedCourses.reduce(
    (total, course) => total + Number(course.credits),
    0
  );
  const gpa = gpaCredits
    ? gradedCourses.reduce((total, course) => (
      total + gradePoints[String(course.grade).trim().toUpperCase()] * Number(course.credits)
    ), 0) / gpaCredits
    : null;
  const missingGradeCount = courses.filter((course) => (
    normalizeStatus(course) === COURSE_STATUS.COMPLETED
    && !String(course.grade || '').trim()
  )).length;
  const getGpaForYear = (year) => {
    const yearCourses = gradedCourses.filter(
      (course) => String(course.year) === String(year)
    );
    const yearCredits = yearCourses.reduce(
      (total, course) => total + Number(course.credits),
      0
    );
    return yearCredits
      ? yearCourses.reduce((total, course) => (
        total + gradePoints[String(course.grade).trim().toUpperCase()] * Number(course.credits)
      ), 0) / yearCredits
      : null;
  };
  const years = [...new Set(courses.map((course) => course.year).filter(Boolean))]
    .sort((first, second) => Number(first) - Number(second));
  const categories = [...new Set(courses.map((course) => course.category).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'th'));
  const semesters = [...new Set(courses.map((course) => course.semester).filter(Boolean))]
    .sort((first, second) => Number(first) - Number(second));
  const recentlyAddedCourses = [...courses]
    .sort((first, second) => (
      new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    ))
    .slice(0, 4);
  const renderCoursePreview = (list, emptyMessage) => list.length
    ? `<ul class="course-preview-list">${list.map((course) => `
        <li>
          <span class="course-preview-copy">
            <strong>${escapeHtml(course.name || course.code || 'ไม่ระบุชื่อวิชา')}</strong>
            <small>${escapeHtml(course.code || '—')} · ${Number(course.credits) || 0} หน่วยกิต</small>
          </span>
          <span class="preview-status status-${escapeHtml(normalizeStatus(course))}">${escapeHtml(STATUS_LABELS[normalizeStatus(course)] || normalizeStatus(course))}</span>
        </li>
      `).join('')}</ul>`
    : `<p class="course-preview-empty">${emptyMessage}</p>`;
  const coursesInProgress = courses.filter(
    (course) => normalizeStatus(course) === COURSE_STATUS.IN_PROGRESS
  ).slice(0, 4);
  const coursesNotStarted = courses.filter(
    (course) => normalizeStatus(course) === COURSE_STATUS.NOT_STARTED
  ).slice(0, 4);

  app.querySelector('.dashboard-content').innerHTML = `
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">พื้นที่จัดการการเรียนของคุณ</p>
        <h1>สวัสดี, ${escapeHtml(name)}</h1>
        <p class="dashboard-subtitle">นี่คือภาพรวมความก้าวหน้าในการเรียนของคุณ</p>
      </div>
      <div class="dashboard-header-tools">
        ${themeToggleMarkup()}
        <div class="dashboard-date">${new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'long'
        }).format(new Date())}</div>
      </div>
    </header>

    <section class="student-card" aria-label="ข้อมูลนักศึกษา">
      ${avatarMarkup(
        'student-avatar',
        name,
        user.user_metadata?.avatar_url || user.user_metadata?.picture
      )}
      <div class="student-info">
        <span>นักศึกษา</span>
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(user.email || '')}</small>
      </div>
      <div class="student-divider"></div>
      <div class="faculty-info">
        <span class="faculty-icon" aria-hidden="true">⌂</span>
        <span><small>คณะ</small><strong>${escapeHtml(faculty)}</strong></span>
      </div>
      <div class="major-info">
        <span class="major-icon" aria-hidden="true">⌖</span>
        <span><small>สาขา</small><strong>${escapeHtml(major)}</strong></span>
      </div>
      <span class="student-badge">กำลังติดตามการเรียน</span>
      <button id="edit-student-details" class="edit-student-details" type="button">
        <span aria-hidden="true">✎</span> แก้ไขข้อมูล
      </button>
    </section>

    <section class="course-stats" aria-label="สรุปสถานะวิชา">
      <article class="stat-card" data-stat="total">
        <span class="stat-icon total" aria-hidden="true">▤</span>
        <span class="stat-label">วิชาทั้งหมด</span>
        <strong>${courses.length}<small> วิชา</small></strong>
        <span class="stat-credits">${totalCredits} <small>หน่วยกิต</small></span>
      </article>
      <article class="stat-card" data-stat="completed">
        <span class="stat-icon completed" aria-hidden="true">✓</span>
        <span class="stat-label">เรียนแล้ว</span>
        <strong>${completed}<small> วิชา</small></strong>
        <span class="stat-credits">${creditsForStatus(COURSE_STATUS.COMPLETED)} <small>หน่วยกิต</small></span>
      </article>
      <article class="stat-card" data-stat="in-progress">
        <span class="stat-icon progress" aria-hidden="true">◷</span>
        <span class="stat-label">กำลังเรียน</span>
        <strong>${inProgress}<small> วิชา</small></strong>
        <span class="stat-credits">${creditsForStatus(COURSE_STATUS.IN_PROGRESS)} <small>หน่วยกิต</small></span>
      </article>
      <article class="stat-card" data-stat="not-started">
        <span class="stat-icon pending" aria-hidden="true">○</span>
        <span class="stat-label">ยังไม่ได้เรียน</span>
        <strong>${notStarted}<small> วิชา</small></strong>
        <span class="stat-credits">${creditsForStatus(COURSE_STATUS.NOT_STARTED)} <small>หน่วยกิต</small></span>
      </article>
    </section>

    <section class="learning-overview" aria-label="ความคืบหน้าและเกรด">
      <article class="learning-progress-card" id="learning-progress">
        <div class="learning-progress-heading">
          <div>
            <p class="eyebrow">ความคืบหน้าการเรียน</p>
            <h2>${progressPercent}% <span>ของหน่วยกิตในรายการที่เรียนจบแล้ว</span></h2>
          </div>
          <strong>${completedCredits} <small>/ ${totalCredits} หน่วยกิต</small></strong>
        </div>
        <div class="learning-progress-track" role="progressbar" aria-label="ความคืบหน้าหน่วยกิตวิชาที่ติดตาม" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
          <span style="width: ${progressPercent}%"></span>
        </div>
        <p>คำนวณจาก ${courses.length} วิชาที่เพิ่มไว้ ไม่ใช่หน่วยกิตรวมตามหลักสูตร</p>
      </article>
      <article class="gpa-card">
        <div class="gpa-heading">
          <div>
            <p class="eyebrow">ผลการเรียน</p>
            <h2>${gpa === null ? 'ยังคำนวณไม่ได้' : gpa.toFixed(2)} <span>${gpa === null ? '' : '/ 4.00'}</span></h2>
          </div>
          <span class="gpa-icon" aria-hidden="true">★</span>
        </div>
        <p>${gpa === null
          ? 'เพิ่มเกรด A–F ให้กับวิชาที่เรียนจบแล้วเพื่อคำนวณ GPA'
          : `คำนวณจาก ${gpaCredits} หน่วยกิตที่มีเกรด (ไม่นับ S/U)`}</p>
        ${years.length
          ? `<div class="year-gpa-list">${years.map((year) => {
            const yearGpa = getGpaForYear(year);
            return `<span>ปี ${escapeHtml(year)}: <strong>${yearGpa === null ? '—' : yearGpa.toFixed(2)}</strong></span>`;
          }).join('')}</div>`
          : ''}
        ${missingGradeCount
          ? `<small class="grade-reminder">ยังไม่ได้กรอกเกรด ${missingGradeCount} วิชา</small>`
          : ''}
      </article>
    </section>

    <section class="course-highlights" aria-label="วิชาที่ควรติดตาม">
      <article class="course-highlight-card">
        <div class="highlight-heading">
          <div><p class="eyebrow">ติดตามต่อ</p><h2>กำลังเรียน <span>${inProgress}</span></h2></div>
          <a href="#course-list" class="text-link">ดูทั้งหมด</a>
        </div>
        ${renderCoursePreview(coursesInProgress, 'ยังไม่มีวิชาที่กำลังเรียน')}
      </article>
      <article class="course-highlight-card">
        <div class="highlight-heading">
          <div><p class="eyebrow">ขั้นตอนถัดไป</p><h2>ยังไม่ได้เรียน <span>${notStarted}</span></h2></div>
          <a href="#course-list" class="text-link">ดูทั้งหมด</a>
        </div>
        ${renderCoursePreview(coursesNotStarted, 'ไม่มีวิชาค้างในรายการ')}
      </article>
      <article class="course-highlight-card">
        <div class="highlight-heading">
          <div><p class="eyebrow">อัปเดตรายการ</p><h2>เพิ่มล่าสุด</h2></div>
          <a href="#course-list" class="text-link">ดูทั้งหมด</a>
        </div>
        ${renderCoursePreview(recentlyAddedCourses, 'ยังไม่มีวิชาในรายการ')}
      </article>
    </section>

    <section class="courses-panel" id="course-list">
      <div class="courses-heading">
        <div>
          <p class="eyebrow">รายการรายวิชา</p>
          <h2>สถานะวิชาของฉัน <span>${courses.length}</span></h2>
        </div>
        <div class="course-actions">
          <label class="course-search">
            <span aria-hidden="true">⌕</span>
            <input id="course-search" type="search" placeholder="ค้นหารหัสหรือชื่อวิชา" aria-label="ค้นหารหัสหรือชื่อวิชา">
          </label>
          <button class="clear-course-filters" id="clear-course-filters" type="button">ล้างตัวกรอง</button>
          <button class="select-courses-button" id="toggle-course-selection" type="button" aria-pressed="false" ${courses.length ? '' : 'disabled'}>เลือกวิชา</button>
          <button class="delete-selected-courses-button" id="delete-selected-courses" type="button" disabled hidden>ลบที่เลือก (0)</button>
          <a class="add-course-button" href="/courses/new" data-dashboard-route="/courses/new">
            <span aria-hidden="true">＋</span> เพิ่มรายวิชา
          </a>
        </div>
      </div>
      <div class="course-filters" aria-label="ตัวกรองรายวิชา">
        <div class="status-filter-group" role="group" aria-label="กรองตามสถานะ">
          <button type="button" class="status-filter active" data-status-filter="all" aria-pressed="true">ทั้งหมด</button>
          <button type="button" class="status-filter" data-status-filter="completed" aria-pressed="false">เรียนแล้ว</button>
          <button type="button" class="status-filter" data-status-filter="in_progress" aria-pressed="false">กำลังเรียน</button>
          <button type="button" class="status-filter" data-status-filter="not_started" aria-pressed="false">ยังไม่ได้เรียน</button>
        </div>
        <label class="course-filter-select">ชั้นปี
          <select id="year-filter" aria-label="กรองตามชั้นปี">
            <option value="">ทุกชั้นปี</option>
            ${years.map((year) => `<option value="${escapeHtml(year)}">ปี ${escapeHtml(year)}</option>`).join('')}
          </select>
        </label>
        <label class="course-filter-select">ภาคเรียน
          <select id="semester-filter" aria-label="กรองตามภาคเรียน">
            <option value="">ทุกภาคเรียน</option>
            ${semesters.map((semester) => `<option value="${escapeHtml(semester)}">เทอม ${escapeHtml(semester)}</option>`).join('')}
          </select>
        </label>
        <label class="course-filter-select">หมวดวิชา
          <select id="category-filter" aria-label="กรองตามหมวดวิชา">
            <option value="">ทุกหมวดวิชา</option>
            ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}
          </select>
        </label>
      </div>
      ${courses.length
        ? `<div class="course-table-wrap">
            <table class="course-table">
              <thead><tr><th class="course-selection-cell"><input id="select-all-courses" class="select-all-courses-checkbox" type="checkbox" aria-label="เลือกวิชาที่แสดงทั้งหมด"></th><th>เรียนแล้ว</th><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>หมวดวิชา</th><th>หน่วยกิต</th><th>เกรด</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
              <tbody id="course-rows">${courses.map(renderCourseRow).join('')}</tbody>
            </table>
          </div>
          <p id="no-search-results" class="no-search-results" hidden>ไม่พบวิชาที่ตรงกับตัวกรอง</p>`
        : `<div class="empty-courses">
            <span class="empty-course-icon" aria-hidden="true">▤</span>
            <h3>ยังไม่มีรายวิชาในรายการ</h3>
            <p>เมื่อมีรายวิชาผูกกับบัญชีนี้ รายการและสถานะจะแสดงที่นี่</p>
          </div>`
      }
    </section>
    <p id="dashboard-message" class="dashboard-message" role="status" hidden></p>
    <dialog class="course-dialog student-profile-dialog" id="student-profile-dialog" aria-labelledby="student-profile-title">
      <form id="student-profile-form" class="course-form">
        <div class="dialog-heading">
          <div>
            <p class="eyebrow">ข้อมูลนักศึกษา</p>
            <h2 id="student-profile-title">กรอกข้อมูลให้ครบถ้วน</h2>
            <p class="profile-dialog-description">ข้อมูลนี้จะแสดงบน Dashboard ของคุณ</p>
          </div>
          <button class="dialog-close" type="button" aria-label="ปิดหน้าต่าง">×</button>
        </div>
        <div class="avatar-upload">
          ${avatarMarkup(
            'avatar-preview',
            name,
            user.user_metadata?.avatar_url || user.user_metadata?.picture
          )}
          <div class="avatar-upload-copy">
            <label class="avatar-file-button" for="profile-avatar">เปลี่ยนรูปโปรไฟล์</label>
            <input id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp">
            <small>JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</small>
          </div>
        </div>
        <div class="course-form-grid">
          <div class="form-field">
            <label for="profile-first-name">ชื่อจริง <span>*</span></label>
            <input id="profile-first-name" name="firstName" type="text" autocomplete="given-name" maxlength="80" value="${escapeHtml(profileData.firstName)}" required>
          </div>
          <div class="form-field">
            <label for="profile-last-name">นามสกุล <span>*</span></label>
            <input id="profile-last-name" name="lastName" type="text" autocomplete="family-name" maxlength="80" value="${escapeHtml(profileData.lastName)}" required>
          </div>
          <div class="form-field">
            <label for="profile-faculty">คณะ <span>*</span></label>
            <input id="profile-faculty" name="faculty" type="text" autocomplete="organization" maxlength="120" value="${escapeHtml(profileData.faculty === 'ยังไม่ได้ระบุคณะ' ? '' : profileData.faculty)}" required>
          </div>
          <div class="form-field">
            <label for="profile-major">สาขา <span>*</span></label>
            <input id="profile-major" name="major" type="text" maxlength="120" value="${escapeHtml(profileData.major === 'ยังไม่ได้ระบุสาขา' ? '' : profileData.major)}" required>
          </div>
        </div>
        <p id="student-profile-message" class="form-message error" role="alert" hidden></p>
        <div class="dialog-actions">
          <button class="cancel-course-button" type="button">ไว้ทีหลัง</button>
          <button class="submit-course-button" type="submit"><span>บันทึกข้อมูล</span><span aria-hidden="true">→</span></button>
        </div>
      </form>
    </dialog>
  `;

  wireDashboardNavigation();
  wireAvatarFallbacks();
  const profileDialog = app.querySelector('#student-profile-dialog');
  const closeProfileDialog = () => profileDialog.close();
  app.querySelector('#edit-student-details').addEventListener('click', () => {
    profileDialog.showModal();
    app.querySelector('#profile-first-name').focus();
  });
  app.querySelector('.student-profile-dialog .dialog-close')
    .addEventListener('click', closeProfileDialog);
  app.querySelector('.student-profile-dialog .cancel-course-button')
    .addEventListener('click', closeProfileDialog);
  app.querySelector('#student-profile-form')
    .addEventListener('submit', handleStudentDetailsSubmit);
  app.querySelector('#profile-avatar').addEventListener('change', handleAvatarSelection);
  profileDialog.addEventListener('close', () => {
    profilePromptDismissed = true;
    releaseAvatarPreview();
  });
  const hasMissingDetails = !profileData.firstName
    || !profileData.lastName
    || faculty === 'ยังไม่ได้ระบุคณะ'
    || major === 'ยังไม่ได้ระบุสาขา';
  if (hasMissingDetails && !profilePromptDismissed) {
    profileDialog.showModal();
  }
  if (pendingDashboardMessage) {
    showDashboardMessage(pendingDashboardMessage.text, pendingDashboardMessage.type);
    pendingDashboardMessage = null;
  }
  const applyCourseFilters = () => {
    const query = app.querySelector('#course-search')?.value.trim().toLocaleLowerCase() || '';
    const year = app.querySelector('#year-filter')?.value || '';
    const semester = app.querySelector('#semester-filter')?.value || '';
    const category = app.querySelector('#category-filter')?.value || '';
    const activeStatus = app.querySelector('.status-filter.active')?.dataset.statusFilter || 'all';
    let visibleCount = 0;

    app.querySelectorAll('.course-row').forEach((row) => {
      const matches = row.dataset.search.includes(query)
        && (!year || row.dataset.year === year)
        && (!semester || row.dataset.semester === semester)
        && (!category || row.dataset.category === category)
        && (activeStatus === 'all' || row.dataset.status === activeStatus);
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    const noResults = app.querySelector('#no-search-results');
    if (noResults) noResults.hidden = visibleCount > 0;
    updateSelectedCount();
  };
  ['#course-search', '#year-filter', '#semester-filter', '#category-filter']
    .forEach((selector) => {
      app.querySelector(selector)?.addEventListener('input', applyCourseFilters);
      app.querySelector(selector)?.addEventListener('change', applyCourseFilters);
    });
  app.querySelectorAll('.status-filter').forEach((button) => {
    button.addEventListener('click', () => {
      app.querySelectorAll('.status-filter').forEach((filterButton) => {
        const isActive = filterButton === button;
        filterButton.classList.toggle('active', isActive);
        filterButton.setAttribute('aria-pressed', String(isActive));
      });
      applyCourseFilters();
    });
  });
  app.querySelector('#clear-course-filters')?.addEventListener('click', () => {
    app.querySelector('#course-search').value = '';
    app.querySelector('#year-filter').value = '';
    app.querySelector('#semester-filter').value = '';
    app.querySelector('#category-filter').value = '';
    app.querySelector('.status-filter[data-status-filter="all"]')?.click();
  });
  const courseTable = app.querySelector('.course-table');
  const selectionToggle = app.querySelector('#toggle-course-selection');
  const deleteSelectedButton = app.querySelector('#delete-selected-courses');
  const updateSelectedCount = () => {
    if (!deleteSelectedButton) return;
    const selectedCount = app.querySelectorAll('.course-selection-checkbox:checked').length;
    deleteSelectedButton.textContent = `ลบที่เลือก (${selectedCount})`;
    deleteSelectedButton.disabled = selectedCount === 0;
    const visibleCheckboxes = [...app.querySelectorAll(
      '.course-row:not([hidden]) .course-selection-checkbox'
    )];
    const selectedVisibleCount = visibleCheckboxes
      .filter((checkbox) => checkbox.checked).length;
    const selectAllCheckbox = app.querySelector('#select-all-courses');
    if (!selectAllCheckbox) return;
    selectAllCheckbox.checked = visibleCheckboxes.length > 0
      && selectedVisibleCount === visibleCheckboxes.length;
    selectAllCheckbox.indeterminate = selectedVisibleCount > 0
      && selectedVisibleCount < visibleCheckboxes.length;
  };
  selectionToggle?.addEventListener('click', () => {
    const isSelecting = selectionToggle.getAttribute('aria-pressed') !== 'true';
    courseTable?.classList.toggle('selection-mode', isSelecting);
    selectionToggle.setAttribute('aria-pressed', String(isSelecting));
    selectionToggle.textContent = isSelecting ? 'ยกเลิกเลือก' : 'เลือกวิชา';
    if (deleteSelectedButton) deleteSelectedButton.hidden = !isSelecting;
    if (!isSelecting) {
      app.querySelectorAll('.course-selection-checkbox').forEach((checkbox) => {
        checkbox.checked = false;
      });
    }
    updateSelectedCount();
  });
  app.querySelectorAll('.course-selection-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', updateSelectedCount);
  });
  app.querySelector('#select-all-courses')?.addEventListener('change', (event) => {
    const isChecked = event.currentTarget.checked;
    app.querySelectorAll('.course-row:not([hidden]) .course-selection-checkbox')
      .forEach((checkbox) => {
        checkbox.checked = isChecked;
      });
    updateSelectedCount();
  });
  deleteSelectedButton?.addEventListener('click', async () => {
    const selectedCourses = [...app.querySelectorAll('.course-selection-checkbox:checked')]
      .map((checkbox) => ({
        id: checkbox.dataset.courseId,
        name: checkbox.dataset.courseName
      }));
    if (!selectedCourses.length) return;

    const shouldDelete = window.confirm(
      `ยืนยันลบ ${selectedCourses.length} วิชาที่เลือกหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );
    if (!shouldDelete) return;

    deleteSelectedButton.disabled = true;
    if (selectionToggle) selectionToggle.disabled = true;
    const selectAllCheckbox = app.querySelector('#select-all-courses');
    if (selectAllCheckbox) selectAllCheckbox.disabled = true;
    app.querySelectorAll('.course-selection-checkbox').forEach((checkbox) => {
      checkbox.disabled = true;
    });

    let deletedCount = 0;
    for (const course of selectedCourses) {
      try {
        await deleteCourse(user.id, course.id);
        deletedCount += 1;
      } catch (error) {
        pendingDashboardMessage = {
          text: `ลบสำเร็จ ${deletedCount}/${selectedCourses.length} วิชา แต่ลบ "${course.name}" ไม่สำเร็จ: ${error.message || 'กรุณาลองอีกครั้ง'}`,
          type: 'error'
        };
        await renderDashboard();
        return;
      }
    }

    pendingDashboardMessage = {
      text: `ลบ ${deletedCount} วิชาที่เลือกแล้ว`,
      type: 'success'
    };
    await renderDashboard();
  });
  initMotion(app.querySelector('.dashboard-page'), { countStats: true });

  app.querySelectorAll('.course-status-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const previousStatus = select.dataset.status;
      const checkbox = select.closest('.course-row')
        .querySelector('.course-complete-checkbox');
      select.disabled = true;
      checkbox.disabled = true;
      try {
        const updatedCourse = await updateCourseStatus(
          user.id,
          select.dataset.courseId,
          select.value
        );
        select.dataset.status = updatedCourse.status;
        select.value = updatedCourse.status;
        select.className = `course-status-select status-${updatedCourse.status}`;
        select.closest('.course-row').dataset.status = updatedCourse.status;
        checkbox.checked = updatedCourse.status === COURSE_STATUS.COMPLETED;
        pendingDashboardMessage = {
          text: 'บันทึกสถานะวิชาแล้ว',
          type: 'success'
        };
        await renderDashboard();
      } catch (error) {
        select.value = previousStatus;
        checkbox.checked = previousStatus === COURSE_STATUS.COMPLETED;
        showDashboardMessage(
          error.message || 'บันทึกสถานะวิชาไม่สำเร็จ',
          'error'
        );
      } finally {
        if (select.isConnected) select.disabled = false;
        if (checkbox.isConnected) checkbox.disabled = false;
      }
    });
  });

  app.querySelectorAll('.course-grade-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const previousGrade = select.dataset.grade;
      select.disabled = true;
      try {
        const updatedCourse = await updateCourseGrade(
          user.id,
          select.dataset.courseId,
          select.value
        );
        select.dataset.grade = updatedCourse.grade || '';
        pendingDashboardMessage = {
          text: 'บันทึกเกรดแล้ว',
          type: 'success'
        };
        await renderDashboard();
      } catch (error) {
        select.value = previousGrade;
        showDashboardMessage(
          error.message || 'บันทึกเกรดไม่สำเร็จ กรุณาลองอีกครั้ง',
          'error'
        );
      } finally {
        if (select.isConnected) select.disabled = false;
      }
    });
  });

  app.querySelectorAll('.course-complete-checkbox').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const select = checkbox.closest('.course-row').querySelector('.course-status-select');
      select.value = checkbox.checked
        ? COURSE_STATUS.COMPLETED
        : COURSE_STATUS.NOT_STARTED;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  app.querySelectorAll('.course-delete-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const courseName = button.dataset.courseName;
      const shouldDelete = window.confirm(
        `ยืนยันลบรายวิชา "${courseName}" หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
      );
      if (!shouldDelete) return;

      button.disabled = true;
      try {
        await deleteCourse(user.id, button.dataset.courseId);
        pendingDashboardMessage = {
          text: `ลบรายวิชา "${courseName}" แล้ว`,
          type: 'success'
        };
        await renderDashboard();
      } catch (error) {
        button.disabled = false;
        showDashboardMessage(
          error.message || 'ลบรายวิชาไม่สำเร็จ กรุณาลองอีกครั้ง',
          'error'
        );
      }
    });
  });
}

function getStudentDetails(profile, user) {
  const metadata = user.user_metadata || {};
  const firstName = metadata.first_name || profile?.first_name || '';
  const lastName = metadata.last_name || profile?.last_name || '';
  const name = [firstName, lastName].filter(Boolean).join(' ')
    || profile?.display_name
    || profile?.full_name
    || profile?.name
    || metadata.display_name
    || user.email?.split('@')[0]
    || 'นักศึกษา';

  return {
    name,
    firstName,
    lastName,
    faculty: metadata.faculty || profile?.faculty || 'ยังไม่ได้ระบุคณะ',
    major: metadata.major || profile?.major || profile?.department || 'ยังไม่ได้ระบุสาขา'
  };
}

function renderAddCoursePage(profile, existingCourses) {
  const user = currentSession.user;
  const { name, faculty, major } = getStudentDetails(profile, user);
  const existingCodes = new Set(
    existingCourses.map((course) => String(course.code || '').trim().toLocaleUpperCase())
  );

  app.querySelector('.dashboard-content').innerHTML = `
    <header class="dashboard-header add-course-page-header">
      <div>
        <p class="eyebrow">จัดการข้อมูลการเรียน</p>
        <h1>เพิ่มรายวิชา</h1>
        <p class="dashboard-subtitle">กรอกรายละเอียดรายวิชาที่ต้องการเพิ่มในแผนการเรียน</p>
      </div>
      <div class="dashboard-header-tools">
        ${themeToggleMarkup()}
        <a class="back-to-dashboard" href="/dashboard" data-dashboard-route="/dashboard">
          <span aria-hidden="true">←</span> กลับภาพรวม
        </a>
      </div>
    </header>
    <section class="add-course-page-card">
      <div class="add-course-card-heading">
        <span class="add-course-card-icon" aria-hidden="true">＋</span>
        <div>
          <h2>รายละเอียดรายวิชา</h2>
          <p>วิชานี้จะถูกบันทึกในบัญชีของ ${escapeHtml(name)}</p>
        </div>
      </div>
      <section class="pdf-course-import" aria-labelledby="pdf-course-import-title">
        <div class="pdf-import-copy">
          <h3 id="pdf-course-import-title">นำเข้าวิชาจาก PDF ด้วย OCR</h3>
          <p>อ่าน PDF หลักสูตรได้สูงสุด 300 หน้า (ไฟล์ไม่เกิน 20 MB) แล้วตรวจสอบรายการก่อนเพิ่ม ทั้งนี้เอกสารที่มีแต่ภาพอาจใช้เวลา OCR นาน</p>
          <small>${escapeHtml(faculty)} · ${escapeHtml(major)}</small>
        </div>
        <input id="course-pdf" class="visually-hidden-file" type="file" accept="application/pdf,.pdf">
        <label class="pdf-file-button" for="course-pdf">เลือกไฟล์ PDF</label>
        <p class="pdf-import-privacy">ไฟล์ PDF อ่านในเบราว์เซอร์ แล้วส่งเฉพาะบรรทัดที่น่าจะเป็นรายวิชาพร้อมบริบทให้ Gemini วิเคราะห์</p>
        <p id="pdf-import-message" class="form-message" role="status" hidden></p>
        <button id="pdf-basic-fallback" class="pdf-fallback-button" type="button" hidden>ใช้ผล OCR พื้นฐานแทน</button>
        <div id="pdf-course-preview" class="pdf-course-preview" hidden></div>
      </section>
      <form id="add-course-form" class="course-form">
        <div class="course-form-grid">
          <div class="form-field">
            <label for="course-code">รหัสวิชา <span>*</span></label>
            <input id="course-code" name="code" type="text" maxlength="30" placeholder="เช่น CS101" required>
          </div>
          <div class="form-field">
            <label for="course-name">ชื่อวิชา <span>*</span></label>
            <input id="course-name" name="name" type="text" maxlength="150" placeholder="ชื่อรายวิชา" required>
          </div>
          <div class="form-field">
            <label for="course-credits">หน่วยกิต <span>*</span></label>
            <input id="course-credits" name="credits" type="number" min="0" max="30" step="0.5" placeholder="3" required>
          </div>
          <div class="form-field">
            <label for="course-category">หมวดวิชา <span>*</span></label>
            <select id="course-category" name="category" required>
              <option value="">เลือกหมวดวิชา</option>
              ${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="course-year">ชั้นปี <span>*</span></label>
            <input id="course-year" name="year" type="number" min="1" max="20" step="1" placeholder="1" required>
          </div>
          <div class="form-field">
            <label for="course-semester">ภาคเรียน <span>*</span></label>
            <input id="course-semester" name="semester" type="number" min="1" max="3" step="1" placeholder="1" required>
          </div>
          <div class="form-field">
            <label for="course-status">สถานะ</label>
            <select id="course-status" name="status">
              ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === COURSE_STATUS.NOT_STARTED ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="course-grade">เกรด (ถ้ามี)</label>
            <input id="course-grade" name="grade" type="text" maxlength="3" placeholder="เช่น A หรือ B+">
          </div>
          <div class="form-field full-width">
            <label for="course-note">หมายเหตุ</label>
            <textarea id="course-note" name="note" rows="3" maxlength="1000" placeholder="เพิ่มรายละเอียดเพิ่มเติม (ไม่บังคับ)"></textarea>
          </div>
        </div>
        <p id="course-form-message" class="form-message" role="alert" hidden></p>
        <div class="course-page-actions">
          <a class="cancel-course-button" href="/dashboard" data-dashboard-route="/dashboard">ยกเลิก</a>
          <button class="submit-course-button" type="submit"><span>บันทึกรายวิชา</span><span aria-hidden="true">→</span></button>
        </div>
      </form>
    </section>
  `;

  const pdfInput = app.querySelector('#course-pdf');
  const pdfMessage = app.querySelector('#pdf-import-message');
  const pdfFallbackButton = app.querySelector('#pdf-basic-fallback');
  const preview = app.querySelector('#pdf-course-preview');
  let detectedCourses = [];
  let fallbackCourses = [];

  pdfInput.addEventListener('change', async () => {
    const file = pdfInput.files?.[0];
    if (!file) return;

    detectedCourses = [];
    fallbackCourses = [];
    pdfFallbackButton.hidden = true;
    preview.hidden = true;
    preview.innerHTML = '';
    pdfMessage.className = 'form-message';
    pdfMessage.hidden = false;
    pdfMessage.textContent = 'กำลังอ่านข้อความ PDF...';
    pdfInput.disabled = true;

    try {
      const {
        extractCourseTextForGemini,
        extractCoursesFromText,
        readCoursePdf
      } = await import('./services/course-pdf.js');
      const text = await readCoursePdf(file, ({ phase, page, totalPages, status }) => {
        if (phase === 'ocr') {
          pdfMessage.textContent = `${status || 'กำลังทำ OCR'} (หน้า ${page}/${totalPages})`;
        } else {
          pdfMessage.textContent = status;
        }
      });
      fallbackCourses = extractCoursesFromText(text);
      const geminiText = extractCourseTextForGemini(text);
      pdfMessage.textContent = 'OCR เสร็จแล้ว กำลังส่งข้อความให้ Gemini วิเคราะห์รายวิชา...';
      const aiCourses = await extractCoursesWithGemini(geminiText, {
        faculty,
        major,
        onProgress: ({ part, totalParts }) => {
          pdfMessage.textContent = totalParts > 1
            ? `Gemini กำลังวิเคราะห์ข้อความส่วน ${part}/${totalParts}...`
            : 'Gemini กำลังวิเคราะห์รายวิชา...';
        }
      });
      detectedCourses = aiCourses.map((course) => ({
        ...course,
        year: 1,
        semester: 1,
        status: COURSE_STATUS.NOT_STARTED,
        grade: '',
        note: ''
      }));

      if (!detectedCourses.length) {
        throw new Error('Gemini ไม่พบรายการวิชาในเอกสาร');
      }

      pdfMessage.className = 'form-message success';
      pdfMessage.textContent = `พบ ${detectedCourses.length} วิชา ตรวจสอบหรือแก้ไขข้อมูลก่อนบันทึก`;
      preview.innerHTML = renderPdfCoursePreview(detectedCourses, existingCodes);
      preview.hidden = false;
    } catch (error) {
      pdfMessage.className = 'form-message error';
      pdfMessage.textContent = error.message || 'อ่านไฟล์ PDF ไม่สำเร็จ กรุณาลองอีกครั้ง';
      pdfFallbackButton.hidden = fallbackCourses.length === 0;
    } finally {
      pdfInput.disabled = false;
      pdfInput.value = '';
    }
  });

  pdfFallbackButton.addEventListener('click', () => {
    detectedCourses = fallbackCourses.map((course) => ({
      ...course,
      year: 1,
      semester: 1,
      status: COURSE_STATUS.NOT_STARTED,
      grade: '',
      note: ''
    }));
    pdfMessage.className = 'form-message success';
    pdfMessage.textContent = `แสดงผล OCR พื้นฐาน ${detectedCourses.length} วิชา โปรดตรวจสอบความถูกต้อง`;
    pdfFallbackButton.hidden = true;
    preview.innerHTML = renderPdfCoursePreview(detectedCourses, existingCodes);
    preview.hidden = false;
  });

  app.querySelector('#add-course-form').addEventListener('submit', handleAddCourse);
  preview.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-import-courses]');
    if (!button) return;
    const rows = [...preview.querySelectorAll('[data-course-index]')];
    const selected = rows.filter((row) => row.querySelector('[name="include-course"]').checked);
    if (!selected.length) {
      pdfMessage.className = 'form-message error';
      pdfMessage.textContent = 'เลือกอย่างน้อยหนึ่งวิชาที่ต้องการเพิ่ม';
      pdfMessage.hidden = false;
      return;
    }

    const coursesToSave = selected.map((row) => {
      const value = (field) => row.querySelector(`[data-field="${field}"]`).value.trim();
      return {
        code: value('code'),
        name: value('name'),
        credits: value('credits') === '' ? null : Number(value('credits')),
        category: value('category') || null,
        year: Number(value('year')),
        semester: Number(value('semester')),
        status: COURSE_STATUS.NOT_STARTED,
        grade: null,
        note: null
      };
    });
    if (coursesToSave.some((course) => (
      !course.code || !course.name || !Number.isFinite(course.credits)
      || course.credits < 0 || course.credits > 30
      || !Number.isInteger(course.year) || course.year < 1
      || !Number.isInteger(course.semester) || course.semester < 1
      || course.semester > 3
    ))) {
      pdfMessage.className = 'form-message error';
      pdfMessage.textContent = 'ตรวจสอบรหัส ชื่อ หน่วยกิต ชั้นปี และภาคเรียนของรายการที่เลือก';
      pdfMessage.hidden = false;
      return;
    }

    button.disabled = true;
    preview.querySelectorAll('input, select').forEach((field) => {
      field.disabled = true;
    });
    let added = 0;
    const failures = [];

    for (const course of coursesToSave) {
      try {
        await createCourse(currentSession.user.id, course);
        added += 1;
      } catch (error) {
        failures.push(`${course.code}: ${error.message}`);
      }
    }

    if (!failures.length) {
      pendingDashboardMessage = {
        text: `นำเข้ารายวิชาจาก PDF แล้ว ${added} วิชา`,
        type: 'success'
      };
      navigate('/dashboard');
      return;
    }

    if (added) {
      pendingDashboardMessage = {
        text: `เพิ่มสำเร็จ ${added} วิชา, ไม่สำเร็จ ${failures.length} วิชา (${failures.slice(0, 2).join('; ')})`,
        type: 'error'
      };
      navigate('/dashboard');
      return;
    }

    pdfMessage.className = 'form-message error';
    pdfMessage.textContent = failures.slice(0, 3).join(' · ');
    pdfMessage.hidden = false;
    button.disabled = false;
    preview.querySelectorAll('input, select').forEach((field) => {
      field.disabled = false;
    });
  });
  wireDashboardNavigation();
  initMotion(app.querySelector('.dashboard-page'));
}

function renderPdfCoursePreview(courses, existingCodes) {
  return `
    <div class="pdf-preview-heading">
      <strong>วิชาที่อ่านได้</strong>
      <span>ติ๊กเลือกรายการที่จะเพิ่ม · ปี/เทอมเริ่มต้นที่ 1</span>
    </div>
    <div class="pdf-preview-table-wrap">
      <table class="pdf-preview-table">
        <thead><tr><th>เลือก</th><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>หน่วยกิต</th><th>หมวด</th><th>ปี</th><th>เทอม</th></tr></thead>
        <tbody>
          ${courses.map((course, index) => {
            const duplicate = existingCodes.has(course.code.toLocaleUpperCase());
            return `<tr data-course-index="${index}" ${duplicate ? 'class="is-duplicate"' : ''}>
              <td><input name="include-course" type="checkbox" aria-label="เลือกวิชา ${escapeHtml(course.code)}" ${duplicate ? 'disabled' : 'checked'}></td>
              <td><input data-field="code" aria-label="รหัสวิชา ${index + 1}" maxlength="30" value="${escapeHtml(course.code)}" required></td>
              <td><input data-field="name" aria-label="ชื่อวิชา ${index + 1}" maxlength="150" value="${escapeHtml(course.name)}" required></td>
              <td><input data-field="credits" aria-label="หน่วยกิต ${index + 1}" type="number" min="0" max="30" step="0.5" value="${course.credits ?? ''}" required></td>
              <td><select data-field="category" aria-label="หมวดวิชา ${index + 1}">${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}" ${category === course.category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></td>
              <td><input data-field="year" aria-label="ชั้นปี ${index + 1}" type="number" min="1" max="20" value="${course.year}" required></td>
              <td><input data-field="semester" aria-label="ภาคเรียน ${index + 1}" type="number" min="1" max="3" value="${course.semester}" required></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="pdf-duplicate-note">วิชาที่มีรหัสซ้ำกับรายการเดิมจะถูกปิดการเลือก</p>
    <button class="submit-course-button pdf-import-submit" type="button" data-import-courses>
      <span>เพิ่มวิชาที่เลือก</span><span aria-hidden="true">→</span>
    </button>
  `;
}

function wireDashboardNavigation() {
  if (dashboardNavigationWired) return;
  dashboardNavigationWired = true;
  app.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-dashboard-route]');
    if (!link) return;
    event.preventDefault();
    navigate(link.dataset.dashboardRoute);
  });
}

function wireAvatarFallbacks() {
  app.querySelectorAll('.avatar-image').forEach((image) => {
    image.addEventListener('error', () => {
      image.hidden = true;
    }, { once: true });
  });
}

function handleAvatarSelection(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;

  const message = app.querySelector('#student-profile-message');
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(file.type)) {
    input.value = '';
    releaseAvatarPreview();
    message.textContent = 'รองรับไฟล์ JPG, PNG หรือ WebP เท่านั้น';
    message.hidden = false;
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    input.value = '';
    releaseAvatarPreview();
    message.textContent = 'ขนาดรูปโปรไฟล์ต้องไม่เกิน 5 MB';
    message.hidden = false;
    return;
  }

  message.hidden = true;
  const preview = app.querySelector('.avatar-preview');
  let image = preview.querySelector('.avatar-image');
  if (!image) {
    image = document.createElement('img');
    image.className = 'avatar-image';
    image.alt = 'ตัวอย่างรูปโปรไฟล์';
    preview.append(image);
    wireAvatarFallbacks();
  }
  if (image.dataset.previewUrl) {
    URL.revokeObjectURL(image.dataset.previewUrl);
  }
  image.hidden = false;
  image.dataset.previewUrl = URL.createObjectURL(file);
  image.src = image.dataset.previewUrl;
}

function releaseAvatarPreview() {
  const image = app.querySelector('.avatar-preview .avatar-image');
  if (image?.dataset.previewUrl) {
    URL.revokeObjectURL(image.dataset.previewUrl);
    delete image.dataset.previewUrl;
    const avatarUrl = currentSession?.user.user_metadata?.avatar_url
      || currentSession?.user.user_metadata?.picture;
    if (avatarUrl) {
      image.src = avatarUrl;
      image.hidden = false;
    } else {
      image.remove();
    }
  }
  const fileInput = app.querySelector('#profile-avatar');
  if (fileInput) fileInput.value = '';
}

async function handleAddCourse(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const submitButton = form.querySelector('.submit-course-button');
  const message = form.querySelector('#course-form-message');
  const userId = currentSession.user.id;
  const grade = String(formData.get('grade')).trim();
  const note = String(formData.get('note')).trim();
  const course = {
    code: String(formData.get('code')).trim(),
    name: String(formData.get('name')).trim(),
    credits: Number(formData.get('credits')),
    category: String(formData.get('category')) || null,
    year: Number(formData.get('year')),
    semester: Number(formData.get('semester')),
    status: String(formData.get('status')),
    grade: grade || null,
    note: note || null
  };

  submitButton.disabled = true;
  message.hidden = true;
  try {
    await createCourse(userId, course);
    pendingDashboardMessage = {
      text: 'เพิ่มรายวิชาและบันทึกข้อมูลแล้ว',
      type: 'success'
    };
    navigate('/dashboard');
  } catch (error) {
    message.textContent = error.message || 'เพิ่มรายวิชาไม่สำเร็จ กรุณาลองอีกครั้ง';
    message.hidden = false;
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false;
  }
}

function renderCourseRow(course) {
  const status = course.status || COURSE_STATUS.NOT_STARTED;
  const grade = String(course.grade || '').trim().toUpperCase();
  const gradeOptions = GRADES.map((option) => (
    `<option value="${escapeHtml(option)}" ${option === grade ? 'selected' : ''}>${option || '—'}</option>`
  ));
  if (grade && !GRADES.includes(grade)) {
    gradeOptions.push(
      `<option value="${escapeHtml(grade)}" selected>${escapeHtml(grade)}</option>`
    );
  }
  const knownStatus = Object.hasOwn(STATUS_LABELS, status);
  const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => (
    `<option value="${value}" ${value === status ? 'selected' : ''}>${label}</option>`
  ));
  if (!knownStatus) {
    statusOptions.unshift(
      `<option value="${escapeHtml(status)}" selected>${escapeHtml(status)}</option>`
    );
  }
  const searchValue = `${course.code || ''} ${course.name || ''}`.toLocaleLowerCase();

  return `
    <tr class="course-row" data-search="${escapeHtml(searchValue)}" data-credits="${Number(course.credits) || 0}" data-year="${escapeHtml(course.year ?? '')}" data-semester="${escapeHtml(course.semester ?? '')}" data-category="${escapeHtml(course.category || '')}" data-status="${escapeHtml(status)}">
      <td class="course-selection-cell">
        <input
          class="course-selection-checkbox"
          type="checkbox"
          data-course-id="${escapeHtml(course.id)}"
          data-course-name="${escapeHtml(course.name || course.code || 'รายวิชานี้')}"
          aria-label="เลือกวิชา ${escapeHtml(course.name || course.code || '')} เพื่อลบ"
        >
      </td>
      <td>
        <label class="course-complete-toggle">
          <input
            class="course-complete-checkbox"
            type="checkbox"
            ${status === COURSE_STATUS.COMPLETED ? 'checked' : ''}
            aria-label="ทำเครื่องหมายว่าเรียน ${escapeHtml(course.name || course.code || '')} แล้ว"
          >
          <span class="course-complete-checkmark" aria-hidden="true">✓</span>
          <span>เรียนแล้ว</span>
        </label>
      </td>
      <td class="course-code">${escapeHtml(course.code || '—')}</td>
      <td class="course-name">${escapeHtml(course.name || 'ไม่ระบุชื่อวิชา')}</td>
      <td>${escapeHtml(course.category || '—')}</td>
      <td>${escapeHtml(course.credits ?? '—')}</td>
      <td>
        <select
          class="course-grade-select"
          data-course-id="${escapeHtml(course.id)}"
          data-grade="${escapeHtml(grade)}"
          aria-label="เกรดวิชา ${escapeHtml(course.name || course.code || '')}"
        >${gradeOptions.join('')}</select>
      </td>
      <td>
        <select
          class="course-status-select status-${escapeHtml(status)}"
          data-course-id="${escapeHtml(course.id)}"
          data-status="${escapeHtml(status)}"
          aria-label="สถานะวิชา ${escapeHtml(course.name || course.code || '')}"
        >${statusOptions.join('')}</select>
      </td>
      <td>
        <button
          class="course-delete-button"
          type="button"
          data-course-id="${escapeHtml(course.id)}"
          data-course-name="${escapeHtml(course.name || course.code || 'รายวิชานี้')}"
          aria-label="ลบรายวิชา ${escapeHtml(course.name || course.code || '')}"
          title="ลบรายวิชา"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 13h11l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </td>
    </tr>
  `;
}

function showDashboardMessage(message, type) {
  const messageElement = app.querySelector('#dashboard-message');
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.className = `dashboard-message ${type}`;
  messageElement.hidden = false;
}

async function handleStudentDetailsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const submitButton = form.querySelector('.submit-course-button');
  const message = form.querySelector('#student-profile-message');
  const avatarFile = form.querySelector('#profile-avatar').files?.[0];
  const details = {
    firstName: String(values.get('firstName')).trim(),
    lastName: String(values.get('lastName')).trim(),
    faculty: String(values.get('faculty')).trim(),
    major: String(values.get('major')).trim()
  };

  submitButton.disabled = true;
  message.hidden = true;
  try {
    const avatarUrl = avatarFile
      ? await uploadStudentAvatar(currentSession.user.id, avatarFile)
      : undefined;
    const updatedUser = await updateStudentDetails({
      ...details,
      avatarUrl
    });
    currentSession.user = updatedUser;
    app.querySelector('#student-profile-dialog').close();
    profilePromptDismissed = false;
    pendingDashboardMessage = {
      text: 'บันทึกข้อมูลนักศึกษาแล้ว',
      type: 'success'
    };
    renderDashboard();
  } catch (error) {
    message.textContent = error.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง';
    message.hidden = false;
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false;
  }
}

async function handleSignOut(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await signOut();
  } catch (error) {
    button.disabled = false;
    showDashboardMessage(
      error.message || 'ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
      'error'
    );
  }
}

window.addEventListener('popstate', () => {
  authMessage = null;
  render();
});

try {
  currentSession = await getSession();
  render();
  onAuthStateChange((event, session) => {
    if (currentSession?.user.id !== session?.user.id) {
      profilePromptDismissed = false;
    }
    currentSession = session;
    if (event === 'USER_UPDATED') return;
    render();
  });
} catch (error) {
  app.innerHTML = `<main class="account-page"><section class="account-card"><p class="form-message error" role="alert">${escapeHtml(error.message || 'ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่อีกครั้ง')}</p></section></main>`;
}
