// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 5: الإحصائيات والقوائم الاسمية والتصدير
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { useState, useMemo } = React;
  const { Card, Btn, MiniBtn, Badge, InfoBanner, EmptyState, StatCard, GenderBar, Segmented } = window.UI;
  const SORT_OPTS = [{ value: 'name', label: 'اللقب والاسم' }, { value: 'average', label: 'المعدّل' }, { value: 'gender', label: 'الجنس' }];
  const consTone = (s) => s >= 85 ? 'success' : s >= 70 ? 'gold' : 'danger';
  const U = window.U, Icons = window.Icons;

  const BRACKETS = [
    { lo: 0, hi: 8, label: 'أقل من 8' },
    { lo: 8, hi: 10, label: '8 – 9.99' },
    { lo: 10, hi: 12, label: '10 – 11.99' },
    { lo: 12, hi: 14, label: '12 – 13.99' },
    { lo: 14, hi: 16, label: '14 – 15.99' },
    { lo: 16, hi: 21, label: '16 فأكثر' },
  ];
  const bracketize = (students) => {
    const counts = BRACKETS.map(() => 0);
    students.forEach(s => { if (s.average == null) return; const i = BRACKETS.findIndex(b => s.average >= b.lo && s.average < b.hi); if (i >= 0) counts[i]++; });
    return counts;
  };

  window.Step5 = function Step5() {
    const { state, dispatch } = window.useStore();
    const dist = state.distribution;
    const inst = state.institution;
    const byId = useMemo(() => { const m = {}; state.students.forEach(s => m[s.id] = s); return m; }, [state.students]);
    const [showRosters, setShowRosters] = useState(true);

    if (!dist) {
      return <EmptyState icon="printer" title="لا توجد قوائم بعد"
        action={<Btn kind="ghost" icon="arrowRight" onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}>الذهاب إلى التوزيع</Btn>}>
        شغّل التوزيع أولًا، ثم يمكنك هنا استعراض الإحصائيات وطباعة القوائم الاسمية وتصديرها.
      </EmptyState>;
    }

    const allClasses = Object.values(dist.byLevel).flatMap(l => l.classes);
    const totalStudents = allClasses.reduce((a, c) => a + c.studentIds.length, 0);

    return (
      <div>
        <div className="summary-bar no-print">
          <div className="summary-label">
            <Icons.list />
            <div><div className="lbl">القوائم الاسمية جاهزة</div>
              <div className="val">{allClasses.length} قسمًا · {totalStudents} تلميذًا · {inst.nextYear || 'السنة القادمة'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn kind="ghost" icon="download" onClick={() => window.Excel.exportRosters(state)} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>تصدير Excel</Btn>
            <Btn icon="printer" onClick={() => window.print()} style={{ background: '#fff', color: 'var(--primary)' }}>طباعة / PDF</Btn>
          </div>
        </div>

        {(!inst.name) && <InfoBanner kind="warn" icon="alert" title="اسم المؤسسة فارغ" className="no-print">أضف اسم المؤسسة في خطوة الاستيراد ليظهر في رؤوس القوائم المطبوعة.</InfoBanner>}

        {/* ── الإحصائيات ── */}
        <div className="no-print">
          {Object.values(dist.byLevel).map(lvl => {
            const levelStudents = lvl.classes.flatMap(c => c.studentIds.map(id => byId[id]).filter(Boolean));
            const lst = U.statsOf(levelStudents);
            const brackets = bracketize(levelStudents);
            const maxB = Math.max(1, ...brackets);
            return (
              <Card key={lvl.grade} icon="chart" title={`إحصائيات ${U.gradeLabel(lvl.grade)}`} sub={`${lst.count} تلميذ`}
                meta={lvl.consistency && <Badge tone={consTone(lvl.consistency.score)}><Icons.scale size={12} /> تناسق المعدّلات {lvl.consistency.score}٪</Badge>}>
                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table className="grid">
                    <thead><tr><th>القسم</th><th>العدد</th><th>ذكور</th><th>إناث</th><th>التوزيع</th><th>المعيدون</th><th>متوسط القسم</th><th>متوسط السن</th></tr></thead>
                    <tbody>
                      {lvl.classes.map(c => {
                        const st = U.statsOf(c.studentIds.map(id => byId[id]).filter(Boolean));
                        return <tr key={c.name}>
                          <td className="name-cell">{c.name}</td>
                          <td><Badge tone="primary">{st.count}</Badge></td>
                          <td>{st.males}</td><td>{st.females}</td>
                          <td style={{ minWidth: 110 }}><GenderBar males={st.males} females={st.females} /></td>
                          <td>{st.repeaters > 0 ? <Badge tone="gold">{st.repeaters}</Badge> : '—'}</td>
                          <td><window.UI.AvgPill value={st.avg} /></td>
                          <td>{st.avgAge != null ? U.fmtAvg(st.avgAge) : '—'}</td>
                        </tr>;
                      })}
                      <tr className="alt" style={{ fontWeight: 800 }}>
                        <td className="name-cell">المجموع/المتوسط</td>
                        <td><Badge tone="success">{lst.count}</Badge></td>
                        <td>{lst.males}</td><td>{lst.females}</td>
                        <td><GenderBar males={lst.males} females={lst.females} /></td>
                        <td>{lst.repeaters}</td>
                        <td><window.UI.AvgPill value={lst.avg} /></td>
                        <td>{lst.avgAge != null ? U.fmtAvg(lst.avgAge) : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* توزيع شرائح المعدّل */}
                {lst.avg != null && <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>توزيع التلاميذ حسب شريحة المعدّل</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BRACKETS.length}, 1fr)`, gap: 8 }}>
                    {BRACKETS.map((b, i) => (
                      <div key={i} style={{ textAlign: 'center' }}>
                        <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                          <div style={{ width: 28, height: `${(brackets[i] / maxB) * 100}%`, minHeight: 3, borderRadius: '5px 5px 0 0', background: i < 2 ? 'var(--danger)' : i < 3 ? 'var(--warning)' : 'var(--success)' }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{brackets[i]}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                </div>}
              </Card>
            );
          })}
        </div>

        {/* ── معاينة/طباعة القوائم الاسمية ── */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 2px 14px', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>القوائم الاسمية</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>فرز حسب:</span>
            <Segmented value={state.config.sortBy} onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { sortBy: v } })} options={SORT_OPTS} />
            <MiniBtn icon="eye" onClick={() => setShowRosters(v => !v)}>{showRosters ? 'إخفاء المعاينة' : 'إظهار المعاينة'}</MiniBtn>
          </div>
        </div>

        {showRosters && allClasses.map(c => {
          const students = U.sortStudents(c.studentIds.map(id => byId[id]).filter(Boolean), state.config.sortBy);
          const rM = students.filter(s => s.gender === 'M').length;
          const rF = students.filter(s => s.gender === 'F').length;
          const rR = students.filter(s => s.repeating).length;
          return (
            <div key={c.name} className="roster-sheet">
              <div className="roster-head">
                <div className="r-org">{inst.name || 'المؤسسة'}<small>{inst.direction || ''}</small></div>
                <div className="r-meta">قائمة اسمية — القسم {c.name}<small>{U.gradeLabel(c.grade)} · السنة الدراسية {inst.nextYear || ''}</small></div>
              </div>
              <table className="roster">
                <thead><tr><th style={{ width: 40 }}>الرقم</th><th>اللقب</th><th>الاسم</th><th style={{ width: 60 }}>الجنس</th><th style={{ width: 120 }}>تاريخ الميلاد</th><th>مكان الميلاد</th><th style={{ width: 50 }}>معيد</th></tr></thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td><td>{s.lastName}</td><td>{s.firstName}</td>
                      <td>{U.GENDER_LABEL[s.gender] || ''}</td><td>{s.birthDate || ''}</td>
                      <td>{s.birthPlace || ''}</td><td style={{ textAlign: 'center' }}>{s.repeating ? '✓' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="roster-stats">
                <span>العدد الإجمالي: <b>{students.length}</b></span>
                <span>الذكور: <b>{rM}</b></span>
                <span>الإناث: <b>{rF}</b></span>
                <span>المعيدون: <b>{rR}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
})();
