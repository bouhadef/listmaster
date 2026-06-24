// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/store.js (الحالة المركزية + المُخفِّض + الحفظ المحلي)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
//
// PROPRIETARY SOFTWARE. ممنوع النسخ أو التعديل أو الهندسة العكسية.
// Protected under Algerian Law No. 03-05, Berne Convention, TRIPS.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const U = window.U;
  const STORAGE_KEY = 'listmaster_state_v2';

  // ── المصادر الأربعة وحقولها (مبنية على الملفات الرسمية الفعلية) ───────────
  // groups    = ملف التوزيع على الأفواج (Eleve) — الهوية + الجنس + القسم (1م–4م)
  // decisions = القرار النهائي لمجلس القسم (متعدّد الأوراق) — المعدّل + القرار (1م–3م)
  // orient4   = توجيه الرابعة متوسط — المعيدون (إقتراح مجلس القسم = يعيد)
  // newcomers = المنتقلون إلى الأولى متوسط — مع معدّل القبول
  const FIELDS = {
    groups: [
      { key: 'regId',      label: 'رقم التعريف',   req: true,  hint: 'مفتاح الربط' },
      { key: 'lastName',   label: 'اللقب',          req: true },
      { key: 'firstName',  label: 'الاسم',          req: true },
      { key: 'gender',     label: 'الجنس',          req: true },
      { key: 'year',       label: 'السنة (المستوى)', req: true, hint: 'أولى/ثانية/ثالثة/رابعة' },
      { key: 'section',    label: 'القسم (الفوج)',  req: true },
      { key: 'birthDate',  label: 'تاريخ الازدياد', req: false },
      { key: 'birthPlace', label: 'مكان الازدياد',  req: false },
    ],
    decisions: [
      { key: 'regId',    label: 'رقم التعريف',    req: true, hint: 'مفتاح الربط' },
      { key: 'average',  label: 'المعدّل السنوي', req: true },
      { key: 'decision', label: 'القرار النهائي', req: true },
      { key: 'birthDate', label: 'تاريخ الميلاد', req: false },
    ],
    orient4: [
      { key: 'regId',     label: 'رقم التعريف المدرسي', req: true, hint: 'مفتاح الربط' },
      { key: 'proposal',  label: 'إقتراح مجلس القسم',   req: true, hint: '«يعيد السنة» = معيد' },
      { key: 'fullName',  label: 'اللقب والاسم',        req: false },
      { key: 'average',   label: 'معدّل ش.ت.م',          req: false },
      { key: 'birthDate', label: 'تاريخ الميلاد',       req: false },
    ],
    newcomers: [
      { key: 'lastName',     label: 'اللقب',          req: true },
      { key: 'firstName',    label: 'الاسم',          req: true },
      { key: 'gender',       label: 'الجنس',          req: true },
      { key: 'average',      label: 'معدّل القبول',    req: false },
      { key: 'birthDate',    label: 'تاريخ الميلاد',  req: false },
      { key: 'originSchool', label: 'المؤسسة الأصلية', req: false },
    ],
  };
  const SOURCES = ['groups', 'decisions', 'orient4', 'newcomers'];

  const emptyMap = (source) => { const m = {}; FIELDS[source].forEach(f => { m[f.key] = null; }); return m; };

  const initialState = {
    schemaVersion: 2,
    step: 1,
    maxStepReached: 1,
    institution: { name: '', direction: '', currentYear: '', nextYear: '' },
    imports:   { groups: null, decisions: null, orient4: null, newcomers: null },
    columnMap: { groups: emptyMap('groups'), decisions: emptyMap('decisions'), orient4: emptyMap('orient4'), newcomers: emptyMap('newcomers') },
    students: [],
    config: {
      refDate: '',
      homogeneity: 'cohort',       // 'cohort' | 'serpentine'
      balanceGender: true,
      unknownPolicy: 'pass',       // التلاميذ في ملف التوزيع بلا قرار مطابق: 'pass' (ناجح) | 'exclude'
      sortBy: 'name',              // فرز القوائم: 'name' | 'average' | 'gender'
      newcomerOutOf10: true,       // معدّل قبول المنتقلين على /10 → يُضرب ×2 ليوافق /20 (مقارنة عادلة مع المعيدين)
      dissolvedSections: {},       // { [nextLevel]: [currentSections to dissolve] } — القسم الحالي الذي يُحَلّ عند التقليص
      levels: { 1: { nextClasses: 0 }, 2: { nextClasses: 0 }, 3: { nextClasses: 0 }, 4: { nextClasses: 0 } },
    },
    distribution: null,
    meta: { lastSaved: null },
  };

  const cell = (row, idx) => (idx == null || idx < 0) ? '' : (row[idx] == null ? '' : row[idx]);

  // ── بناء قائمة التلاميذ المُطبّعة بالربط برقم التعريف ─────────────────────
  function buildStudents(state) {
    const out = [];
    const ref = U.parseDate(state.config.refDate) || new Date(new Date().getFullYear() + 1, 11, 31);
    const im = state.imports, cm = state.columnMap;

    // خريطة القرارات (ملف 2) حسب رقم التعريف
    const decMap = {};
    if (im.decisions) im.decisions.rows.forEach(r => {
      const id = U.normId(cell(r, cm.decisions.regId)); if (!id) return;
      decMap[id] = { average: U.parseNumber(cell(r, cm.decisions.average)), decision: U.parseDecision(cell(r, cm.decisions.decision)), birthDate: cell(r, cm.decisions.birthDate) };
    });

    // خريطة توجيه الرابعة (ملف 3) — المعيد = إقتراح مجلس القسم يحوي «يعيد»
    const oMap = {};
    if (im.orient4) im.orient4.rows.forEach(r => {
      const id = U.normId(cell(r, cm.orient4.regId)); if (!id) return;
      const proposal = U.normalizeArabic(cell(r, cm.orient4.proposal));
      oMap[id] = { repeat: /يعيد/.test(proposal), average: U.parseNumber(cell(r, cm.orient4.average)), fullName: String(cell(r, cm.orient4.fullName)).trim(), birthDate: cell(r, cm.orient4.birthDate) };
    });

    const seen = new Set();

    // ملف 1 (Eleve) = التلاميذ الحاليون 1م–4م — مصدر الهوية والجنس والقسم
    if (im.groups) im.groups.rows.forEach(r => {
      const id = U.normId(cell(r, cm.groups.regId));
      const lastName = String(cell(r, cm.groups.lastName)).trim();
      const firstName = String(cell(r, cm.groups.firstName)).trim();
      if (!lastName && !firstName && !id) return;
      seen.add(id);
      const grade = U.yearWordToGrade(cell(r, cm.groups.year));
      const section = parseInt(U.toLatinDigits(cell(r, cm.groups.section)), 10) || null;
      let birthDate = cell(r, cm.groups.birthDate);
      let decision = 'unknown', average = null, unmatched = false;

      if (grade >= 1 && grade <= 3) {
        const dd = decMap[id];
        if (dd) { decision = dd.decision; average = dd.average; if (!birthDate && dd.birthDate) birthDate = dd.birthDate; }
        else { unmatched = true; decision = (state.config.unknownPolicy === 'exclude') ? 'unknown' : 'pass'; }
      } else if (grade === 4) {
        const oo = oMap[id];
        if (oo) { decision = oo.repeat ? 'repeat' : 'leave'; average = oo.average; if (!birthDate && oo.birthDate) birthDate = oo.birthDate; }
        else decision = 'leave'; // رابعة غير مذكور في ملف التوجيه → مغادر
      }

      let nextGrade = null;
      if (decision === 'pass') nextGrade = (grade >= 1 && grade < 4) ? grade + 1 : null;
      else if (decision === 'repeat') nextGrade = grade;

      out.push({
        id: U.uid('s'), source: 'current', regId: id,
        lastName, firstName, gender: U.parseGender(cell(r, cm.groups.gender)),
        birthDate: U.fmtDate(birthDate), birthPlace: String(cell(r, cm.groups.birthPlace)).trim(),
        average, decision, repeating: decision === 'repeat', unmatched,
        currentClass: (grade && section) ? U.className(grade, section) : '',
        grade, section, nextGrade, age: U.calcAge(birthDate, ref),
      });
    });

    // معيدو الرابعة الموجودون في ملف التوجيه فقط (احتياط — إن غابوا عن ملف 1)
    if (im.orient4) Object.entries(oMap).forEach(([id, oo]) => {
      if (!oo.repeat || seen.has(id)) return;
      const parts = (oo.fullName || '').split(/\s+/);
      out.push({
        id: U.uid('o'), source: 'current', regId: id,
        lastName: parts[0] || oo.fullName || '—', firstName: parts.slice(1).join(' '),
        gender: null, birthDate: U.fmtDate(oo.birthDate), birthPlace: '',
        average: oo.average, decision: 'repeat', repeating: true,
        currentClass: '', grade: 4, section: null, nextGrade: 4, age: U.calcAge(oo.birthDate, ref),
      });
    });

    // ملف 4 = المنتقلون إلى الأولى متوسط
    if (im.newcomers) im.newcomers.rows.forEach(r => {
      const lastName = String(cell(r, cm.newcomers.lastName)).trim();
      const firstName = String(cell(r, cm.newcomers.firstName)).trim();
      if (!lastName && !firstName) return;
      const birthDate = cell(r, cm.newcomers.birthDate);
      let ncAvg = U.parseNumber(cell(r, cm.newcomers.average));
      if (ncAvg != null && state.config.newcomerOutOf10) ncAvg = U.round2(ncAvg * 2);  // /10 → /20
      out.push({
        id: U.uid('n'), source: 'newcomers', regId: '',
        lastName, firstName, gender: U.parseGender(cell(r, cm.newcomers.gender)),
        birthDate: U.fmtDate(birthDate), birthPlace: '',
        originSchool: String(cell(r, cm.newcomers.originSchool)).trim(),
        average: ncAvg,
        decision: 'pass', repeating: false, currentClass: null,
        grade: 0, section: null, nextGrade: 1, age: U.calcAge(birthDate, ref),
      });
    });

    return out;
  }

  // ── المُخفِّض ─────────────────────────────────────────────────────────────
  function rootReducer(state, action) {
    switch (action.type) {
      case 'SET_STEP':
        return { ...state, step: action.step, maxStepReached: Math.max(state.maxStepReached, action.step) };
      case 'PATCH_INSTITUTION':
        return { ...state, institution: { ...state.institution, ...action.patch } };
      case 'SET_IMPORT':
        return { ...state, imports: { ...state.imports, [action.source]: action.data } };
      case 'CLEAR_IMPORT':
        return {
          ...state,
          imports: { ...state.imports, [action.source]: null },
          columnMap: { ...state.columnMap, [action.source]: emptyMap(action.source) },
          students: [], distribution: null,
        };
      case 'SET_COLUMN_MAP':
        return { ...state, columnMap: { ...state.columnMap, [action.source]: { ...state.columnMap[action.source], ...action.patch } } };
      case 'BUILD_STUDENTS':
        return { ...state, students: buildStudents(state) };
      case 'PATCH_CONFIG':
        return { ...state, config: { ...state.config, ...action.patch } };
      case 'SET_LEVEL_CLASSES':
        return { ...state, config: { ...state.config, levels: { ...state.config.levels, [action.level]: { nextClasses: action.n } } } };
      case 'SET_DISTRIBUTION':
        return { ...state, distribution: action.distribution };
      case 'MOVE_STUDENT': {
        if (!state.distribution) return state;
        const { level, studentId, toClass } = action;
        const lvl = state.distribution.byLevel[level];
        if (!lvl) return state;
        const classes = lvl.classes.map(c => ({ ...c, studentIds: c.studentIds.filter(id => id !== studentId) }));
        const target = classes.find(c => c.name === toClass);
        if (target) target.studentIds = [...target.studentIds, studentId];
        return { ...state, distribution: { ...state.distribution, byLevel: { ...state.distribution.byLevel, [level]: { ...lvl, classes } } } };
      }
      case 'RESET_ALL':
        return JSON.parse(JSON.stringify(initialState));
      case 'LOAD_STATE':
        return action.state;
      default:
        return state;
    }
  }

  // ── الحفظ/التحميل المحلي ──────────────────────────────────────────────────
  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, meta: { ...state.meta, lastSaved: Date.now() } })); }
    catch (e) { console.warn('saveState failed', e); }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(initialState));
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== initialState.schemaVersion) return JSON.parse(JSON.stringify(initialState));
      const cmap = {}; SOURCES.forEach(s => { cmap[s] = { ...emptyMap(s), ...((parsed.columnMap || {})[s] || {}) }; });
      return {
        ...JSON.parse(JSON.stringify(initialState)), ...parsed,
        institution: { ...initialState.institution, ...(parsed.institution || {}) },
        config: { ...initialState.config, ...(parsed.config || {}), levels: { ...initialState.config.levels, ...((parsed.config || {}).levels || {}) } },
        columnMap: cmap,
      };
    } catch (e) { console.warn('loadState failed', e); return JSON.parse(JSON.stringify(initialState)); }
  }

  window.AppContext = React.createContext(null);
  window.useStore = () => React.useContext(window.AppContext);
  window.Store = { initialState, rootReducer, saveState, loadState, buildStudents, FIELDS, SOURCES, emptyMap, STORAGE_KEY };
})();
