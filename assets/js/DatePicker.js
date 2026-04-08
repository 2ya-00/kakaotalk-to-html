/**
 * DatePicker  —  자기완결형(Self-contained) 날짜 선택기
 *
 * 사용법:
 *   new DatePicker('containerId')
 *   new DatePicker('containerId', 'today')
 *   new DatePicker('containerId', '2026-04-02')
 *
 * @param {string} containerId    - 피커를 주입할 div 의 id
 * @param {string} [defaultValue] - '' | 'today' | 'YYYY-MM-DD'
 *
 * 공개 메서드:
 *   getValue()   → 현재 값 (YYYY-MM-DD 또는 '')
 *   setValue(v)  → 값 지정 ('' | 'today' | 'YYYY-MM-DD')
 *   openPanel()
 *   closePanel()
 *
 * CSS 커스터마이즈 (컨테이너 또는 상위 요소에 지정):
 *   --dp-primary      기본 #1a56c4
 *   --dp-primary-bg   기본 #e8f0fe  (오늘/선택 배경)
 *   --dp-text         기본 #1a1a1a
 *   --dp-bg           기본 #ffffff
 *   --dp-radius       기본 8px      (패널 border-radius)
 */
class DatePicker {
  // ── CSS 자동 주입 (페이지당 1회) ──────────────────────
  static _cssInjected = false;

  static _injectCSS() {
    if (DatePicker._cssInjected) return;
    DatePicker._cssInjected = true;
    const style = document.createElement('style');
    style.dataset.for = 'DatePicker';
    style.textContent = `
.dp {
  position: relative;
  --dp-primary:    #1a56c4;
  --dp-primary-bg: #e8f0fe;
  --dp-text:       #1a1a1a;
  --dp-bg:         #ffffff;
  --dp-radius:     8px;
}
.dp__field {
  display: flex;
  align-items: center;
  position: relative;
}
.dp__field input::placeholder {
  font-size:12px;
}
.dp__input {
  padding-right: 34px !important;
  box-sizing: border-box;
}
.dp__toggle {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #aaa;
  display: flex;
  align-items: center;
  line-height: 1;
  transition: color .15s;
}
.dp__toggle:hover { color: var(--dp-primary); }
.dp__panel {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 9999;
  min-width: 220px;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: var(--dp-radius);
  padding: 10px 8px 6px;
  background: var(--dp-bg);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  font-family: inherit;
  color: var(--dp-text);
}
.dp__panel.dp__panel--open { display: block; }
.dp__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.dp__nav-btn {
  width: 24px; height: 24px;
  background: none;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  color: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
}
.dp__nav-btn:hover {
  background: rgba(26,86,196,.12);
  border-color: var(--dp-primary);
  color: var(--dp-primary);
}
.dp__nav-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--dp-text);
}
.dp__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 1px;
}
.dp__wk {
  font-size: 11px;
  font-weight: 500;
  color: rgba(0,0,0,.4);
  padding: 1px 0;
}
.dp__wk--sun { color: #d93025; }
.dp__wk--sat { color: var(--dp-primary); }
.dp__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}
.dp__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  background: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  color: var(--dp-text);
  transition: all .15s;
  padding: 0;
  font-family: inherit;
}
.dp__cell:hover              { background: rgba(26,86,196,.18); }
.dp__cell--other             { color: rgba(0,0,0,.25); }
.dp__cell--sun               { color: #d93025; }
.dp__cell--sat               { color: var(--dp-primary); }
.dp__cell--other.dp__cell--sun,
.dp__cell--other.dp__cell--sat { color: rgba(0,0,0,.25); }
.dp__cell--today             { background: var(--dp-primary-bg); color: var(--dp-primary) !important; font-weight: 700; }
.dp__cell--selected          { background: var(--dp-primary) !important; color: #fff !important; font-weight: 600; }
.dp__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px solid rgba(0,0,0,.08);
}
.dp__foot-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all .15s;
  font-family: inherit;
}
.dp__foot-btn--today         { color: var(--dp-primary); }
.dp__foot-btn--today:hover   { background: rgba(26,86,196,.1); }
.dp__foot-btn--clr           { color: rgba(0,0,0,.45); }
.dp__foot-btn--clr:hover     { background: rgba(0,0,0,.07); }
    `.trim();
    document.head.appendChild(style);
  }

  // ── 생성자 ────────────────────────────────────────────
  constructor(containerId, defaultValue = '') {
    DatePicker._injectCSS();

    this._wrap = document.getElementById(containerId);
    if (!this._wrap) throw new Error(`DatePicker: #${containerId} not found`);

    this._wrap.classList.add('dp');
    this._wrap.innerHTML = this._buildHTML();

    // DOM 참조 — 모두 this._wrap 스코프 (전역 ID 없음)
    this._input = this._wrap.querySelector('.dp__input');
    this._toggle = this._wrap.querySelector('.dp__toggle');
    this._panel = this._wrap.querySelector('.dp__panel');
    this._navTitle = this._wrap.querySelector('.dp__nav-title');
    this._grid = this._wrap.querySelector('.dp__grid');
    this._prevBtn = this._wrap.querySelector('.dp__nav-btn--prev');
    this._nextBtn = this._wrap.querySelector('.dp__nav-btn--next');
    this._todayBtn = this._wrap.querySelector('.dp__foot-btn--today');
    this._clrBtn = this._wrap.querySelector('.dp__foot-btn--clr');

    this._viewYear = null;
    this._viewMonth = null;

    this._bindEvents();
    this.setValue(defaultValue);
  }

  // ── 공개 API ──────────────────────────────────────────

  getValue() { return this._input.value; }

  setValue(v) {
    if (v === 'today') {
      const n = new Date();
      this._input.value = this._fmtDate(n.getFullYear(), n.getMonth(), n.getDate());
    } else if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      this._input.value = v;
    } else {
      this._input.value = '';
    }
  }

  openPanel() {
    if (this._panel.classList.contains('dp__panel--open')) return;
    this._initView();
    this._renderGrid();
    this._panel.classList.add('dp__panel--open');
  }

  closePanel() {
    this._panel.classList.remove('dp__panel--open');
  }

  // ── 내부 ──────────────────────────────────────────────

  _buildHTML() {
    return `
<div class="dp__field">
  <input type="text" class="dp__input" placeholder="YYYY-MM-DD" autocomplete="off" maxlength="10">
  <button class="dp__toggle" type="button" tabindex="-1">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
    </svg>
  </button>
</div>
<div class="dp__panel">
  <div class="dp__nav">
    <button class="dp__nav-btn dp__nav-btn--prev" type="button">&#8249;</button>
    <span class="dp__nav-title"></span>
    <button class="dp__nav-btn dp__nav-btn--next" type="button">&#8250;</button>
  </div>
  <div class="dp__weekdays">
    <span class="dp__wk dp__wk--sun">일</span>
    <span class="dp__wk">월</span><span class="dp__wk">화</span>
    <span class="dp__wk">수</span><span class="dp__wk">목</span>
    <span class="dp__wk">금</span>
    <span class="dp__wk dp__wk--sat">토</span>
  </div>
  <div class="dp__grid"></div>
  <div class="dp__foot">
    <button class="dp__foot-btn dp__foot-btn--today" type="button">오늘</button>
    <button class="dp__foot-btn dp__foot-btn--clr"   type="button">초기화</button>
  </div>
</div>`.trim();
  }

  _initView() {
    const v = this._input.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m] = v.split('-').map(Number);
      this._viewYear = y; this._viewMonth = m - 1;
    } else {
      const n = new Date();
      this._viewYear = n.getFullYear(); this._viewMonth = n.getMonth();
    }
  }

  _fmtDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  _fmtTitle(y, m) {
    return `${y}년 ${['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][m]}`;
  }

  _renderGrid() {
    this._navTitle.textContent = this._fmtTitle(this._viewYear, this._viewMonth);
    this._grid.innerHTML = '';

    const firstDay = new Date(this._viewYear, this._viewMonth, 1).getDay();
    const lastDate = new Date(this._viewYear, this._viewMonth + 1, 0).getDate();
    const prevLast = new Date(this._viewYear, this._viewMonth, 0).getDate();
    const n = new Date();
    const todayStr = this._fmtDate(n.getFullYear(), n.getMonth(), n.getDate());
    const selStr = this._input.value;
    const cells = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevLast - i, pm = this._viewMonth - 1;
      const py = pm < 0 ? this._viewYear - 1 : this._viewYear;
      cells.push({ day: d, dateStr: this._fmtDate(py, pm < 0 ? 11 : pm, d), other: true });
    }
    for (let d = 1; d <= lastDate; d++) {
      cells.push({ day: d, dateStr: this._fmtDate(this._viewYear, this._viewMonth, d), other: false });
    }
    const remain = 7 - (cells.length % 7);
    if (remain < 7) {
      for (let d = 1; d <= remain; d++) {
        const nm = this._viewMonth + 1;
        const ny = nm > 11 ? this._viewYear + 1 : this._viewYear;
        cells.push({ day: d, dateStr: this._fmtDate(ny, nm > 11 ? 0 : nm, d), other: true });
      }
    }

    cells.forEach((cell, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dp__cell'; btn.textContent = cell.day;
      const col = idx % 7;
      if (cell.other) btn.classList.add('dp__cell--other');
      if (col === 0) btn.classList.add('dp__cell--sun');
      if (col === 6) btn.classList.add('dp__cell--sat');
      if (cell.dateStr === todayStr) btn.classList.add('dp__cell--today');
      if (cell.dateStr === selStr) btn.classList.add('dp__cell--selected');
      btn.addEventListener('click', () => { this._input.value = cell.dateStr; this.closePanel(); });
      this._grid.appendChild(btn);
    });
  }

  _handleInput() {
    let v = this._input.value.replace(/[^\d-]/g, '');
    const digits = v.replace(/-/g, '');
    if (digits.length >= 4 && !v.includes('-'))
      v = digits.slice(0, 4) + '-' + digits.slice(4);
    if (digits.length >= 6 && v.lastIndexOf('-') <= 4)
      v = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
    this._input.value = v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        this._viewYear = y; this._viewMonth = m - 1;
        if (this._panel.classList.contains('dp__panel--open')) this._renderGrid();
      }
    }
  }

  _bindEvents() {
    this._input.addEventListener('click', () => this.openPanel());
    this._input.addEventListener('focus', () => this.openPanel());
    this._input.addEventListener('input', () => this._handleInput());
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._panel.classList.contains('dp__panel--open')) {
        e.preventDefault(); e.stopImmediatePropagation(); this.closePanel();
      }
    });

    this._toggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this._panel.classList.contains('dp__panel--open')) this.closePanel();
      else this.openPanel();
    });

    document.addEventListener('mousedown', (e) => {
      if (!this._panel.classList.contains('dp__panel--open')) return;
      if (this._wrap.contains(e.target)) return;
      this.closePanel();
    });

    this._prevBtn.addEventListener('click', () => {
      if (--this._viewMonth < 0) { this._viewMonth = 11; this._viewYear--; }
      this._renderGrid();
    });
    this._nextBtn.addEventListener('click', () => {
      if (++this._viewMonth > 11) { this._viewMonth = 0; this._viewYear++; }
      this._renderGrid();
    });

    this._todayBtn.addEventListener('click', () => {
      const n = new Date();
      this._input.value = this._fmtDate(n.getFullYear(), n.getMonth(), n.getDate());
      this._viewYear = n.getFullYear(); this._viewMonth = n.getMonth();
      this._renderGrid(); this.closePanel();
    });
    this._clrBtn.addEventListener('click', () => {
      this._input.value = ''; this.closePanel();
    });
  }
}
