// ════════════════════════════════════════════════════════════════════════════
// ListMaster AI — js/components.js (مكوّنات واجهة مشتركة → window.UI)
// Copyright © 2026 بوحادف (bouhadef) — All Rights Reserved
// ════════════════════════════════════════════════════════════════════════════

(function () {
  const Icons = window.Icons;

  const Btn = ({ kind = 'primary', size, icon, children, ...rest }) => {
    const I = icon ? Icons[icon] : null;
    const cls = ['btn', `btn-${kind}`, size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : ''].filter(Boolean).join(' ');
    return <button className={cls} {...rest}>{I && <I />}{children}</button>;
  };

  const MiniBtn = ({ icon, children, solid, danger, ...rest }) => {
    const I = icon ? Icons[icon] : null;
    return <button className={`mini-btn${solid ? ' solid' : ''}${danger ? ' danger' : ''}`} {...rest}>{I && <I />}{children}</button>;
  };

  const Badge = ({ tone = 'neutral', dot, children }) => (
    <span className={`badge ${tone}`}>{dot && <span className="dot" />}{children}</span>
  );

  const AvgPill = ({ value }) => {
    if (value == null) return <span className="avg-pill" style={{ opacity: .5 }}>—</span>;
    const cls = value < 10 ? 'low' : value < 12 ? 'mid' : 'high';
    return <span className={`avg-pill ${cls}`}>{window.U.fmtAvg(value)}</span>;
  };

  const Card = ({ num, title, sub, icon, meta, children, bodyFlush }) => {
    const I = icon ? Icons[icon] : null;
    return (
      <div className="card">
        {(title || num) && (
          <div className="card-head">
            <div className="card-title">
              {num != null ? <span className="num-badge">{num}</span> : I ? <I /> : null}
              <span>{title}{sub && <small>{sub}</small>}</span>
            </div>
            {meta && <div className="card-meta">{meta}</div>}
          </div>
        )}
        <div className={`card-body${bodyFlush ? ' flush' : ''}`}>{children}</div>
      </div>
    );
  };

  const StatCard = ({ kind = '', icon, value, label, sub }) => {
    const I = icon ? Icons[icon] : null;
    return (
      <div className={`stat-card ${kind}`}>
        {I && <div className="sc-ico"><I /></div>}
        <div className="sc-val">{value}</div>
        <div className="sc-label">{label}</div>
        {sub && <div className="sc-sub">{sub}</div>}
      </div>
    );
  };

  const InfoBanner = ({ kind = '', icon = 'info', title, children, className = '' }) => {
    const I = Icons[icon] || Icons.info;
    return (
      <div className={`info-banner ${kind} ${className}`}>
        <div className="ib-ico"><I /></div>
        <div>{title && <h4>{title}</h4>}<p>{children}</p></div>
      </div>
    );
  };

  const Toggle = ({ on, onChange }) => (
    <span className={`toggle${on ? ' on' : ''}`} onClick={() => onChange && onChange(!on)} role="switch" aria-checked={on} />
  );

  const Checkbox = ({ on, onChange, children }) => (
    <label className={`ck${on ? ' on' : ''}`} onClick={(e) => { e.preventDefault(); onChange && onChange(!on); }}>
      <span className="ck-box" />{children}
    </label>
  );

  const Segmented = ({ value, options, onChange }) => (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );

  const Field = ({ label, req, hint, children }) => (
    <div className="field">
      {label && <label>{label}{req && <span className="req">*</span>}</label>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );

  const Modal = ({ title, icon, children, footer, onClose, wide }) => {
    const I = icon ? Icons[icon] : null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={wide ? { maxWidth: 760 } : null} onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            {I && <div className="h-ico"><I /></div>}
            <h3 style={{ flex: 1 }}>{title}</h3>
            <button className="icon-btn" onClick={onClose}><Icons.x /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-foot">{footer}</div>}
        </div>
      </div>
    );
  };

  const EmptyState = ({ icon = 'list', title, children, action }) => {
    const I = Icons[icon] || Icons.list;
    return (
      <div className="empty-state">
        <div className="empty-ico"><I /></div>
        <h3>{title}</h3>
        <p>{children}</p>
        {action && <div style={{ marginTop: 18 }}>{action}</div>}
      </div>
    );
  };

  // شريط توزيع جنس (ذكور/إناث)
  const GenderBar = ({ males, females }) => {
    const total = males + females || 1;
    return (
      <div className="dist-bar" title={`ذكور ${males} · إناث ${females}`}>
        <div className="seg-m" style={{ width: `${(males / total) * 100}%` }} />
        <div className="seg-f" style={{ width: `${(females / total) * 100}%` }} />
      </div>
    );
  };

  window.UI = { Btn, MiniBtn, Badge, AvgPill, Card, StatCard, InfoBanner, Toggle, Checkbox, Segmented, Field, Modal, EmptyState, GenderBar };
})();
