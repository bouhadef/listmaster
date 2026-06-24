// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/distribution.js (خوارزمية تكوين الأقسام وتوزيع التلاميذ)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
//
// PROPRIETARY SOFTWARE. الخوارزميات الواردة هنا (تماسك الفوج، التوزيع المتعرّج
// "الثعبان"، موازنة الجنس، حلّ/إنشاء الأقسام) ملكيّة فكريّة محفوظة. ممنوع
// النسخ أو التعديل أو الهندسة العكسية. Algerian Law 03-05 · Berne · TRIPS.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const U = window.U;

  // متوسط قسم (أو المتوسط العام إن كان فارغًا) — يُستعمل في الموازنة
  const sumOf = (ids, byId) => ids.reduce((a, id) => { const s = byId[id]; return a + (s && s.average != null ? s.average : 0); }, 0);
  const cntAvg = (ids, byId) => ids.reduce((a, id) => { const s = byId[id]; return a + (s && s.average != null ? 1 : 0); }, 0);
  const meanOf = (ids, byId) => { const c = cntAvg(ids, byId); return c ? sumOf(ids, byId) / c : null; };
  const genderDiff = (ids, byId) => ids.reduce((a, id) => { const s = byId[id]; return a + (s ? (s.gender === 'M' ? 1 : s.gender === 'F' ? -1 : 0) : 0); }, 0);

  const makeClasses = (grade, n) =>
    Array.from({ length: n }, (_, i) => ({ name: U.className(grade, i + 1), grade, section: i + 1, studentIds: [] }));

  // ── التوزيع المتعرّج (الثعبان) — للتجانس الكامل أو السنة الأولى ────────────
  function serpentine(grade, n, pool, byId, balanceGender) {
    const classes = makeClasses(grade, n);
    const withAvg = pool.filter(s => s.average != null).sort((a, b) => b.average - a.average);
    const noAvg = pool.filter(s => s.average == null);

    let idx = 0, dir = 1;
    withAvg.forEach(s => {
      classes[idx].studentIds.push(s.id);
      idx += dir;
      if (idx >= n) { idx = n - 1; dir = -1; }
      else if (idx < 0) { idx = 0; dir = 1; }
    });
    // بلا معدّل (المنتقلون من الابتدائية): إلى الأصغر حجمًا
    noAvg.forEach(s => {
      classes.sort((a, b) => a.studentIds.length - b.studentIds.length);
      classes[0].studentIds.push(s.id);
    });
    classes.sort((a, b) => a.section - b.section);
    if (balanceGender) balanceGenders(classes, byId);
    return classes;
  }

  // ── توزيع مع تماسك الفوج (المستويات 2م–4م) ───────────────────────────────
  // dissolvedChoice: [أقسام السنة الحالية التي يختار المستخدم حلّها]. الأقسام الباقية
  // تنتقل بفوجها (مُعاد ترقيمها 1..n)، وتلاميذ الأقسام المحلولة يُوزَّعون بالتوازن
  // على باقي الأقسام. الافتراضي عند عدم الاختيار: حلّ الأعلى ترقيمًا (origin − n).
  function cohortDistribute(grade, n, pool, byId, balanceGender, dissolvedChoice) {
    const classes = makeClasses(grade, n);
    const dissolvedIds = [];
    const cohort = pool.filter(s => s.decision === 'pass' && s.section != null && s.grade === grade - 1);
    const free = pool.filter(s => !(s.decision === 'pass' && s.section != null && s.grade === grade - 1));

    const originSections = [...new Set(cohort.map(s => s.section))].sort((a, b) => a - b);
    const toDissolve = (dissolvedChoice && dissolvedChoice.length)
      ? dissolvedChoice.filter(s => originSections.includes(s))
      : originSections.slice(n);                         // الأعلى ترقيمًا افتراضيًا
    const dissolvedSet = new Set(toDissolve);
    const surviving = originSections.filter(s => !dissolvedSet.has(s));

    // أوّل n قسم باقٍ (مرتّبة) → الأقسام الجديدة 1..n مع الحفاظ على فوجها
    const sectionToClass = {};
    surviving.slice(0, n).forEach((sec, i) => { sectionToClass[sec] = i; });

    const spread = [];
    cohort.forEach(s => {
      const ci = sectionToClass[s.section];
      if (ci != null) classes[ci].studentIds.push(s.id);
      else { spread.push(s); dissolvedIds.push(s.id); }   // قسمه محلول → يُوزَّع على الباقي
    });

    // المحلولون + المعيدون/المنتقلون → توزيع متوازن على كل الأقسام
    distributeFree(classes, spread.concat(free), byId);
    if (balanceGender) balanceGenders(classes, byId);
    return { classes, dissolved: dissolvedIds, dissolvedSections: toDissolve };
  }

  // ── مؤشّر تناسق المعدّلات بين الأقسام (0–100٪) ─────────────────────────────
  // 100٪ = متوسطات الأقسام متساوية تمامًا. يقيس نسبة تباين القدرات «بين الأقسام»
  // إلى التباين الكلّي (كلّما قلّ التباين بين الأقسام زاد التناسق).
  function consistency(classes, byId) {
    const means = classes.map(c => meanOf(c.studentIds, byId)).filter(v => v != null);
    if (means.length < 2) return { score: 100, spread: 0, between: 0 };
    const allAvg = [];
    classes.forEach(c => c.studentIds.forEach(id => { const s = byId[id]; if (s && s.average != null) allAvg.push(s.average); }));
    const between = U.stdev(means), total = U.stdev(allAvg);
    const score = total > 0.05 ? Math.max(0, Math.min(100, Math.round(100 * (1 - between / total)))) : 100;
    return { score, spread: U.round2(Math.max(...means) - Math.min(...means)), between: U.round2(between) };
  }

  // ── توزيع الأحرار (المعيدون/المنتقلون/المحلولون) ─────────────────────────
  // round-robin على القسم الأصغر حجمًا (لتساوي الأحجام وتوزيع المعيدين بالتساوي)،
  // مع كسر التعادل بأقلّ مجموع معدّلات (لموازنة متوسطات الأقسام). الأقوى معدّلاً
  // أولاً ليتوزّع التفوّق بالتناوب على كل الأقسام.
  function distributeFree(classes, free, byId) {
    const place = (s) => {
      const minSize = Math.min(...classes.map(c => c.studentIds.length));
      const cand = classes.filter(c => c.studentIds.length === minSize);
      cand.sort((a, b) => sumOf(a.studentIds, byId) - sumOf(b.studentIds, byId));
      cand[0].studentIds.push(s.id);
    };
    free.filter(s => s.average != null).sort((a, b) => b.average - a.average).forEach(place);
    free.filter(s => s.average == null).forEach(place);
  }

  // ── موازنة الجنس بالتبديل (ذكر ↔ أنثى بمعدّلين متقاربين) — §3.4 ────────────
  // pinned: تلاميذ ثابتون (وجّههم المستخدم صراحةً عند التقليص) لا تُحرّكهم الموازنة.
  function balanceGenders(classes, byId, pinned, maxIter = 60) {
    const P = pinned || new Set();
    for (let it = 0; it < maxIter; it++) {
      // أكثر قسم فائض ذكور / أكثر قسم فائض إناث
      let heavyM = null, heavyF = null;
      classes.forEach(c => {
        const d = genderDiff(c.studentIds, byId);
        if (heavyM == null || d > genderDiff(heavyM.studentIds, byId)) heavyM = c;
        if (heavyF == null || d < genderDiff(heavyF.studentIds, byId)) heavyF = c;
      });
      if (!heavyM || !heavyF || heavyM === heavyF) break;
      const dM = genderDiff(heavyM.studentIds, byId), dF = genderDiff(heavyF.studentIds, byId);
      if (dM - dF < 2) break; // متوازن بما يكفي

      // ذكر من heavyM ↔ أنثى من heavyF بأقرب معدّل (أقلّ اضطراب للمتوسطات)
      const males = heavyM.studentIds.map(id => byId[id]).filter(s => s && s.gender === 'M' && !P.has(s.id));
      const females = heavyF.studentIds.map(id => byId[id]).filter(s => s && s.gender === 'F' && !P.has(s.id));
      if (!males.length || !females.length) break;
      let best = null;
      males.forEach(m => females.forEach(f => {
        const cost = Math.abs((m.average ?? 10) - (f.average ?? 10));
        if (!best || cost < best.cost) best = { m, f, cost };
      }));
      if (!best) break;
      heavyM.studentIds = heavyM.studentIds.filter(id => id !== best.m.id); heavyM.studentIds.push(best.f.id);
      heavyF.studentIds = heavyF.studentIds.filter(id => id !== best.f.id); heavyF.studentIds.push(best.m.id);
    }
  }

  // ── التشغيل الرئيسي ───────────────────────────────────────────────────────
  function run(state) {
    const byId = {}; state.students.forEach(s => { byId[s.id] = s; });
    const byLevel = {};
    const warnings = [];

    for (let L = 1; L <= 4; L++) {
      const n = (state.config.levels[L] || {}).nextClasses || 0;
      if (n <= 0) continue;

      const pool = state.students.filter(s => s.nextGrade === L);
      const originSections = new Set(pool.filter(s => s.decision === 'pass' && s.section != null && s.grade === L - 1).map(s => s.section));
      const originCount = originSections.size;

      let change = 'same';
      if (L === 1) change = 'fresh';
      else if (n > originCount && originCount > 0) change = 'grow';
      else if (n < originCount) change = 'shrink';

      const notes = [];
      let classes, dissolved = [];

      if (pool.length === 0) {
        classes = makeClasses(L, n);
        notes.push('لا يوجد تلاميذ مرشّحون لهذا المستوى — هل استوردت الملف الصحيح؟');
      } else if (L === 1 || state.config.homogeneity === 'serpentine' || change === 'grow') {
        classes = serpentine(L, n, pool, byId, state.config.balanceGender);
        if (L === 1) notes.push('توزيع متجانس (الثعبان) — لا فوج سابق يُحافَظ عليه.');
        else if (change === 'grow') notes.push(`زيادة: ${originCount} أقسام أصلية → ${n}. لإضافة قسم جديد متجانس يلزم إعادة الخلط، فاعتُمد التوزيع المتعرّج (الثعبان) لضمان تجانس كل الأقسام بما فيها الجديد.`);
        else notes.push('تجانس كامل (الثعبان) — تجاهُل تماسك الفوج حسب الإعداد.');
      } else {
        const res = cohortDistribute(L, n, pool, byId, state.config.balanceGender, (state.config.dissolvedSections || {})[L]);
        classes = res.classes; dissolved = res.dissolved;
        if (change === 'shrink') notes.push(`تقلّص: ${originCount} أقسام أصلية → ${n}. تلاميذ الأقسام المحلولة (${dissolved.length}) أُعيد توزيعهم بالتوازن.`);
        if (change === 'same') notes.push('حفاظ على تماسك الفوج مع توزيع المعيدين بالتساوي وموازنة المعدّل والجنس.');
      }

      // إنذارات الجودة
      const sizes = classes.map(c => c.studentIds.length);
      if (sizes.length && Math.max(...sizes) - Math.min(...sizes) > 3)
        warnings.push(`المستوى ${L}م: فارق حجم بين الأقسام (${Math.min(...sizes)}–${Math.max(...sizes)}).`);

      byLevel[L] = { grade: L, nextClasses: n, change, originCount, classes, dissolved, notes, consistency: consistency(classes, byId) };
    }

    return { generatedAt: Date.now(), byLevel, warnings };
  }

  // ── اقتراح عدد الأقسام لكل مستوى (≈ نفس معدّل الكثافة الحالي) ───────────────
  function suggestClasses(state, targetSize = 34) {
    const out = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let L = 1; L <= 4; L++) {
      const cnt = state.students.filter(s => s.nextGrade === L).length;
      out[L] = cnt > 0 ? Math.max(1, Math.round(cnt / targetSize)) : 0;
    }
    return out;
  }

  window.Distribution = { run, suggestClasses, meanOf, genderDiff, consistency };
})();
