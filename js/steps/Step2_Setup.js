// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — Step 2: إعداد أقسام السنة القادمة + معيار التجانس
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { useState, useMemo } = React;
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

  // قائمة تلاميذ مدمجة (اسم + قسم + معدّل) مع حدّ أعلى للعرض
  function StudentChips({ items, max = 80 }) {
    const shown = items.slice(0, max);
    const rest = items.length - shown.length;
    return (
      <div className="chip-row" style={{ marginTop: 6 }}>
        {shown.map((x, i) => (
          <span key={i} className="tchip" style={{ height: 'auto', padding: '5px 10px', cursor: 'default', gap: 7 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{x.name}</span>
            {x.cls && x.cls !== '—' && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>{x.cls}</span>}
            {typeof x.average === 'number' && <span style={{ fontSize: 11, fontWeight: 800, color: x.average < 10 ? 'var(--danger)' : 'var(--text-muted)' }}>{U.fmtAvg(x.average)}</span>}
          </span>
        ))}
        {rest > 0 && <span className="tchip" style={{ height: 'auto', padding: '5px 10px', cursor: 'default', color: 'var(--text-muted)', fontWeight: 700 }}>+{rest} آخرين…</span>}
      </div>
    );
  }

  // لوحة فحص جودة البيانات — تنبّه المستخدم إلى الخلل المحتمل في ملفّاته
  function DataQualityCard({ state }) {
    const audit = useMemo(() => window.Validation.audit(state), [state.students, state.imports, state.columnMap]);
    const [open, setOpen] = useState('A');
    if (!audit.hasDecisionsFile) return null;

    if (audit.ok) {
      return (
        <InfoBanner kind="success" icon="checkCircle" title="فحص جودة البيانات: لا خلل">
          كل تلاميذ ملف التوزيع لهم قرار مطابق، ولا أرقام تعريف مكرّرة أو زائدة في ملف القرارات. ✓
        </InfoBanner>
      );
    }

    const eff = (open === 'A' && !audit.noDecision.length) ? (audit.duplicateDecisions.length ? 'C' : 'B') : open;
    const toggle = (k) => setOpen(eff === k ? null : k);
    const section = ({ k, tone, icon, title, count, hint, children }) => {
      const Ico = Icons[icon];
      const Chev = eff === k ? Icons.chevDown : Icons.chevRight;
      return (
        <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
          <button onClick={() => toggle(k)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: 'var(--bg-surface)', border: 'none', cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit' }}>
            <span style={{ color: `var(--${tone})`, display: 'flex' }}><Ico size={18} /></span>
            <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{title}</span>
            <Badge tone={tone}>{count}</Badge>
            <span style={{ color: 'var(--text-dim)', display: 'flex' }}><Chev size={16} /></span>
          </button>
          {eff === k && (
            <div style={{ padding: '4px 14px 14px' }}>
              {hint && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 8px', lineHeight: 1.6 }}>{hint}</p>}
              {children}
            </div>
          )}
        </div>
      );
    };

    return (
      <Card icon="alert" title="فحص جودة البيانات" sub="خلل محتمل في ملفّاتك — راجِعه قبل التوزيع"
        meta={<Badge tone="warning">{audit.issues} ملاحظة</Badge>}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.7 }}>
          هذه تنبيهات حول <strong>ملفّاتك المستورَدة</strong> (وليست أخطاء في البرنامج). صحّح الملف المعنيّ ثم أعِد استيراده لتختفي الملاحظة.
        </p>

        {audit.noDecision.length > 0 && section({
          k: 'A', tone: 'danger', icon: 'user', count: `${audit.noDecision.length} تلميذ`,
          title: 'تلاميذ بلا قرار / معدّل',
          hint: `موجودون في ملف التوزيع لكن لا سطر لهم في ملف القرارات (رقم تعريف غير متطابق أو قسم غائب كليًّا) — سيظهرون بلا معدّل «—». يُعامَلون حاليًا كـ«${state.config.unknownPolicy === 'pass' ? 'ناجحين (ينتقلون)' : 'مستبعَدين'}» (تُغيَّر من «معيار التوزيع» أدناه).`,
          children: audit.noDecisionClasses.map(c => (
            <div key={c.cls} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{c.cls}</span>
                <Badge tone={c.whole ? 'danger' : 'neutral'}>{c.count} تلميذ</Badge>
                {c.whole && <Badge tone="danger">⚠ القسم بأكمله غائب عن ملف القرارات</Badge>}
              </div>
              <StudentChips items={c.students} />
            </div>
          )),
        })}

        {audit.duplicateDecisions.length > 0 && section({
          k: 'C', tone: 'gold', icon: 'refresh', count: `${audit.duplicateDecisions.length} مكرّر`,
          title: 'أرقام تعريف مكرّرة في ملف القرارات',
          hint: 'نفس رقم التعريف ورد أكثر من مرّة — غالبًا بسبب نسخ ورقة قسم مرّتين، ممّا قد يُزيح ترقيم الأقسام ويُسقِط قسمًا.',
          children: <StudentChips items={audit.duplicateDecisions.map(d => ({ name: d.name, cls: `مكرّر ×${d.count}` }))} />,
        })}

        {audit.orphanDecisions.length > 0 && section({
          k: 'B', tone: 'warning', icon: 'users', count: `${audit.orphanDecisions.length} تلميذ`,
          title: 'تلاميذ في ملف القرارات غير موجودين في ملف التوزيع',
          hint: 'لهم قرار/معدّل لكنهم غائبون عن ملف التوزيع (Eleve) — قد يكونون غادروا المؤسسة، أو رقم تعريفهم مختلف بين الملفّين.',
          children: <StudentChips items={audit.orphanDecisions} />,
        })}
      </Card>
    );
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
    const totalNext = students.filter(s => s.nextGrade != null).length;

    const applySuggestion = () => {
      const sug = window.Distribution.suggestClasses(state);
      Object.entries(sug).forEach(([L, n]) => dispatch({ type: 'SET_LEVEL_CLASSES', level: +L, n }));
    };

    return (
      <div>
        <DataQualityCard state={state} />

        <div className="stat-grid">
          <StatCard icon="users" value={totalNext} label="إجمالي تلاميذ السنة القادمة" />
          <StatCard kind="info" icon="school" value={students.filter(s => s.source === 'newcomers').length} label="منتقلون من الابتدائية" />
          <StatCard kind="gold" icon="refresh" value={students.filter(s => s.repeating).length} label="المعيدون" />
          <StatCard kind="accent" icon="arrowLeft" value={leaving} label="مغادرون / موجّهون" sub={`${grade4Secondary} من 4م نحو الثانوي`} />
        </div>

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
