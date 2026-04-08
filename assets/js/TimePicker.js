/**
 * TimePicker  —  자기완결형(Self-contained) 12h AM/PM 시간 선택기
 *
 * 사용법:
 *   new TimePicker('containerId')
 *   new TimePicker('containerId', 'now')
 *   new TimePicker('containerId', '14:30')
 *
 * @param {string} containerId    - 피커를 주입할 div 의 id
 * @param {string} [defaultValue] - '' | 'now' | 'HH:MM'
 *
 * 공개 메서드:
 *   getValue()   → 현재 값 (HH:MM 24h 또는 '')
 *   setValue(v)  → 값 지정 ('' | 'now' | 'HH:MM')
 *   openPanel()
 *   closePanel()
 *
 * CSS 커스터마이즈 (컨테이너 또는 상위 요소에 지정):
 *   --tp-primary    기본 #1a56c4
 *   --tp-text       기본 #1a1a1a
 *   --tp-bg         기본 #ffffff
 *   --tp-radius     기본 10px    (패널 border-radius)
 */
class TimePicker {
  // ── CSS 자동 주입 (페이지당 1회) ──────────────────────
  static _cssInjected = false;

  static _injectCSS() {
    if (TimePicker._cssInjected) return;
    TimePicker._cssInjected = true;
    const style = document.createElement('style');
    style.dataset.for = 'TimePicker';
    style.textContent = `
.tp {
  position: relative;
  --tp-primary: #1a56c4;
  --tp-text:    #1a1a1a;
  --tp-bg:      #ffffff;
  --tp-radius:  10px;
}
.tp__field {
  display: flex;
  align-items: center;
  position: relative;
}
.tp__input {
  padding-right: 34px !important;
  box-sizing: border-box;
}
.tp__toggle {
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
.tp__toggle:hover { color: var(--tp-primary); }
.tp__panel {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 9999;
  border: 1px solid rgba(0,0,0,.12);
  border-radius: var(--tp-radius);
  padding: 14px 12px 10px;
  background: var(--tp-bg);
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  font-family: inherit;
  color: var(--tp-text);
}
.tp__panel.tp__panel--open { display: block; }
.tp__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tp__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.tp__arr {
  width: 64px; height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(0,0,0,.4);
  font-size: 10px;
  line-height: 1;
  border-radius: 4px;
  opacity: 0;
  pointer-events: none;
  transition: all .15s;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tp__arr:hover {
  background: rgba(26,86,196,.15);
  color: var(--tp-primary);
}
.tp__col--focus .tp__arr {
  opacity: 1;
  pointer-events: auto;
}
.tp__num {
  width: 64px; height: 68px;
  background: rgba(0,0,0,.05);
  border: 2px solid transparent;
  border-radius: 8px;
  font-size: 40px;
  font-weight: 400;
  text-align: center;
  color: var(--tp-text);
  cursor: text;
  transition: all .15s;
  outline: none;
  padding: 0;
  caret-color: transparent;
  font-family: inherit;
}
.tp__num:focus,
.tp__col--focus .tp__num {
  border-color: var(--tp-primary);
  color: var(--tp-primary);
  background: rgba(26,86,196,.05);
}
.tp__colon {
  font-size: 32px;
  font-weight: 500;
  color: var(--tp-text);
  line-height: 1;
  padding-bottom: 4px;
}
.tp__ampm {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 4px;
}
.tp__ap {
  width: 44px; height: 32px;
  border: 1px solid rgba(0,0,0,.16);
  background: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: rgba(0,0,0,.45);
  transition: all .15s;
  font-family: inherit;
}
.tp__ap:hover {
  background: rgba(26,86,196,.08);
  border-color: var(--tp-primary);
}
.tp__ap.tp__ap--on {
  background: rgba(26,86,196,.12);
  border-color: var(--tp-primary);
  color: var(--tp-primary);
  font-weight: 700;
}
.tp__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,.08);
}
.tp__foot-btn {
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all .15s;
  font-family: inherit;
}
.tp__foot-btn--now         { color: var(--tp-primary); }
.tp__foot-btn--now:hover   { background: rgba(26,86,196,.1); }
.tp__foot-btn--clr         { color: rgba(0,0,0,.45); }
.tp__foot-btn--clr:hover   { background: rgba(0,0,0,.07); }
    `.trim();
    document.head.appendChild(style);
  }

  // ── 생성자 ────────────────────────────────────────────
  constructor(containerId, defaultValue = '') {
    TimePicker._injectCSS();

    this._wrap = document.getElementById(containerId);
    if (!this._wrap) throw new Error(`TimePicker: #${containerId} not found`);

    this._wrap.classList.add('tp');
    this._wrap.innerHTML = this._buildHTML();

    // DOM 참조 — 모두 this._wrap 스코프 (전역 ID 없음)
    this._input  = this._wrap.querySelector('.tp__input');
    this._toggle = this._wrap.querySelector('.tp__toggle');
    this._panel  = this._wrap.querySelector('.tp__panel');
    this._hrEl   = this._wrap.querySelector('.tp__hr');
    this._miEl   = this._wrap.querySelector('.tp__mi');
    this._hrCol  = this._wrap.querySelector('.tp__col--hr');
    this._miCol  = this._wrap.querySelector('.tp__col--mi');
    this._amBtn  = this._wrap.querySelector('.tp__ap--am');
    this._pmBtn  = this._wrap.querySelector('.tp__ap--pm');
    this._hrUp   = this._wrap.querySelector('.tp__arr--hr-up');
    this._hrDn   = this._wrap.querySelector('.tp__arr--hr-dn');
    this._miUp   = this._wrap.querySelector('.tp__arr--mi-up');
    this._miDn   = this._wrap.querySelector('.tp__arr--mi-dn');
    this._nowBtn = this._wrap.querySelector('.tp__foot-btn--now');
    this._clrBtn = this._wrap.querySelector('.tp__foot-btn--clr');

    this._h12 = 12; this._min = 0; this._ap = 'AM';

    this._bindEvents();
    this._render();
    this.setValue(defaultValue);
  }

  // ── 공개 API ──────────────────────────────────────────

  getValue() { return this._input.value; }

  setValue(v) {
    if (v === 'now') {
      const n = new Date();
      this._from24(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`);
      this._commit(); this._render();
    } else if (v && /^\d{1,2}:\d{2}$/.test(v)) {
      this._from24(v); this._commit(); this._render();
    } else {
      this._input.value = '';
      this._h12 = 12; this._min = 0; this._ap = 'AM';
      this._render();
    }
  }

  openPanel() {
    if (this._panel.classList.contains('tp__panel--open')) return;
    if (!this._input.value) {
      const n = new Date();
      this._h12 = n.getHours() % 12 || 12;
      this._min = n.getMinutes();
      this._ap  = n.getHours() >= 12 ? 'PM' : 'AM';
    } else {
      this._from24(this._input.value);
    }
    this._render();
    this._panel.classList.add('tp__panel--open');
  }

  closePanel() {
    this._panel.classList.remove('tp__panel--open');
    this._hrCol.classList.remove('tp__col--focus');
    this._miCol.classList.remove('tp__col--focus');
  }

  // ── 내부 ──────────────────────────────────────────────

  _buildHTML() {
    return `
<div class="tp__field">
  <input type="text" class="tp__input" placeholder="HH:MM"
         autocomplete="off" inputmode="numeric" maxlength="5">
  <button class="tp__toggle" type="button" tabindex="-1">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  </button>
</div>
<div class="tp__panel">
  <div class="tp__row">
    <div class="tp__col tp__col--hr">
      <button class="tp__arr tp__arr--hr-up" type="button">&#9650;</button>
      <input class="tp__num tp__hr" type="text" maxlength="2" inputmode="numeric">
      <button class="tp__arr tp__arr--hr-dn" type="button">&#9660;</button>
    </div>
    <div class="tp__colon">:</div>
    <div class="tp__col tp__col--mi">
      <button class="tp__arr tp__arr--mi-up" type="button">&#9650;</button>
      <input class="tp__num tp__mi" type="text" maxlength="2" inputmode="numeric">
      <button class="tp__arr tp__arr--mi-dn" type="button">&#9660;</button>
    </div>
    <div class="tp__ampm">
      <button class="tp__ap tp__ap--am" type="button">AM</button>
      <button class="tp__ap tp__ap--pm" type="button">PM</button>
    </div>
  </div>
  <div class="tp__foot">
    <button class="tp__foot-btn tp__foot-btn--now" type="button">현재시각</button>
    <button class="tp__foot-btn tp__foot-btn--clr" type="button">초기화</button>
  </div>
</div>`.trim();
  }

  _to24() {
    let h = this._h12;
    if (this._ap === 'AM') { if (h === 12) h = 0; }
    else                   { if (h !== 12) h += 12; }
    return `${String(h).padStart(2,'0')}:${String(this._min).padStart(2,'0')}`;
  }

  _from24(val) {
    if (!val) { this._h12 = 12; this._min = 0; this._ap = 'AM'; return; }
    const m = val.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return;
    const h = parseInt(m[1]), mi = parseInt(m[2]);
    if (isNaN(h) || isNaN(mi)) return;
    this._ap = h >= 12 ? 'PM' : 'AM';
    this._h12 = h % 12 || 12;
    this._min = mi;
  }

  _render() {
    this._hrEl.value = String(this._h12);
    this._miEl.value = String(this._min).padStart(2,'0');
    this._amBtn.classList.toggle('tp__ap--on', this._ap === 'AM');
    this._pmBtn.classList.toggle('tp__ap--on', this._ap === 'PM');
  }

  _commit() { this._input.value = this._to24(); }

  _adjHour(d) {
    this._h12 = (this._h12 - 1 + d + 12) % 12 + 1;
    this._render(); this._commit();
  }

  _adjMin(d) {
    this._min = (this._min + d + 60) % 60;
    this._render(); this._commit();
  }

  _handleInput() {
    const val = this._input.value;
    if (/^\d{1,2}:\d{2}$/.test(val)) {
      const [hStr, mStr] = val.split(':');
      let hh = parseInt(hStr), mm = parseInt(mStr);
      if (mm > 59) return;
      if (hh >= 13 && hh <= 23)      { this._ap = 'PM'; this._h12 = hh - 12; this._min = mm; }
      else if (hh === 0 || hh === 24) {
        this._ap = 'AM'; this._h12 = 12; this._min = mm;
        this._input.value = '00:' + String(mm).padStart(2,'0');
      } else {
        this._from24(String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0'));
      }
      this._render();
    }
    if (!val) { this._h12 = 12; this._min = 0; this._ap = 'AM'; this._render(); }
  }

  _bindEvents() {
    this._input.addEventListener('click',  () => this.openPanel());
    this._input.addEventListener('focus',  () => this.openPanel());
    this._input.addEventListener('input',  () => this._handleInput());

    this._toggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this._panel.classList.contains('tp__panel--open')) this.closePanel();
      else this.openPanel();
    });

    document.addEventListener('mousedown', (e) => {
      if (!this._panel.classList.contains('tp__panel--open')) return;
      if (this._wrap.contains(e.target)) return;
      this.closePanel();
    });

    // 시
    this._hrEl.addEventListener('focus', () => {
      this._hrCol.classList.add('tp__col--focus');
      this._miCol.classList.remove('tp__col--focus');
      setTimeout(() => this._hrEl.select(), 0);
    });
    this._hrEl.addEventListener('input', () => {
      const v = this._hrEl.value.replace(/\D/g, '');
      this._hrEl.value = v;
      const n = parseInt(v);
      if (n >= 1 && n <= 12)   { this._h12 = n; this._commit(); }
      if (n >= 13 && n <= 23)  { this._ap = 'PM'; this._h12 = n - 12; this._commit(); this._render(); this._miEl.focus(); return; }
      if (n === 0 || n === 24) { this._ap = 'AM'; this._h12 = 12;     this._commit(); this._render(); this._miEl.focus(); return; }
      if (v.length >= 2) this._miEl.focus();
    });
    this._hrEl.addEventListener('blur', () => {
      let v = parseInt(this._hrEl.value) || 12;
      if (v < 1 || v > 12) v = 12;
      this._h12 = v; this._hrEl.value = String(v); this._commit();
    });
    this._hrEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp')            { e.preventDefault(); this._adjHour(1); }
      if (e.key === 'ArrowDown')          { e.preventDefault(); this._adjHour(-1); }
      if (e.key === 'Enter')              { e.preventDefault(); this.closePanel(); this._input.focus(); }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); this._miEl.focus(); }
    });
    this._hrEl.addEventListener('wheel', (e) => { e.preventDefault(); this._adjHour(e.deltaY < 0 ? 1 : -1); }, { passive: false });

    // 분
    this._miEl.addEventListener('focus', () => {
      this._miCol.classList.add('tp__col--focus');
      this._hrCol.classList.remove('tp__col--focus');
      setTimeout(() => this._miEl.select(), 0);
    });
    this._miEl.addEventListener('input', () => {
      const v = this._miEl.value.replace(/\D/g, '');
      this._miEl.value = v;
      const n = parseInt(v);
      if (!isNaN(n) && n >= 0 && n <= 59) { this._min = n; this._commit(); }
    });
    this._miEl.addEventListener('blur', () => {
      let v = parseInt(this._miEl.value);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 59) v = 59;
      this._min = v; this._miEl.value = String(v).padStart(2,'0'); this._commit();
    });
    this._miEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp')           { e.preventDefault(); this._adjMin(1); }
      if (e.key === 'ArrowDown')         { e.preventDefault(); this._adjMin(-1); }
      if (e.key === 'Enter')             { e.preventDefault(); this.closePanel(); this._input.focus(); }
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); this._hrEl.focus(); }
    });
    this._miEl.addEventListener('wheel', (e) => { e.preventDefault(); this._adjMin(e.deltaY < 0 ? 1 : -1); }, { passive: false });

    // 화살표 버튼
    this._hrUp.addEventListener('click', () => { this._adjHour(1);  this._hrEl.focus(); });
    this._hrDn.addEventListener('click', () => { this._adjHour(-1); this._hrEl.focus(); });
    this._miUp.addEventListener('click', () => { this._adjMin(1);   this._miEl.focus(); });
    this._miDn.addEventListener('click', () => { this._adjMin(-1);  this._miEl.focus(); });

    // AM/PM
    this._amBtn.addEventListener('click', () => { this._ap = 'AM'; this._render(); this._commit(); });
    this._pmBtn.addEventListener('click', () => { this._ap = 'PM'; this._render(); this._commit(); });

    // 현재시각
    this._nowBtn.addEventListener('click', () => {
      const n = new Date();
      this._h12 = n.getHours() % 12 || 12;
      this._min = n.getMinutes();
      this._ap  = n.getHours() >= 12 ? 'PM' : 'AM';
      this._render(); this._commit();
    });

    // 초기화
    this._clrBtn.addEventListener('click', () => {
      this._h12 = 12; this._min = 0; this._ap = 'AM';
      this._input.value = '';
      this._render(); this.closePanel();
    });
  }
}
