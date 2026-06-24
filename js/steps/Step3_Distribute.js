// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 3: تشغيل التوزيع الآلي والإشراف عليه
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { Card, Btn, InfoBanner, Badge, EmptyState } = window.UI;
  const U = window.U, Icons = window.Icons, D = window.Distribution;

  const CHANGE_META = {
    grow:   { tone: 'success', label: 'زيادة قسم', icon: 'plus' },
    shrink: { tone: 'danger',  label: 'تقلّص الأقسام', icon: 'merge' },
    same:   { tone: 'neutral', label: 'مطابق', icon: 'check' },
    fresh:  { tone: 'info',    label: 'تقسيم جديد', icon: 'sparkles' },
  };

  window.Step3 = function Step3() {
    const { state, dispatch } = window.useStore();
    const dist = state.distribution;
    const byId = React.useMemo(() => { const m = {}; state.students.forEach(s => m[s.id] = s); return m; }, [state.students]);

    const configuredLevels = [1, 2, 3, 4].filter(L => ((state.config.levels[L] || {}).nextClasses || 0) > 0);
    const canRun = state.students.length > 0 && configuredLevels.length > 0;

    const run = () => dispatch({ type: 'SET_DISTRIBUTION', distribution: D.run(state) });

    if (!canRun) {
      return <EmptyState icon="settings" title="أكمل الإعداد أولاً"
        action={<Btn kind="ghost" icon="arrowRight" onClick={() => dispatch({ type: 'SET_STEP', step: 2 })}>الذهاب إلى الإعداد</Btn>}>
        حدّد عدد الأقسام لكل مستوى في خطوة الإعداد (مستوى واحد على الأقل) قبل تشغيل التوزيع.
      </EmptyState>;
    }

    // كشف المستويات المتقلّصة + اختيار القسم الحالي الذي يُحَلّ
    const shrinkLevels = [1, 2, 3, 4].map(L => {
      const n = (state.config.levels[L] || {}).nextClasses || 0;
      if (n <= 0) return null;
      const secs = [...new Set(state.students.filter(s => s.decision === 'pass' && s.grade === L - 1 && s.section != null).map(s => s.section))].sort((a, b) => a - b);
      if (secs.length <= n) return null;
      return { L, n, origin: secs, need: secs.length - n };
    }).filter(Boolean);

    const dissolvedFor = (sl) => (state.config.dissolvedSections[sl.L] && state.config.dissolvedSections[sl.L].length)
      ? state.config.dissolvedSections[sl.L] : sl.origin.slice(sl.n);   // افتراضي: الأعلى ترقيمًا
    const toggleDissolve = (sl, sec) => {
      const ds = JSON.parse(JSON.stringify(state.config.dissolvedSections || {}));
      const set = new Set(dissolvedFor(sl));
      if (set.has(sec)) set.delete(sec); else set.add(sec);
      ds[sl.L] = [...set].sort((a, b) => a - b);
      dispatch({ type: 'PATCH_CONFIG', patch: { dissolvedSections: ds } });
    };

    return (
      <div>
        <div className="summary-bar">
          <div className="summary-label">
            <Icons.shuffle />
            <div><div className="lbl">{dist ? 'تمّ التوزيع' : 'جاهز للتوزيع'}</div>
              <div className="val">{state.config.homogeneity === 'cohort' ? 'تماسك الفوج + موازنة' : 'تجانس كامل (الثعبان)'}{state.config.balanceGender ? ' · موازنة الجنس' : ''}</div></div>
          </div>
          <Btn kind={dist ? 'accent' : 'primary'} icon={dist ? 'refresh' : 'shuffle'} size="lg"
            onClick={run} style={{ background: '#fff', color: 'var(--primary)' }}>
            {dist ? 'إعادة التوزيع' : 'تشغيل التوزيع الآلي'}
          </Btn>
        </div>

        {shrinkLevels.length > 0 && <Card icon="merge" title="حلّ الأقسام عند التقليص" sub="اختر القسم الحالي الذي يُحَلّ (§3.2)">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            اختر من <strong>أقسام السنة الحالية</strong> القسمَ/الأقسامَ التي ستُحَلّ — يُوزَّع تلاميذها بالتوازن على الأقسام الباقية، والأقسام الباقية تنتقل بفوجها. ثمّ اضغط «{dist ? 'إعادة التوزيع' : 'تشغيل التوزيع'}».
          </div>
          {shrinkLevels.map(sl => {
            const chosen = dissolvedFor(sl);
            const ok = chosen.length === sl.need;
            return (
              <div key={sl.L} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{U.gradeLabel(sl.L)}</span>
                  <Badge tone="neutral">{sl.origin.length} قسم حالي ← {sl.n} قادمة</Badge>
                  <Badge tone={ok ? 'success' : 'warning'}>محلول {chosen.length} / مطلوب {sl.need}</Badge>
                </div>
                <div className="chip-row">
                  {sl.origin.map(sec => {
                    const on = chosen.includes(sec);
                    return <button key={sec} className="tchip" onClick={() => toggleDissolve(sl, sec)}
                      style={on ? { background: 'var(--danger-soft)', borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 800 } : null}>
                      {on && <Icons.merge size={12} />}{U.className(sl.L - 1, sec)}
                    </button>;
                  })}
                </div>
              </div>
            );
          })}
        </Card>}

        {!dist && <InfoBanner icon="info" title="كيف يعمل التوزيع؟">
          سيُكوِّن البرنامج أقسام كل مستوى وفق المعيار المختار، مع <strong>توزيع المعيدين</strong> بالتوازن و<strong>معالجة تقلّص/زيادة الأقسام</strong> تلقائيًا. يمكنك بعدها المراجعة والتعديل اليدوي.
        </InfoBanner>}

        {dist && dist.warnings.length > 0 && <InfoBanner kind="warn" icon="alert" title="ملاحظات الجودة">
          {dist.warnings.join(' — ')}
        </InfoBanner>}

        {dist && Object.values(dist.byLevel).map(lvl => {
          const cm = CHANGE_META[lvl.change] || CHANGE_META.same;
          const ChIco = Icons[cm.icon];
          return (
            <Card key={lvl.grade} icon="grid" title={U.gradeLabel(lvl.grade)} sub={`${lvl.classes.length} أقسام`}
              meta={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lvl.consistency && <Badge tone={lvl.consistency.score >= 85 ? 'success' : lvl.consistency.score >= 70 ? 'gold' : 'danger'}><Icons.scale size={12} /> تناسق {lvl.consistency.score}٪</Badge>}
                <Badge tone={cm.tone}><ChIco size={12} /> {cm.label}</Badge>
              </div>}>
              {lvl.notes.map((nt, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>• {nt}</div>)}
              {lvl.dissolved.length > 0 && <div style={{ fontSize: 12, marginBottom: 10 }}>
                <Badge tone="danger"><Icons.merge size={12} /> {lvl.dissolved.length} تلميذ من أقسام محلولة أُعيد توزيعهم</Badge>
              </div>}
              <div className="chip-row">
                {lvl.classes.map(c => {
                  const st = U.statsOf(c.studentIds.map(id => byId[id]).filter(Boolean));
                  return (
                    <div key={c.name} className="tchip" style={{ height: 'auto', padding: '8px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4, cursor: 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, color: 'var(--text)' }}>{c.name}</span>
                        <Badge tone="primary">{st.count}</Badge>
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                        <span>♂ {st.males}</span><span>♀ {st.females}</span>
                        {st.avg != null && <span>معدّل {U.fmtAvg(st.avg)}</span>}
                        {st.repeaters > 0 && <span style={{ color: 'var(--gold)' }}>معيد {st.repeaters}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {dist && <InfoBanner kind="success" icon="checkCircle" title="التوزيع جاهز">
          انتقل إلى <strong>المراجعة</strong> لتعديل التوزيع يدويًا (نقل التلاميذ بين الأقسام) ومتابعة الإحصائيات الحيّة.
        </InfoBanner>}
      </div>
    );
  };
})();
