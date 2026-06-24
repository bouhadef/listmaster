// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/excel.js (استيراد/تصدير Excel عبر SheetJS)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const U = window.U;
  const norm = U.normalizeArabic;

  // ── مرادفات الأعمدة (مُطبّعة) لكشف المطابقة تلقائيًا، لكل مصدر ─────────────
  const SYN = {
    groups: {
      regId:      ['تعريف', 'رقم'],
      lastName:   ['لقب'],
      firstName:  ['الاسم', 'اسم'],
      gender:     ['الجنس', 'جنس', 'sexe'],
      year:       ['السنه', 'المستوى', 'المستوي'],
      section:    ['القسم', 'الفوج', 'فوج'],
      birthDate:  ['تاريخ', 'ميلاد'],
      birthPlace: ['مكان', 'محل', 'lieu'],
    },
    decisions: {
      regId:     ['تعريف', 'رقم'],
      average:   ['سنوي', 'معدل', 'moyenne'],
      decision:  ['القرار', 'قرار', 'decision'],
      birthDate: ['تاريخ', 'ميلاد'],
    },
    orient4: {
      regId:     ['تعريف', 'رقم'],
      proposal:  ['اقتراح', 'مجلس'],
      fullName:  ['اللقب والاسم', 'لقب', 'الاسم'],
      average:   ['ش ت م', 'شتم', 'معدل', 'القبول'],
      birthDate: ['تاريخ', 'ميلاد'],
    },
    newcomers: {
      lastName:    ['لقب'],
      firstName:   ['الاسم', 'اسم'],
      gender:      ['الجنس', 'جنس', 'sexe'],
      average:     ['القبول', 'معدل', 'moyenne'],
      birthDate:   ['تاريخ', 'ميلاد'],
      originSchool:['المؤسسه', 'مؤسسه', 'الاصليه', 'مدرسه', 'ابتدائيه', 'مصدر'],
    },
  };

  // أوضاع القراءة لكل مصدر (أوراق متعددة)
  const READ_OPTS = {
    groups:    { mode: 'single' },
    decisions: { mode: 'merge', skip: /ملخص|احصائ|ملخّص/ },
    orient4:   { mode: 'pick',  pick: /كل التلاميذ|كل/, skip: /ملخص|احصائ/ },
    newcomers: { mode: 'single' },
  };

  // ── كشف صفّ العناوين (الأكثر تطابقًا مع المرادفات ضمن أول 8 صفوف) ─────────
  function detectHeaderRow(rows) {
    const allSyn = Object.values(SYN).flatMap(o => Object.values(o).flat());
    let bestRow = 0, bestScore = -1;
    for (let i = 0; i < Math.min(8, rows.length); i++) {
      const row = rows[i] || [];
      let score = 0, nonEmpty = 0;
      row.forEach(c => { const t = norm(c); if (t) nonEmpty++; if (t && allSyn.some(s => t.includes(s))) score += 1; });
      score += Math.min(nonEmpty, 6) * 0.1;
      if (score > bestScore) { bestScore = score; bestRow = i; }
    }
    return bestRow;
  }

  // ── قراءة ملف (تدعم: ورقة واحدة / دمج الأوراق / اختيار ورقة) ───────────────
  function readFile(file, opts = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('تعذّر قراءة الملف'));
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
          const toArr = (sn) => XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
          const names = wb.SheetNames;

          let chosen;
          const notSummary = (sn) => !(opts.skip && opts.skip.test(norm(sn)));
          if (opts.mode === 'pick' && opts.pick) {
            const found = names.find(sn => opts.pick.test(norm(sn)) && notSummary(sn));
            chosen = found ? [found] : names.filter(sn => notSummary(sn));
          } else if (opts.mode === 'merge') {
            chosen = names.filter(sn => notSummary(sn));
          } else {
            chosen = [names.find(sn => toArr(sn).length >= 2) || names[0]];
          }

          let headers = null; const rows = [];
          chosen.forEach(sn => {
            const arr = toArr(sn);
            if (!arr.length) return;
            const hRow = detectHeaderRow(arr);
            const rawH = arr[hRow] || [];
            if (!headers) {
              const ncols = Math.max(rawH.length, ...arr.map(r => r.length));
              headers = [];
              for (let c = 0; c < ncols; c++) { const h = rawH[c]; headers.push((h == null || String(h).trim() === '') ? `عمود ${c + 1}` : String(h).trim()); }
            }
            const ncols = headers.length;
            arr.slice(hRow + 1).forEach(r => {
              const row = []; for (let c = 0; c < ncols; c++) row.push(r[c] == null ? '' : r[c]);
              if (row.some(c => String(c).trim() !== '')) rows.push(row);
            });
          });
          if (!headers) { reject(new Error('الملف لا يحتوي أعمدة')); return; }
          resolve({ fileName: file.name, headers, rows, sheetNames: names, mergedSheets: chosen });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ── مطابقة تلقائية: حقل → فهرس العمود ─────────────────────────────────────
  function autoMap(source, headers) {
    const fields = window.Store.FIELDS[source];
    const map = window.Store.emptyMap(source);
    const used = new Set();
    const normH = headers.map(h => norm(h));
    fields.forEach(f => {
      const syns = SYN[source][f.key] || [];
      let best = { idx: -1, len: 0 };
      normH.forEach((h, idx) => {
        if (used.has(idx) || !h) return;
        syns.forEach(s => { if (h.includes(s) && s.length > best.len) best = { idx, len: s.length }; });
      });
      if (best.idx >= 0) { map[f.key] = best.idx; used.add(best.idx); }
    });
    return map;
  }

  function validateMap(source, map) {
    const missing = window.Store.FIELDS[source].filter(f => f.req && (map[f.key] == null || map[f.key] < 0));
    return { ok: missing.length === 0, missing: missing.map(f => f.label) };
  }

  // ══════════════════════ التصدير ══════════════════════
  const COLS = ['الرقم', 'اللقب', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'مكان الميلاد', 'معيد', 'المعدّل'];
  function rosterAOA(byId, ids, sortBy) {
    const rows = [COLS];
    U.sortStudents(ids.map(id => byId[id]).filter(Boolean), sortBy)
      .forEach((s, i) => rows.push([i + 1, s.lastName || '', s.firstName || '', U.GENDER_LABEL[s.gender] || '', s.birthDate || '', s.birthPlace || '', s.repeating ? 'نعم' : '', s.average != null ? U.fmtAvg(s.average) : '']));
    return rows;
  }

  function exportRosters(state) {
    if (!state.distribution) return false;
    const byId = {}; state.students.forEach(s => { byId[s.id] = s; });
    const wb = XLSX.utils.book_new();
    const stat = [['القسم', 'العدد', 'ذكور', 'إناث', 'المعيدون', 'متوسط القسم', 'متوسط السن']];
    Object.values(state.distribution.byLevel).forEach(lvl => {
      lvl.classes.forEach(c => {
        const st = U.statsOf(c.studentIds.map(id => byId[id]).filter(Boolean));
        const aoa = rosterAOA(byId, c.studentIds, state.config.sortBy);
        aoa.push([]);
        aoa.push([`العدد: ${st.count}`, `الذكور: ${st.males}`, `الإناث: ${st.females}`, `المعيدون: ${st.repeaters}`, `المعدّل: ${st.avg ?? '—'}`, `متوسط السن: ${st.avgAge ?? '—'}`]);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 16 }, { wch: 7 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 9 }];
        XLSX.utils.book_append_sheet(wb, ws, c.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31));
        stat.push([c.name, st.count, st.males, st.females, st.repeaters, st.avg ?? '—', st.avgAge ?? '—']);
      });
    });
    const statWs = XLSX.utils.aoa_to_sheet(stat);
    statWs['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, statWs, 'الإحصائيات');
    XLSX.writeFile(wb, `قوائم_التسجيل_${(state.institution.nextYear || 'القادمة').replace(/\//g, '-')}.xlsx`);
    return true;
  }

  // ══════════════════════ عيّنة مترابطة (4 ملفات برقم تعريف مشترك) ══════════
  const LAST = ['بن علي', 'حمداني', 'زروال', 'بوضياف', 'مرابط', 'سعيدي', 'خليفة', 'عماري', 'بلقاسم', 'شريف', 'دحماني', 'قاسمي', 'بوزيد', 'لعمارة', 'صحراوي', 'بركان'];
  const MF = ['أحمد', 'محمد', 'يوسف', 'إسلام', 'أيوب', 'بلال', 'رياض', 'أنيس'];
  const FF = ['آمنة', 'مريم', 'سارة', 'نور', 'هبة', 'ياسمين', 'رانية', 'سلمى'];
  const PLACES = ['وهران', 'الجزائر', 'قسنطينة', 'عنابة', 'سطيف', 'تلمسان'];
  const SCHOOLS = ['ابتدائية لحمر قادة', 'ابتدائية غزة', 'ابتدائية الأمير خالد', 'ابتدائية ابن باديس', 'ابتدائية محمد ديب', 'ابتدائية فلسطين'];
  const YEAR_WORD = { 1: 'أولى', 2: 'ثانية', 3: 'ثالثة', 4: 'رابعة' };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  function sampleData() {
    const groups = [], decisions = [], orient4 = [], newcomers = [];
    let k = 0;
    for (let g = 1; g <= 4; g++) {
      for (let sec = 1; sec <= 3; sec++) {
        const size = 28 + Math.floor(Math.random() * 8);
        for (let i = 0; i < size; i++) {
          const id = String(1101431010000000 + (k++));
          const isM = Math.random() < 0.52;
          const last = rnd(LAST), first = isM ? rnd(MF) : rnd(FF);
          const bdate = `${2011 + g}-0${1 + Math.floor(Math.random() * 8)}-1${Math.floor(Math.random() * 9)}`;
          groups.push([id, last, first, isM ? 'ذكر' : 'أنثى', YEAR_WORD[g], sec, bdate, rnd(PLACES)]);
          const avg = Math.round((6 + Math.random() * 12) * 100) / 100;
          if (g <= 3) {
            const dec = avg >= 10 ? (Math.random() < 0.95 ? '(ت) ينتقل' : '(ت)يعيد') : (Math.random() < 0.6 ? '(ت)يعيد' : '(ت) ينتقل');
            decisions.push([id, String(avg).replace('.', ','), dec, bdate]);
          } else {
            const rep = avg < 10 && Math.random() < 0.5;
            orient4.push([id, `${last} ${first}`, bdate, String(avg).replace('.', ','), rep ? 'يعيد السنة' : (Math.random() < 0.5 ? 'جدع مشترك آداب' : 'جدع مشترك علوم وتكنولوجيا'), rep ? '--' : 'جدع مشترك علوم وتكنولوجيا']);
          }
        }
      }
    }
    for (let i = 0; i < 96; i++) {
      const isM = Math.random() < 0.51;
      newcomers.push([rnd(LAST), isM ? rnd(MF) : rnd(FF), isM ? 'ذكر' : 'أنثى', `2015-0${1 + Math.floor(Math.random() * 8)}-15`, rnd(SCHOOLS), String(Math.round((5 + Math.random() * 5) * 100) / 100).replace('.', ','), '(ت) ينتقل']);
    }
    return {
      groups:    { fileName: 'عينة_التوزيع_على_الأفواج.xlsx', headers: ['رقم التعريف', 'اللقب', 'الاسم', 'الجنس', 'السنة', 'القسم', 'تاريخ الازدياد', 'مكان الازدياد'], rows: groups },
      decisions: { fileName: 'عينة_القرار_النهائي.xlsx', headers: ['رقم التعريف', 'المعدل السنوي', 'القرار النهائي', 'تاريخ الميلاد'], rows: decisions },
      orient4:   { fileName: 'عينة_توجيه_الرابعة.xlsx', headers: ['رقم التعريف المدرسي', 'اللقب والاسم', 'تاريخ الميلاد', 'معدل ش ت م', 'إقتراح مجلس القسم', 'القرار النهائي (التوجيه)'], rows: orient4 },
      newcomers: { fileName: 'عينة_المنتقلين_للأولى.xlsx', headers: ['اللقب', 'الاسم', 'الجنس', 'تاريخ الميلاد', 'المؤسسة الأصلية', 'معدل القبول', 'قرار اللجنة'], rows: newcomers },
    };
  }

  function downloadSample(source) {
    const data = sampleData()[source];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]), 'البيانات');
    XLSX.writeFile(wb, data.fileName);
  }

  window.Excel = { readFile, autoMap, validateMap, exportRosters, downloadSample, sampleData, READ_OPTS, SYN };
})();
