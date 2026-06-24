// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/utils.js (دوال مساعدة عامة)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  // ── تحويل الأرقام الهندية/الفارسية إلى لاتينية ──────────────────────────
  const DIGIT_MAP = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  const toLatinDigits = (s) => String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, d => DIGIT_MAP[d] || d);

  // ── تطبيع نص عربي للمطابقة (إزالة التشكيل، توحيد الألف/الياء/التاء) ────────
  const normalizeArabic = (s) => {
    if (s == null) return '';
    return toLatinDigits(String(s))
      .replace(/[ً-ٰٟـ]/g, '') // تشكيل + تطويل
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\s ]+/g, ' ')
      .trim()
      .toLowerCase();
  };

  // ── تحليل رقم (يدعم الفاصلة العشرية العربية) ─────────────────────────────
  const parseNumber = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const cleaned = toLatinDigits(String(v)).replace(/[^\d.,-]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : null;
  };

  const fmtAvg = (n) => (n == null || !isFinite(n)) ? '—' : Number(n).toFixed(2);
  // تنسيق تاريخ موحّد dd/mm/yyyy (يحوّل تسلسل Excel وكائنات Date والنصوص)
  const fmtDate = (v) => {
    const d = parseDate(v);
    if (d) { const p = (n) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; }
    const s = (v == null ? '' : String(v)).trim();
    return /^\d+(\.\d+)?$/.test(s) ? '' : s; // رقم خام غير قابل للتحليل → فارغ
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  // ── معرّف فريد ────────────────────────────────────────────────────────────
  let _seq = 0;
  const uid = (prefix = 'id') => `${prefix}_${(_seq++).toString(36)}_${Math.floor(performance.now() * 1000).toString(36)}`;

  // ── تطبيع رقم التعريف (مفتاح الربط بين الملفات) — أرقام فقط ────────────────
  const normId = (v) => toLatinDigits(String(v == null ? '' : v)).replace(/\D/g, '').trim();

  // ── السنة بالكلمات → رقم المستوى (ملف التوزيع على الأفواج) ─────────────────
  const YEAR_TO_GRADE = { 'اولى': 1, 'الاولى': 1, 'ثانيه': 2, 'الثانيه': 2, 'ثالثه': 3, 'الثالثه': 3, 'رابعه': 4, 'الرابعه': 4 };
  const yearWordToGrade = (raw) => {
    const s = normalizeArabic(raw);
    if (!s) return null;
    if (YEAR_TO_GRADE[s] != null) return YEAR_TO_GRADE[s];
    if (/رابع/.test(s)) return 4; if (/ثالث/.test(s)) return 3; if (/ثاني/.test(s)) return 2; if (/اول/.test(s)) return 1;
    const n = parseInt(toLatinDigits(s), 10); return (n >= 1 && n <= 4) ? n : null;
  };

  // ── تحليل اسم القسم: "3م1" → { grade:3, section:1, levelKey:'3م' } ────────
  const GRADE_LABEL = { 1: 'السنة الأولى متوسط', 2: 'السنة الثانية متوسط', 3: 'السنة الثالثة متوسط', 4: 'السنة الرابعة متوسط' };
  const parseClassName = (raw) => {
    const s = toLatinDigits(String(raw == null ? '' : raw)).trim();
    if (!s) return null;
    // الصيغة الجزائرية: رقم المستوى + م/AM + رقم القسم  (مثل 1م1 ، 2 م 3 ، 4AM2)
    let m = s.match(/(\d)\s*(?:م|am|ms)\s*(\d+)/i);
    if (m) return { grade: +m[1], section: +m[2], levelKey: `${m[1]}م` };
    // احتياط: أول رقم = مستوى، آخر رقم = قسم
    const nums = s.match(/\d+/g);
    if (nums && nums.length >= 1) {
      const grade = clamp(+nums[0], 1, 4);
      const section = nums.length >= 2 ? +nums[nums.length - 1] : 1;
      return { grade, section, levelKey: `${grade}م` };
    }
    return null;
  };
  const className = (grade, section) => `${grade}م${section}`;
  const gradeLabel = (grade) => GRADE_LABEL[grade] || `السنة ${grade}`;

  // ── تصنيف القرار: ينتقل / يعيد / يغادر ──────────────────────────────────
  // يُعيد: 'pass' (ينتقل) · 'repeat' (يعيد) · 'leave' (يغادر/موجّه ثانوي)
  const parseDecision = (raw) => {
    const s = normalizeArabic(raw);
    if (!s) return 'pass'; // الافتراض: ناجح إن لم يُذكر
    if (/(يعيد|اعاده|معيد|راسب|يكرر|redoubl|repeat)/.test(s)) return 'repeat';
    if (/(يغادر|مغادر|موجه|يوجه|تكوين|مهني|ثانوي|جدع|طرد|منقطع|leave|exclu|orient|depart)/.test(s)) return 'leave';
    if (/(ينتقل|ناجح|منتقل|ينجح|admis|pass|reussi)/.test(s)) return 'pass';
    return 'pass';
  };
  const DECISION_LABEL = { pass: 'ينتقل', repeat: 'يعيد', leave: 'يغادر' };
  const DECISION_TONE = { pass: 'success', repeat: 'gold', leave: 'danger' };

  // ── تصنيف الجنس: ذكر / أنثى → 'M' / 'F' ─────────────────────────────────
  const parseGender = (raw) => {
    const s = normalizeArabic(raw);
    if (!s) return null;
    if (/(انثى|بنت|ف|f|female|fille|girl)/.test(s) && !/(ذكر|m)/.test(s)) return 'F';
    if (/^(انثى|بنت|f|fe|fi)/.test(s)) return 'F';
    if (/(ذكر|ولد|m|male|garcon|boy)/.test(s)) return 'M';
    if (/^(ف|أ|ا)/.test(s)) return 'F';
    if (/^(ذ|d|m)/.test(s)) return 'M';
    return null;
  };
  const GENDER_LABEL = { M: 'ذكر', F: 'أنثى' };

  // ── تحليل التاريخ (يدعم تسلسل Excel، dd/mm/yyyy، yyyy-mm-dd) ─────────────
  const parseDate = (v) => {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v;
    // تسلسل Excel (عدد الأيام منذ 1899-12-30)
    if (typeof v === 'number' && v > 0 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(d) ? null : d;
    }
    const s = toLatinDigits(String(v)).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(d) ? null : d; }
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let year = +m[3]; if (year < 100) year += year < 30 ? 2000 : 1900;
      const d = new Date(year, +m[2] - 1, +m[1]); return isNaN(d) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };

  // ── حساب السن بالسنوات عند تاريخ مرجعي (افتراضيًا 31 ديسمبر للسنة القادمة) ──
  const calcAge = (birth, ref) => {
    const b = parseDate(birth);
    if (!b) return null;
    const r = ref instanceof Date ? ref : new Date(ref);
    let age = r.getFullYear() - b.getFullYear();
    const mdiff = r.getMonth() - b.getMonth();
    if (mdiff < 0 || (mdiff === 0 && r.getDate() < b.getDate())) age--;
    return age;
  };
  const birthYear = (birth) => { const b = parseDate(birth); return b ? b.getFullYear() : null; };

  // ── إحصاء قائمة تلاميذ → { count, males, females, avg, repeaters, ages } ──
  const statsOf = (students) => {
    const list = students || [];
    const count = list.length;
    let males = 0, females = 0, repeaters = 0, sum = 0, withAvg = 0;
    const ages = [];
    list.forEach(s => {
      if (s.gender === 'M') males++; else if (s.gender === 'F') females++;
      if (s.repeating) repeaters++;
      if (s.average != null && isFinite(s.average)) { sum += s.average; withAvg++; }
      if (s.age != null) ages.push(s.age);
    });
    return {
      count, males, females, repeaters,
      avg: withAvg ? round2(sum / withAvg) : null,
      minAge: ages.length ? Math.min(...ages) : null,
      maxAge: ages.length ? Math.max(...ages) : null,
      avgAge: ages.length ? round2(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
    };
  };

  // ── متوسط/انحراف على مجموعة قيم ──────────────────────────────────────────
  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const stdev = (arr) => {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
  };

  // ── ترتيب اسم كامل للعرض ─────────────────────────────────────────────────
  const fullName = (s) => [s.lastName, s.firstName].filter(Boolean).join(' ').trim() || '—';

  // ── فرز قائمة تلاميذ: 'name' | 'average' | 'gender' ─────────────────────
  const byNameCmp = (a, b) => normalizeArabic(fullName(a)).localeCompare(normalizeArabic(fullName(b)), 'ar');
  const sortStudents = (list, sortBy) => {
    const arr = [...(list || [])];
    if (sortBy === 'average') arr.sort((a, b) => (b.average == null ? -1 : b.average) - (a.average == null ? -1 : a.average) || byNameCmp(a, b));
    else if (sortBy === 'gender') { const gr = g => g === 'M' ? 0 : g === 'F' ? 1 : 2; arr.sort((a, b) => gr(a.gender) - gr(b.gender) || byNameCmp(a, b)); }
    else arr.sort(byNameCmp);
    return arr;
  };
  const SORT_LABEL = { name: 'اللقب والاسم', average: 'المعدّل', gender: 'الجنس' };

  window.U = {
    toLatinDigits, normalizeArabic, parseNumber, fmtAvg, fmtDate, clamp, round2, uid, normId,
    YEAR_TO_GRADE, yearWordToGrade,
    parseClassName, className, gradeLabel, GRADE_LABEL,
    parseDecision, DECISION_LABEL, DECISION_TONE,
    parseGender, GENDER_LABEL,
    parseDate, calcAge, birthYear,
    statsOf, mean, stdev, fullName, sortStudents, SORT_LABEL,
  };
})();
