// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 4: المراجعة والتعديل اليدوي (نقل التلاميذ) + إحصائيات
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { useState, useMemo } = React;
  const { Btn, Badge, InfoBanner, EmptyState, StatCard, Segmented } = window.UI;
  const U = window.U, Icons = window.Icons;
  const SORT_OPTS = [{ value: 'name', label: 'الاسم' }, { value: 'average', label: 'المعدّل' }, { value: 'gender', label: 'الجنس' }];

  function StudentCard({ s, selected, origin, originTitle, onClick, onDragStart, onDragEnd }) {
    return (
      <div className={`student-card${s.repeating ? ' is-repeater' : ''}`}
        draggable onClick={onClick} onDragStart={onDragStart} onDragEnd={onDragEnd}
        style={selected ? { outline: '2px solid var(--primary)', outlineOffset: 1 } : null}
        title={`${U.fullName(s)} · ${s.average != null ? U.fmtAvg(s.average) : 'بلا معدّل'}${s.repeating ? ' · معيد' : ''}${originTitle ? ' · ' + originTitle : ''}`}>
        <span className={`sc-gender ${s.gender === 'M' ? 'm' : s.gender === 'F' ? 'f' : ''}`} />
        <span className="sc-name">{U.fullName(s)}</span>
        {origin && <span className="sc-origin">{origin}</span>}
        {s.repeating && <span className="sc-rep" title="معيد"><Icons.refresh size={11} /></span>}
        <span className="sc-avg">{s.average != null ? U.fmtAvg(s.average) : '—'}</span>
      </div>
    );
  }

  window.Step4 = function Step4() {
    const { state, dispatch } = window.useStore();
    const dist = state.distribution;
    const byId = useMemo(() => { const m = {}; state.students.forEach(s => m[s.id] = s); return m; }, [state.students]);
    // ترقيم المؤسسات الأصلية للمنتقلين (للمفتاح)
    const schools = useMemo(() => {
      const set = [...new Set(state.students.filter(s => s.source === 'newcomers' && s.originSchool).map(s => s.originSchool))].sort((a, b) => a.localeCompare(b, 'ar'));
      const idx = {}; set.forEach((sc, i) => { idx[sc] = i + 1; });
      return { list: set, idx };
    }, [state.students]);
    const originOf = (s) => s.source === 'newcomers' ? (s.originSchool ? 'م' + schools.idx[s.originSchool] : '') : (s.currentClass || '');
    const originTitleOf = (s) => s.source === 'newcomers' ? (s.originSchool || '') : (s.currentClass ? 'القسم القديم: ' + s.currentClass : '');

    const levels = dist ? Object.keys(dist.byLevel).map(Number).sort((a, b) => a - b) : [];
    const [active, setActive] = useState(levels[0] || 1);
    const [selected, setSelected] = useState(null);

    if (!dist) {
      return <EmptyState icon="shuffle" title="لم يتمّ التوزيع بعد"
        action={<Btn kind="ghost" icon="arrowRight" onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}>الذهاب إلى التوزيع</Btn>}>
        شغّل التوزيع الآلي في الخطوة السابقة، ثم عُد إلى هنا لمراجعة الأقسام وتعديلها يدويًا.
      </EmptyState>;
    }

    const lvl = dist.byLevel[active] || dist.byLevel[levels[0]];
    const activeLvl = lvl ? lvl.grade : active;

    const move = (toClass) => {
      if (!selected) return;
      dispatch({ type: 'MOVE_STUDENT', level: activeLvl, studentId: selected, toClass });
      setSelected(null);
    };

    // إحصائيات المستوى
    const classStats = lvl.classes.map(c => ({ c, st: U.statsOf(c.studentIds.map(id => byId[id]).filter(Boolean)) }));
    const means = classStats.map(x => x.st.avg).filter(v => v != null);
    const spread = means.length ? U.round2(Math.max(...means) - Math.min(...means)) : 0;
    const cons = window.Distribution.consistency(lvl.classes, byId);
    const sizes = classStats.map(x => x.st.count);
    const levelTotal = sizes.reduce((a, b) => a + b, 0);

    return (
      <div>
        {/* تبويبات المستويات + ضابط الفرز */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="chip-row">
            {levels.map(L => (
              <button key={L} className={`tchip${active === L ? ' on' : ''}`} onClick={() => { setActive(L); setSelected(null); }}>
                {U.gradeLabel(L)}<span className="tnum">{dist.byLevel[L].classes.length}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>فرز:</span>
            <Segmented value={state.config.sortBy} onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { sortBy: v } })} options={SORT_OPTS} />
          </div>
        </div>

        <div className="stat-grid">
          <StatCard icon="users" value={levelTotal} label={`تلاميذ ${U.gradeLabel(activeLvl)}`} />
          <StatCard kind="info" icon="grid" value={lvl.classes.length} label="عدد الأقسام" sub={sizes.length ? `الحجم ${Math.min(...sizes)}–${Math.max(...sizes)}` : ''} />
          <StatCard kind={cons.score >= 85 ? 'gold' : 'accent'} icon="scale" value={`${cons.score}٪`} label="تناسق المعدّلات بين الأقسام" sub={`فارق المتوسطات ${U.fmtAvg(spread)}`} />
          <StatCard kind="gold" icon="refresh" value={lvl.classes.reduce((a, c) => a + c.studentIds.filter(id => byId[id] && byId[id].repeating).length, 0)} label="المعيدون في المستوى" />
        </div>

        <InfoBanner icon="info" title="التعديل اليدوي">
          <strong>اسحب</strong> بطاقة تلميذ إلى قسم آخر — أو <strong>انقر</strong> التلميذ ثمّ انقر القسم الهدف. تتحدّث الإحصائيات فورًا.
          {selected && <span> · المحدّد الآن: <strong>{U.fullName(byId[selected])}</strong> — انقر قسمًا لنقله.</span>}
        </InfoBanner>

        <div className="class-board">
          {classStats.map(({ c, st }) => (
            <div key={c.name} className="class-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) { dispatch({ type: 'MOVE_STUDENT', level: activeLvl, studentId: id, toClass: c.name }); setSelected(null); }
              }}>
              <div className={`cc-head y${activeLvl}`} onClick={() => move(c.name)} style={selected ? { cursor: 'copy' } : null}>
                <div><div className="cc-name">{c.name}</div><div className="cc-count">{st.count} تلميذ</div></div>
                {st.avg != null && <div className="num-badge" style={{ background: 'rgba(255,255,255,.2)', minWidth: 'auto', padding: '0 8px', width: 'auto' }}>{U.fmtAvg(st.avg)}</div>}
              </div>
              <div className="cc-metrics">
                <span className="cc-metric">♂ <b>{st.males}</b></span>
                <span className="cc-metric">♀ <b>{st.females}</b></span>
                {st.repeaters > 0 && <span className="cc-metric" style={{ color: 'var(--gold)' }}>معيد <b>{st.repeaters}</b></span>}
                {st.avgAge != null && <span className="cc-metric">سن <b>{U.fmtAvg(st.avgAge)}</b></span>}
              </div>
              <div className="cc-body">
                {c.studentIds.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-dim)', fontSize: 12 }}>قسم فارغ — اسحب تلاميذ إليه</div>}
                {U.sortStudents(c.studentIds.map(id => byId[id]).filter(Boolean), state.config.sortBy)
                  .map(s => (
                    <StudentCard key={s.id} s={s} selected={selected === s.id}
                      origin={originOf(s)} originTitle={originTitleOf(s)}
                      onClick={(e) => { e.stopPropagation(); setSelected(selected === s.id ? null : s.id); }}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => {}} />
                  ))}
              </div>
            </div>
          ))}
        </div>

        {activeLvl === 1 && schools.list.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-head"><div className="card-title"><Icons.school /> <span>مفتاح المؤسسات الأصلية للمنتقلين</span></div></div>
            <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {schools.list.map((sc, i) => (
                <span key={i} className="badge neutral" style={{ height: 'auto', padding: '4px 10px' }}><b style={{ color: 'var(--primary)' }}>م{i + 1}</b>&nbsp;— {sc}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
})();
