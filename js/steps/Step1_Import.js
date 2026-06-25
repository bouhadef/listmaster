// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 1: استيراد الملفات الأربعة ومطابقة الأعمدة
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { useState, useRef } = React;
  const { Card, Field, Btn, MiniBtn, InfoBanner, Badge } = window.UI;
  const Icons = window.Icons, U = window.U;

  const SOURCE_META = {
    groups:    { title: 'ملف التوزيع على الأفواج', sub: 'الهوية + الجنس + القسم (1م–4م)', icon: 'users',  req: true,  tag: 'Eleve' },
    decisions: { title: 'قرار مجلس القسم النهائي', sub: 'المعدّل السنوي + القرار (1م–3م) — يُقرأ من كل الأوراق', icon: 'table', req: true, tag: '1م–3م' },
    orient4:   { title: 'توجيه الرابعة متوسط',     sub: 'منه نستخرج معيدي 4م (إقتراح مجلس القسم = يعيد)', icon: 'scale', req: false, tag: '4م' },
    newcomers: { title: 'المنتقلون إلى الأولى متوسط', sub: 'التلاميذ الجدد + معدّل القبول', icon: 'school', req: false, tag: '1م جديد' },
  };
  const ORDER = ['groups', 'decisions', 'orient4', 'newcomers'];

  function Dropzone({ source, onPick }) {
    const inputRef = useRef(null);
    const [drag, setDrag] = useState(false);
    const [busy, setBusy] = useState(false);
    const meta = SOURCE_META[source];
    const I = Icons[meta.icon];
    const handle = async (file) => {
      if (!file) return;
      setBusy(true);
      try { await onPick(file); } catch (e) { alert('تعذّر قراءة الملف: ' + e.message); } finally { setBusy(false); }
    };
    return (
      <div className={`dropzone${drag ? ' drag' : ''}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => handle(e.target.files[0])} />
        <div className="dz-ico"><I /></div>
        <div className="dz-title">{busy ? 'جارٍ القراءة…' : 'اسحب الملف هنا أو انقر للاختيار'}</div>
        <div className="dz-sub">{meta.sub}</div>
        <div className="dz-formats">يدعم: ‎.xlsx ‎.xls ‎.csv</div>
      </div>
    );
  }

  function ColumnMapper({ source, imp, map, dispatch }) {
    const fields = window.Store.FIELDS[source];
    const valid = window.Excel.validateMap(source, map);
    const previewRows = imp.rows.slice(0, 4);
    const sheetNote = imp.mergedSheets && imp.mergedSheets.length > 1 ? ` · دُمجت ${imp.mergedSheets.length} ورقة` : (imp.mergedSheets && imp.sheetNames && imp.sheetNames.length > 1 ? ` · الورقة: ${imp.mergedSheets[0]}` : '');
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <Badge tone="success" dot>{imp.fileName} — {imp.rows.length} سطرًا{sheetNote}</Badge>
          <div style={{ display: 'flex', gap: 8 }}>
            <MiniBtn icon="refresh" onClick={() => dispatch({ type: 'SET_COLUMN_MAP', source, patch: window.Excel.autoMap(source, imp.headers) })}>مطابقة تلقائية</MiniBtn>
            <MiniBtn icon="trash" danger onClick={() => dispatch({ type: 'CLEAR_IMPORT', source })}>إزالة</MiniBtn>
          </div>
        </div>
        {!valid.ok && <InfoBanner kind="warn" icon="alert" title="حقول مطلوبة غير مُسندة">أسنِد: <strong>{valid.missing.join('، ')}</strong></InfoBanner>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
          {fields.map(f => {
            const cur = map[f.key];
            const unmapped = f.req && (cur == null || cur < 0);
            return (
              <Field key={f.key} label={f.label} req={f.req} hint={f.hint}>
                <select className={`sel${cur != null && cur >= 0 ? ' has-value' : ''}${unmapped ? ' unmapped' : ''}`}
                  value={cur == null ? '' : cur}
                  onChange={(e) => dispatch({ type: 'SET_COLUMN_MAP', source, patch: { [f.key]: e.target.value === '' ? null : +e.target.value } })}>
                  <option value="">— غير مُسند —</option>
                  {imp.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </Field>
            );
          })}
        </div>
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
          <table className="grid">
            <thead><tr>{fields.filter(f => map[f.key] != null && map[f.key] >= 0).map(f => <th key={f.key}>{f.label}</th>)}</tr></thead>
            <tbody>
              {previewRows.map((row, ri) => (
                <tr key={ri}>
                  {fields.filter(f => map[f.key] != null && map[f.key] >= 0).map(f => {
                    const v = row[map[f.key]];
                    let disp = v == null ? '' : String(v);
                    if (f.key === 'birthDate') disp = U.fmtDate(v) || disp; // تنسيق التاريخ (SheetJS قد يُرجع كائن Date خام)
                    if (f.key === 'decision') disp = `${disp} → ${U.DECISION_LABEL[U.parseDecision(v)]}`;
                    if (f.key === 'proposal') disp = `${disp} → ${/يعيد/.test(U.normalizeArabic(v)) ? 'معيد' : 'يغادر'}`;
                    if (f.key === 'gender') { const g = U.parseGender(v); disp = g ? `${disp} → ${U.GENDER_LABEL[g]}` : disp; }
                    if (f.key === 'year') { const gr = U.yearWordToGrade(v); disp = gr ? `${disp} → ${gr}م` : disp; }
                    return <td key={f.key}>{disp || '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  window.Step1 = function Step1() {
    const { state, dispatch } = window.useStore();
    const inst = state.institution;

    const onPick = async (source, file) => {
      const data = await window.Excel.readFile(file, window.Excel.READ_OPTS[source]);
      dispatch({ type: 'SET_IMPORT', source, data });
      dispatch({ type: 'SET_COLUMN_MAP', source, patch: window.Excel.autoMap(source, data.headers) });
    };

    const loadSampleAll = () => {
      const d = window.Excel.sampleData();
      ORDER.forEach(source => {
        dispatch({ type: 'SET_IMPORT', source, data: d[source] });
        dispatch({ type: 'SET_COLUMN_MAP', source, patch: window.Excel.autoMap(source, d[source].headers) });
      });
    };

    const patchInst = (patch) => dispatch({ type: 'PATCH_INSTITUTION', patch });

    return (
      <div>
        <InfoBanner icon="lock" title="خصوصية بيانات التلاميذ">
          المعالجة محلية بالكامل في متصفّحك — لا تُرفع أيّ بيانات إلى أيّ خادم (احترامًا للقانون 18-07).
          <span style={{ marginInlineStart: 10 }}><MiniBtn icon="sparkles" onClick={loadSampleAll}>تحميل عيّنة كاملة (4 ملفات) للتجربة</MiniBtn></span>
        </InfoBanner>

        <Card num="1" title="بيانات المؤسسة" sub="تظهر في رؤوس القوائم المطبوعة" icon="school">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <Field label="اسم المؤسسة" req><input className="tx" value={inst.name} placeholder="متوسطة ..." onChange={(e) => patchInst({ name: e.target.value })} /></Field>
            <Field label="المديرية"><input className="tx" value={inst.direction} placeholder="مديرية التربية لولاية ..." onChange={(e) => patchInst({ direction: e.target.value })} /></Field>
            <Field label="السنة الحالية"><input className="tx" value={inst.currentYear} placeholder="2025/2026" onChange={(e) => patchInst({ currentYear: e.target.value })} /></Field>
            <Field label="السنة القادمة" req><input className="tx" value={inst.nextYear} placeholder="2026/2027" onChange={(e) => patchInst({ nextYear: e.target.value })} /></Field>
            <Field label="تاريخ حساب السن" hint="افتراضيًا 31 ديسمبر للسنة القادمة"><input className="tx" type="date" value={state.config.refDate} onChange={(e) => dispatch({ type: 'PATCH_CONFIG', patch: { refDate: e.target.value } })} /></Field>
          </div>
        </Card>

        {ORDER.map((source, i) => {
          const meta = SOURCE_META[source];
          const imp = state.imports[source];
          return (
            <Card key={source} num={i + 2} title={meta.title} icon={meta.icon}
              sub={meta.req ? 'مطلوب' : 'اختياري'}
              meta={<Badge tone={imp ? 'success' : (meta.req ? 'warning' : 'neutral')}>{meta.tag}</Badge>}>
              {imp ? <ColumnMapper source={source} imp={imp} map={state.columnMap[source]} dispatch={dispatch} />
                   : <Dropzone source={source} onPick={(file) => onPick(source, file)} />}
            </Card>
          );
        })}
      </div>
    );
  };
})();
