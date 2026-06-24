// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/App.js (المكوّن الجذر + محرّك التفاعل)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
//
// PROPRIETARY SOFTWARE. ممنوع النسخ أو التعديل أو التوزيع.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const { useReducer, useEffect, useState, useRef } = React;
  const { Btn } = window.UI;
  const Icons = window.Icons, U = window.U, Store = window.Store, Excel = window.Excel;

  const THEMES = [
    { id: 'national', name: 'وطني', desc: 'الوضع الافتراضي الرسمي' },
    { id: 'night', name: 'ليلي', desc: 'مريح للعين في الظلام' },
    { id: 'light', name: 'فاتح', desc: 'تباين عالي الوضوح' },
    { id: 'calm', name: 'هادئ', desc: 'ألوان ناعمة ومريحة' },
  ];

  const STEPS = [
    { id: 1, name: 'الاستيراد', icon: 'upload' },
    { id: 2, name: 'الإعداد', icon: 'settings' },
    { id: 3, name: 'التوزيع', icon: 'shuffle' },
    { id: 4, name: 'المراجعة', icon: 'eye' },
    { id: 5, name: 'المخرجات', icon: 'printer' },
  ];

  function reqMet(state, step) {
    const groupsOk = state.imports.groups && Excel.validateMap('groups', state.columnMap.groups).ok;
    const decisionsOk = state.imports.decisions && Excel.validateMap('decisions', state.columnMap.decisions).ok;
    switch (step) {
      case 1: return !!(groupsOk && decisionsOk && state.institution.name && state.institution.nextYear);
      case 2: return state.students.length > 0 && [1, 2, 3, 4].some(L => (state.config.levels[L] || {}).nextClasses > 0);
      case 3: return !!state.distribution;
      case 4: return !!state.distribution;
      default: return true;
    }
  }

  function ThemeSwitcher({ theme, setTheme }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);
    const cur = THEMES.find(t => t.id === theme) || THEMES[0];
    return (
      <div className="theme-wrap" ref={ref}>
        <button className="theme-btn" onClick={() => setOpen(o => !o)}>
          <span className="theme-swatch" /> {cur.name} <Icons.chevDown size={13} />
        </button>
        {open && <div className="theme-dropdown">
          {THEMES.map(t => (
            <button key={t.id} className={`theme-option${theme === t.id ? ' active' : ''}`} onClick={() => { setTheme(t.id); setOpen(false); }}>
              <span className="theme-option-label">{t.name}</span>
              <span className="theme-option-desc">{t.desc}</span>
            </button>
          ))}
        </div>}
      </div>
    );
  }

  function App() {
    const [state, dispatch] = useReducer(Store.rootReducer, Store.initialState, Store.loadState);
    const [theme, setTheme] = useState(() => localStorage.getItem('lm_theme') || 'national');
    const [saved, setSaved] = useState(false);

    // الثيم
    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('lm_theme', theme); }, [theme]);

    // بناء قائمة التلاميذ تفاعليًا عند تغيّر المستوردات/المطابقة/تاريخ السن
    useEffect(() => {
      const anyValid = Store.SOURCES.some(src => state.imports[src] && Excel.validateMap(src, state.columnMap[src]).ok);
      if (anyValid) dispatch({ type: 'BUILD_STUDENTS' });
    }, [state.imports, state.columnMap, state.config.refDate, state.config.newcomerOutOf10]);

    // الحفظ المحلي (مؤجَّل)
    useEffect(() => {
      const t = setTimeout(() => { Store.saveState(state); setSaved(true); const x = setTimeout(() => setSaved(false), 1400); }, 500);
      return () => clearTimeout(t);
    }, [state]);

    const step = state.step;
    const goStep = (s) => dispatch({ type: 'SET_STEP', step: s });
    const StepComp = window['Step' + step];
    const curStep = STEPS.find(s => s.id === step);
    const HeadIco = Icons[curStep.icon];

    const reset = () => { if (confirm('سيُمسح كل شيء (الملفات، الإعداد، التوزيع). متابعة؟')) dispatch({ type: 'RESET_ALL' }); };

    const progress = (Math.max(...[1, 2, 3, 4, 5].filter(s => s <= state.maxStepReached)) / 5) * 100;

    return (
      <window.AppContext.Provider value={{ state, dispatch }}>
        {/* ── NAVBAR ── */}
        <div className="navbar no-print">
          <div className="brand">
            <div className="brand-mark"><Icons.list /></div>
            <div>
              <div className="brand-title">قوائم التسجيل<span> · List</span>Master</div>
              <div className="brand-sub">مساعد تحضير قوائم التسجيل</div>
            </div>
          </div>
          <div className="nav-divider" />
          <div className="nav-breadcrumb">
            <span>المرحلة</span><span className="crumb-sep">‹</span>
            <span className="crumb-current">{STEPS.find(s => s.id === step).name}</span>
          </div>
          <div className="nav-spacer" />
          <div className="nav-actions">
            <button className="icon-btn" title="إعادة تعيين" onClick={reset}><Icons.trash /></button>
            <ThemeSwitcher theme={theme} setTheme={setTheme} />
            <div className="user-chip" title={`المستخدم: ${'bouhadef'}`}>
              <div className="user-info"><span className="user-name">المؤسسة</span><span className="user-role">{state.institution.name || 'غير محدّدة'}</span></div>
              <div className="user-avatar"><Icons.school size={16} /></div>
            </div>
          </div>
        </div>

        {/* ── STEPBAR ── */}
        <div className="stepbar-wrap no-print">
          <div className="stepbar">
            {STEPS.map(s => {
              const IcoC = Icons[s.icon];
              const reachable = s.id <= state.maxStepReached || reqMet(state, s.id - 1);
              const done = s.id < step && reqMet(state, s.id);
              return (
                <button key={s.id} className={`step-btn${step === s.id ? ' active' : ''}${done ? ' done' : ''}`}
                  disabled={!reachable && s.id > state.maxStepReached} onClick={() => reachable && goStep(s.id)}>
                  <span className="step-num">{done ? <Icons.check /> : s.id}</span>
                  <IcoC size={15} /> {s.name}
                </button>
              );
            })}
          </div>
          <div className="step-progress"><div className="step-progress-bar" style={{ width: `${progress}%` }} /></div>
        </div>

        {/* ── CONTENT ── */}
        <div className="page-wrap">
          <div className="page-head no-print">
            <div>
              <h1><span className="h-ico"><HeadIco /></span>{curStep.name}</h1>
              <div className="page-sub">الخطوة {step} من 5 — {state.institution.nextYear ? `السنة الدراسية ${state.institution.nextYear}` : 'حدّد السنة القادمة في الاستيراد'}</div>
            </div>
          </div>

          {StepComp ? <StepComp /> : <div>تعذّر تحميل الخطوة.</div>}

          {/* ── NAV FOOTER ── */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            <Btn kind="ghost" icon="arrowRight" disabled={step <= 1} onClick={() => goStep(step - 1)}>السابق</Btn>
            {step < 5
              ? <Btn kind="primary" disabled={!reqMet(state, step)} onClick={() => goStep(step + 1)}>
                  التالي: {STEPS.find(s => s.id === step + 1).name} <Icons.arrowLeft size={16} />
                </Btn>
              : <Btn kind="primary" icon="printer" onClick={() => window.print()}>طباعة القوائم</Btn>}
          </div>
        </div>

        {/* ── SAVE PILL ── */}
        <div className="save-pill no-print">
          <span className="save-pulse" />{saved ? 'تمّ الحفظ تلقائيًا' : 'حفظ محلي تلقائي'}
        </div>
      </window.AppContext.Provider>
    );
  }

  window.App = App;
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
