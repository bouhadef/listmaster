// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/validation.js (فحص جودة الملفات المستورَدة وكشف الأخطاء)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
//
// يكشف ثلاثة أنواع من الخلل الشائع في ملفات المؤسسة قبل التوزيع:
//   A) تلميذ بلا قرار  — موجود في ملف التوزيع (Eleve) لكن لا سطر مطابق له في
//      ملف القرارات (رقم تعريف غير متطابق أو قسم غائب كليًّا) → يظهر بلا معدّل.
//   B) تلميذ غير موجود — له قرار/معدّل في ملف القرارات لكنه غائب عن ملف التوزيع.
//   C) رقم تعريف مكرّر — نفس التلميذ مذكور أكثر من مرّة في ملف القرارات (نسخ ورقة).
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const U = window.U;
  const cell = (row, idx) => (idx == null || idx < 0) ? '' : (row[idx] == null ? '' : row[idx]);

  // كشف عمود عبر مرادفات العنوان (احتياط عند غياب الإسناد الصريح في خريطة الأعمدة)
  function findCol(headers, needles) {
    if (!headers) return -1;
    for (let i = 0; i < headers.length; i++) {
      const h = U.normalizeArabic(headers[i]);
      if (h && needles.some(n => h.includes(n))) return i;
    }
    return -1;
  }
  const resolveCol = (mapped, headers, needles) =>
    (mapped != null && mapped >= 0) ? mapped : findCol(headers, needles);

  // ── الفحص الرئيسي: يُعيد بنية منظّمة بكل أنواع الخلل ──────────────────────
  function audit(state) {
    const students = state.students || [];
    const im = state.imports || {};
    const cm = state.columnMap || {};

    // أرقام تعريف تلاميذ ملف التوزيع (المرجع لِما هو «موجود فعلًا»)
    const groupIds = new Set();
    students.forEach(s => { if (s.source === 'current' && s.regId) groupIds.add(s.regId); });

    // ═══ A) تلاميذ بلا قرار مطابق (1م–3م) — لهم اسم وقسم ═══
    const noDecision = students
      .filter(s => s.source === 'current' && s.unmatched && s.grade >= 1 && s.grade <= 3)
      .map(s => ({ regId: s.regId, name: U.fullName(s), cls: s.currentClass || '—' }));

    // تجميع حسب القسم + تمييز الأقسام الغائبة بالكامل (كأنّ قسمًا سقط من ملف القرارات)
    const classTotal = {};
    students.forEach(s => { if (s.source === 'current' && s.currentClass) classTotal[s.currentClass] = (classTotal[s.currentClass] || 0) + 1; });
    const grouped = {};
    noDecision.forEach(x => { (grouped[x.cls] = grouped[x.cls] || []).push(x); });
    const noDecisionClasses = Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'ar'))
      .map(cls => ({
        cls,
        students: grouped[cls],
        count: grouped[cls].length,
        whole: classTotal[cls] != null && classTotal[cls] > 1 && grouped[cls].length === classTotal[cls],
      }));

    // ═══ B) تلميذ غير موجود + C) رقم تعريف مكرّر (من ملف القرارات) ═══
    const orphanDecisions = [];
    const duplicateDecisions = [];
    const dec = im.decisions;
    if (dec && dec.rows) {
      const dm = cm.decisions || {};
      const idCol    = resolveCol(dm.regId,     dec.headers, ['تعريف', 'رقم']);
      const lastCol  = resolveCol(dm.lastName,  dec.headers, ['لقب']);
      const firstCol = resolveCol(dm.firstName, dec.headers, ['الاسم', 'اسم']);
      const avgCol   = resolveCol(dm.average,   dec.headers, ['سنوي', 'معدل', 'moyenne']);
      const seen = {};
      dec.rows.forEach(r => {
        const id = U.normId(cell(r, idCol));
        if (!id) return;
        if (seen[id]) { seen[id].count++; return; }
        const name = [cell(r, lastCol), cell(r, firstCol)].map(v => String(v).trim()).filter(Boolean).join(' ');
        seen[id] = { id, name, avg: U.parseNumber(cell(r, avgCol)), count: 1 };
      });
      Object.keys(seen).forEach(id => {
        const o = seen[id];
        if (!groupIds.has(id)) orphanDecisions.push({ regId: id, name: o.name || '—', average: o.avg });
        if (o.count > 1) duplicateDecisions.push({ regId: id, name: o.name || '—', count: o.count });
      });
    }

    const issues = noDecision.length + orphanDecisions.length + duplicateDecisions.length;
    return {
      ok: issues === 0,
      issues,
      hasDecisionsFile: !!(dec && dec.rows),
      noDecision, noDecisionClasses,
      orphanDecisions, duplicateDecisions,
    };
  }

  window.Validation = { audit };
})();
