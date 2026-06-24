// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 2: إعداد أقسام السنة القادمة + معيار التجانس
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { Card, Field, Btn, MiniBtn, InfoBanner, Segmented, Toggle, Badge, StatCard, EmptyState } = window.UI;
  const U = window.U, Icons = window.Icons;

  // تفصيل مُجمَّع كل مستوى قادم
  function levelBreakdown(students, L) {
    const pool = students.filter(s => s.nextGrade === L);
    const cohort = pool.filter(s => s.decision === 'pass' && s.grade === L - 1 && s.section != null);
    const repeaters = pool.filter(s => s.repeating);
    const newcomers = pool.filter(s => s.source === 'newcomers');
    const originSections = new Set(cohort.map(s => s.section));
    const st = U.statsOf(pool);
    return { pool, cohort, repeaters, newcomers, originCount: originSections.size, st };
  }

  window.Step2 = function Step2() {
    const { state, dispatch } = window.useStore();
    const students = state.students;

    if (!students.length) {
      return <EmptyState icon="upload" title="لا توجد بيانات بعد"
        action={<Btn kind="ghost" icon="arrowRight" onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}>العودة إلى الاستيراد</Btn>}>
        ارجع إلى خطوة الاستيراد وحمّل ملف نتائج نهاية السنة (وملف المنتقلين للسنة الأولى) ثم أكمل مطابقة الأعمدة.
      </EmptyState>;
    }

    const leaving = students.filter(s => s.decision === 'leave').length;
    const grade4Secondary = students.filter(s => s.grade === 4 && s.decision === 'leave').length;
    const unmatched = students.filter(s => s.unmatched).length;
    const totalNext = students.filter(s => s.nextGrade != null).length;

    const applySuggestion = () => {
      const sug = window.Distribution.suggestClasses(state);
      Object.entries(sug).forEach(([L, n]) => dispatch({ type: 'SET_LEVEL_CLASSES', level: +L, n }));
    };

    return (
      <div>
        <div className="stat-grid">
          <StatCard icon="users" value={totalNext} label="إجمالي تلاميذ السنة القادمة" />
          <StatCard kind="info" icon="school" value={students.filter(s => s.source === 'newcomers').length} label="منتقلون من الابتدائية" />
          <StatCard kind="gold" icon="refresh" value={students.filter(s => s.repeating).length} label="المعيدون" />
          <StatCard kind="accent" icon="arrowLeft" value={leaving} label="مغادرون / موجّهون" sub={`${grade4Secondary} من 4م نحو الثانوي`} />
        </div>

        {unmatched > 0 && <InfoBanner kind="warn" icon="alert" title={`${unmatched} تلميذًا في ملف التوزيع بلا قرار مطابق في ملف مجلس القسم`}>
          غالبًا اختلاف بين الملفين في رقم التعريف. يُعامَلون حاليًا حسب: «<strong>{state.config.unknownPolicy === 'pass' ? 'اعتبارهم ناجحين (ينتقلون)' : 'استبعادهم'}</strong>» — غيّرها من بطاقة «معيار التوزيع» أدناه.
        </InfoBanner>}

        <Card num="1" title="معيار التوزيع" icon="settings">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
            <Field label="مبدأ التجانس" hint="كيف تُكوَّن الأقسام للمستويات 2م–4م">
              <Segmented value={state.config.homogeneity}
                onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { homogeneity: v } })}
                options={[{ value: 'cohort', label: 'تماسك الفوج' }, { value: 'serpentine', label: 'تجانس كامل (الثعبان)' }]} />
            </Field>
            <Field label="موازنة الجنس" hint="توزيع الذكور/الإناث بالتوازن عبر الأقسام">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 36 }}>
                <Toggle on={state.config.balanceGender} onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { balanceGender: v } })} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{state.config.balanceGender ? 'مفعّلة' : 'معطّلة'}</span>
              </div>
            </Field>
            <Field label="تلاميذ بلا قرار مطابق" hint="الموجودون في ملف التوزيع دون قرار في ملف مجلس القسم">
              <Segmented value={state.config.unknownPolicy}
                onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { unknownPolicy: v } })}
                options={[{ value: 'pass', label: 'اعتبارهم ناجحين' }, { value: 'exclude', label: 'استبعادهم' }]} />
            </Field>
            <Field label="معدّل قبول المنتقلين (1م)" hint="معدّل الابتدائي عادةً على /10 — يُضرب ×2 ليوافق معدّل المعيدين /20">
              <Segmented value={state.config.newcomerOutOf10}
                onChange={(v) => dispatch({ type: 'PATCH_CONFIG', patch: { newcomerOutOf10: v } })}
                options={[{ value: true, label: 'على 10 (يُضرب ×2)' }, { value: false, label: 'على 20 (كما هو)' }]} />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            {state.config.homogeneity === 'cohort'
              ? <InfoBanner icon="users" title="تماسك الفوج (الافتراضي)">ينتقل تلاميذ القسم معًا إلى القسم المناظر (1م1 ← 2م1)، ثم يُوزَّع المعيدون والمنتقلون لموازنة المعدّل والجنس.</InfoBanner>
              : <InfoBanner icon="shuffle" title="تجانس كامل (الثعبان)">تُرتَّب جميع تلاميذ المستوى حسب المعدّل ويُوزَّعون بطريقة متعرّجة لتساوي متوسطات الأقسام — مع تجاهُل تماسك الفوج.</InfoBanner>}
          </div>
        </Card>

        <Card num="2" title="عدد أقسام كل مستوى" sub="للسنة الدراسية القادمة"
          meta={<MiniBtn icon="sparkles" onClick={applySuggestion}>اقتراح آلي (≈34/قسم)</MiniBtn>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {[1, 2, 3, 4].map(L => {
              const b = levelBreakdown(students, L);
              const n = (state.config.levels[L] || {}).nextClasses || 0;
              const perClass = n > 0 ? Math.round(b.pool.length / n) : 0;
              let change = null;
              if (L > 1 && n > 0 && b.originCount > 0) {
                if (n > b.originCount) change = { t: `+${n - b.originCount} قسم جديد`, tone: 'success' };
                else if (n < b.originCount) change = { t: `−${b.originCount - n} قسم محلول`, tone: 'danger' };
                else change = { t: 'مطابق', tone: 'neutral' };
              }
              return (
                <div key={L} className="class-col" style={{ border: '1px solid var(--border)' }}>
                  <div className={`cc-head y${L}`}>
                    <div><div className="cc-name">{U.gradeLabel(L)}</div><div className="cc-count">{b.pool.length} تلميذ مرشّح</div></div>
                    <div className="num-badge" style={{ background: 'rgba(255,255,255,.2)' }}>{L}م</div>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {L === 1
                        ? <Badge tone="info">{b.newcomers.length} منتقل من الابتدائية</Badge>
                        : <Badge tone="primary">{b.cohort.length} ناجح من {L - 1}م</Badge>}
                      <Badge tone="gold">{b.repeaters.length} معيد</Badge>
                      {b.st.avg != null && <Badge tone="neutral">معدّل {U.fmtAvg(b.st.avg)}</Badge>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <Field label="عدد الأقسام">
                        <input className="num-input" type="number" min="0" max="20" value={n}
                          onChange={(e) => dispatch({ type: 'SET_LEVEL_CLASSES', level: L, n: U.clamp(parseInt(e.target.value) || 0, 0, 20) })} />
                      </Field>
                      <div style={{ textAlign: 'left' }}>
                        {n > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>≈ {perClass} تلميذ/قسم</div>}
                        {change && <div style={{ marginTop: 4 }}><Badge tone={change.tone}>{change.t}</Badge></div>}
                        {L > 1 && b.originCount > 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>الأقسام الأصلية: {b.originCount}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  };
})();
