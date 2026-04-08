/* ============================
   카카오톡 대화 백업 - 로직
   ============================ */

let allGroups = [];
let participants = {};
let dragSrc = null;

function getCutoff() {
  const v = parseInt(document.getElementById('cutoffHour').value);
  return isNaN(v) ? 6 : v;
}

/* ============================
   파일 읽기
   ============================ */
document.getElementById('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = (ev) => { window._rawText = ev.target.result; };
  r.readAsText(f, 'utf-8');
});

/* ============================
   파싱 - 안드로이드
   형식: [이름] [오전/오후 H:MM] 메시지
         [이름] [AM/PM H:MM] 메시지  (영문 로케일)
   ============================ */
function parseAndroid(text) {
  const lines = text.split(/\r?\n/);
  const reDate = /^-+\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일/;
  // 한글(오전/오후) 또는 영문(AM/PM) 모두 매칭
  const reMsg = /^\[(.+?)\] \[(?:(오전|오후)|([AP]M)) (\d{1,2}):(\d{2})\] (.+)$/;
  const groups = [];
  let curDate = null, groupDate = null, curSender = null, curTime = '', curH = 0, curMin = 0, msgs = [];

  function flush() {
    if (msgs.length && curSender) {
      groups.push({ sender: curSender, date: groupDate, time: curTime, messages: [...msgs], excluded: false });
    }
    msgs = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dm = reDate.exec(line);
    if (dm) {
      curDate = `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`;
      continue;
    }
    const mm = reMsg.exec(line);
    if (mm) {
      const sender = mm[1];
      const ampm_kr = mm[2];          // '오전' | '오후' | undefined
      const ampm_en = mm[3];          // 'AM' | 'PM' | undefined
      const ampmDisp = ampm_kr || ampm_en;
      const isAM = ampm_kr ? ampm_kr === '오전' : ampm_en === 'AM';
      let h = parseInt(mm[4]), min = parseInt(mm[5]);
      if (!isAM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      const msg = mm[6];
      const time = `${ampmDisp} ${mm[4]}:${mm[5]}`;
      // 같은 화자 + 시간 차이 1분 이내 → 같은 묶음
      if (sender !== curSender || Math.abs(h * 60 + min - (curH * 60 + curMin)) > 1) {
        flush();
        curSender = sender;
        curTime = time;
        curH = h;
        curMin = min;
        groupDate = curDate; // 그룹 시작 시점의 날짜를 고정
      }
      msgs.push({ text: msg, time, h, min, excluded: false });
      continue;
    }
    // 이어지는 줄 (개행 포함 메시지)
    if (msgs.length > 0) msgs[msgs.length - 1].text += '\n' + line;
  }
  flush();
  return groups;
}

/* ============================
   파싱 - iOS
   형식: YYYY년 M월 D일 오전/오후 H:MM, 이름 : 메시지
   ============================ */
function parseIOS(text) {
  const lines = text.split(/\r?\n/);
  const reMsg = /^(\d{4}년 \d{1,2}월 \d{1,2}일.+?), (.+?) : (.+)$/;
  const reDate = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/;
  const reTime = /(오전|오후) (\d{1,2}):(\d{2})/;
  const groups = [];
  let curDate = null, groupDate = null, curSender = null, msgs = [];

  function flush() {
    if (msgs.length && curSender) {
      groups.push({ sender: curSender, date: groupDate, time: '', messages: [...msgs], excluded: false });
    }
    msgs = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const mm = reMsg.exec(line);
    if (mm) {
      const dtPart = mm[1], sender = mm[2], msg = mm[3];
      const dm = reDate.exec(dtPart);
      if (dm) curDate = `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`;
      const tm = reTime.exec(dtPart);
      let h = 0;
      if (tm) {
        h = parseInt(tm[2]);
        if (tm[1] === '오후' && h < 12) h += 12;
        if (tm[1] === '오전' && h === 12) h = 0;
      }
      if (sender !== curSender) {
        flush();
        curSender = sender;
        groupDate = curDate; // 그룹 시작 시점의 날짜를 고정
      }
      msgs.push({ text: msg, time: tm ? `${tm[1]} ${tm[2]}:${tm[3]}` : '', h, min: tm ? parseInt(tm[3]) : 0, excluded: false });
      continue;
    }
    if (msgs.length > 0) msgs[msgs.length - 1].text += '\n' + line;
  }
  flush();
  return groups;
}

/* ============================
   일자 계산 (새벽 cutoff 처리)
   ============================ */
function toDateStr(g, cutoff) {
  if (!g.date) return '날짜불명';
  const h = g.messages[0]?.h ?? 0;
  if (h < cutoff) {
    const d = new Date(g.date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  return g.date;
}

/* ============================
   필터 적용 & 렌더
   ============================ */
function applyFilter() {
  if (!window._rawText) { alert('파일을 먼저 선택하세요'); return; }
  const cutoff = getCutoff();
  const start = window._dpStart ? window._dpStart.getValue() : '';
  const end = window._dpEnd ? window._dpEnd.getValue() : '';

  // 안드로이드 우선, 실패 시 iOS 시도
  let groups = parseAndroid(window._rawText);
  if (groups.length === 0) groups = parseIOS(window._rawText);

  allGroups = groups.filter((g) => {
    const d = toDateStr(g, cutoff);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  // 참가자 초기화 (새로 추가된 이름만)
  const defaultColors = ['#2980B9', '#C0392B', '#27AE60', '#8E44AD', '#D35400'];
  const names = [...new Set(allGroups.map((g) => g.sender))];
  names.forEach((n, i) => {
    if (!participants[n]) participants[n] = {
      chaClass: `cha${i + 1}`,
      alias: n,
      color: defaultColors[i % defaultColors.length],
    };
  });

  renderSidebar();
  renderWithLoading();
}

/* 로딩 표시 후 편집창·미리보기 렌더 */
function renderWithLoading() {
  const editPane = document.getElementById('editPane');
  const previewPane = document.getElementById('previewPane');
  [editPane, previewPane].forEach((pane) => {
    pane.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'loading-hint';
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    hint.append(spinner, '불러오는 중…');
    pane.appendChild(hint);
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      renderEdit();
      renderPreview();
    });
  });
}

/* ============================
   편집창 렌더
   ============================ */
function renderEdit() {
  const pane = document.getElementById('editPane');
  pane.innerHTML = '';

  if (!allGroups.length) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = '메시지가 없습니다';
    pane.appendChild(hint);
    return;
  }
  const cutoff = getCutoff();

  // 날짜별 그룹화
  const byDay = {};
  allGroups.forEach((g, gi) => {
    const d = toDateStr(g, cutoff);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push({ ...g, _idx: gi });
  });

  const frag = document.createDocumentFragment();

  for (const [day, groups] of Object.entries(byDay)) {
    const dayAllExcluded = groups.every((g) => g.excluded);

    const dayBlock = document.createElement('div');
    dayBlock.className = 'day-block';
    dayBlock.dataset.day = day;

    const dayHeader = document.createElement('div');
    dayHeader.className = 'day-header';

    const dayLabel = document.createElement('span');
    dayLabel.className = 'day-label';
    dayLabel.textContent = formatDay(day);

    const dayToggle = document.createElement('button');
    dayToggle.className = 'toggle-btn';
    dayToggle.title = '날짜 전체 제외/복구';
    dayToggle.textContent = dayAllExcluded ? '+' : '−';
    dayToggle.addEventListener('click', function () { toggleDay(day, this); });

    dayHeader.append(dayLabel, dayToggle);
    dayBlock.appendChild(dayHeader);

    groups.forEach((g) => {
      const gi = g._idx;
      const p = participants[g.sender] ?? { chaClass: 'cha0', alias: g.sender };
      const chaColor = p.color ?? '#666';

      const msgGroup = document.createElement('div');
      msgGroup.className = 'msg-group' + (g.excluded ? ' excluded' : '');
      msgGroup.dataset.gi = gi;
      msgGroup.draggable = true;
      msgGroup.addEventListener('dragstart', (e) => dndStart(e, gi));
      msgGroup.addEventListener('dragover', dndOver);
      msgGroup.addEventListener('drop', (e) => dndDrop(e, gi));
      msgGroup.addEventListener('dragleave', dndLeave);
      msgGroup.addEventListener('dragend', dndEnd);

      const msgRow = document.createElement('div');
      msgRow.className = 'msg-row';

      const senderDiv = document.createElement('div');
      senderDiv.className = 'msg-sender';
      senderDiv.style.color = chaColor;
      senderDiv.append(`[${p.chaClass}]`, document.createElement('br'), p.alias);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'msg-content';

      g.messages.forEach((m, mi) => {
        const msgLine = document.createElement('div');
        msgLine.className = 'msg-line' + (m.excluded ? ' excluded-msg' : '');

        const msgText = document.createElement('span');
        msgText.className = 'msg-text';
        msgText.contentEditable = 'true';
        msgText.spellcheck = false;
        msgText.setAttribute('autocorrect', 'off');
        msgText.setAttribute('autocapitalize', 'off');
        msgText.dataset.gi = gi;
        msgText.dataset.mi = mi;
        msgText.textContent = m.text;
        msgText.addEventListener('blur', function () { editMsg(this); });
        msgText.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
        });

        const msgTime = document.createElement('span');
        msgTime.className = 'msg-time';
        msgTime.textContent = m.time;

        const miniBtn = document.createElement('button');
        miniBtn.className = 'mini-btn';
        miniBtn.textContent = m.excluded ? '+' : '−';
        miniBtn.addEventListener('click', function () { toggleMsg(gi, mi, this); });

        msgLine.append(msgText, msgTime, miniBtn);
        contentDiv.appendChild(msgLine);
      });

      const groupToggle = document.createElement('button');
      groupToggle.className = 'mini-btn group-toggle';
      groupToggle.title = '묶음 전체';
      groupToggle.textContent = g.excluded ? '+' : '−';
      groupToggle.addEventListener('click', function () { toggleGroup(gi, this); });

      msgRow.append(senderDiv, contentDiv, groupToggle);
      msgGroup.appendChild(msgRow);
      dayBlock.appendChild(msgGroup);
    });

    frag.appendChild(dayBlock);
  }

  pane.appendChild(frag);
  document.getElementById('msgCount').textContent =
    `(건수가 5000개 이상되면 버벅임) ${allGroups.filter((g) => !g.excluded).length}개 묶음`;
}

/* ============================
   미리보기 렌더 (테이블 출력 미리보기)
   ============================ */
function renderPreview() {
  const pane = document.getElementById('previewPane');
  if (!allGroups.length) {
    pane.innerHTML = '<div class="empty-hint">편집창에서 작업하면 여기에 반영됩니다</div>';
    return;
  }
  pane.innerHTML = generateHTML();
}

/* ============================
   토글: 개별 묶음
   ============================ */
function toggleGroup(gi, btn) {
  allGroups[gi].excluded = !allGroups[gi].excluded;
  const excl = allGroups[gi].excluded;
  allGroups[gi].messages.forEach((m) => { m.excluded = excl; });
  btn.textContent = excl ? '+' : '−';
  btn.closest('.msg-group').classList.toggle('excluded', excl);
  document.getElementById('msgCount').textContent =
    `(건수가 5000개 이상되면 버벅임)${allGroups.filter((g) => !g.excluded).length}개 묶음`;
  renderPreview();
}

function toggleMsg(gi, mi, btn) {
  const m = allGroups[gi].messages[mi];
  m.excluded = !m.excluded;
  btn.textContent = m.excluded ? '+' : '−';
  btn.closest('.msg-line').classList.toggle('excluded-msg', m.excluded);
  renderPreview();
}

/* ============================
   토글: 날짜 전체
   ============================ */
function toggleDay(day, btn) {
  const cutoff = getCutoff();
  const dayGroups = allGroups.filter((g) => toDateStr(g, cutoff) === day);
  const newExcluded = !dayGroups.every((g) => g.excluded);
  allGroups.forEach((g, gi) => {
    if (toDateStr(g, cutoff) === day) {
      allGroups[gi].excluded = newExcluded;
      allGroups[gi].messages.forEach((m) => { m.excluded = newExcluded; });
    }
  });
  renderWithLoading();
}

/* ============================
   인라인 텍스트 편집
   ============================ */
let _previewTimer = null;
function editMsg(el) {
  const gi = parseInt(el.dataset.gi);
  const mi = parseInt(el.dataset.mi);
  allGroups[gi].messages[mi].text = el.innerText;
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(renderPreview, 400);
}

/* ============================
   드래그앤드롭 (묶음 단위)
   ============================ */
function dndStart(e, gi) {
  dragSrc = gi;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function dndOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function dndLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function dndEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
}

function dndDrop(e, gi) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (dragSrc === null || dragSrc === gi) return;
  const tmp = allGroups.splice(dragSrc, 1)[0];
  const newGi = dragSrc < gi ? gi - 1 : gi;
  allGroups.splice(newGi, 0, tmp);
  dragSrc = null;
  renderEdit();
  renderPreview();
}

/* ============================
   사이드바 참가자 설정
   ============================ */
function renderSidebar() {
  const names = [...new Set(allGroups.map((g) => g.sender))];
  const list = document.getElementById('participantList');
  list.innerHTML = '';

  if (!names.length) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.style.cssText = 'padding:20px 8px;font-size:12px';
    hint.append('파일을 불러오면', document.createElement('br'), '여기에 표시됩니다');
    list.appendChild(hint);
    return;
  }

  const frag = document.createDocumentFragment();
  names.forEach((name) => {
    const p = participants[name] || { chaClass: 'cha0', alias: name, color: '#666' };

    const row = document.createElement('div');
    row.className = 'participant-row';
    row.dataset.name = name;

    const orig = document.createElement('span');
    orig.className = 'orig';
    orig.title = name;
    orig.textContent = name;

    const aliasInput = document.createElement('input');
    aliasInput.type = 'text';
    aliasInput.placeholder = '별명';
    aliasInput.value = p.alias;
    aliasInput.className = 'alias-input';

    const chaInput = document.createElement('input');
    chaInput.type = 'text';
    chaInput.placeholder = '클래스명';
    chaInput.value = p.chaClass;
    chaInput.className = 'cha-input';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = p.color || '#666';
    colorInput.className = 'color-input';

    row.append(orig, aliasInput, chaInput, colorInput);
    frag.appendChild(row);
  });
  list.appendChild(frag);
}

function applySettings() {
  document.querySelectorAll('.participant-row').forEach((row) => {
    const name = row.dataset.name;
    const alias = row.querySelector('.alias-input').value || name;
    const chaClass = row.querySelector('.cha-input').value;
    const color = row.querySelector('.color-input').value;
    participants[name] = { alias, chaClass, color };
  });
  renderWithLoading();
}

/* ============================
   HTML 출력 생성 (테이블 형식)
   ============================ */
function generateHTML() {
  const cutoff = getCutoff();
  const byDay = {};

  allGroups.forEach((g) => {
    if (g.excluded) return;
    const d = toDateStr(g, cutoff);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(g);
  });

  let rows = '';
  for (const [day, groups] of Object.entries(byDay)) {
    rows += `<tr><td colspan="2" class="talk-date"><b>${formatDay(day)}</b></td></tr>\n`;
    groups.forEach((g) => {
      const activeMsgs = g.messages.filter((m) => !m.excluded);
      if (!activeMsgs.length) return;
      const p = participants[g.sender] || { chaClass: 'cha0', alias: g.sender };
      const text = activeMsgs
        .map((m) => m.text.split('\n').map(esc).join('<br />'))
        .join('<br />');
      rows += `<tr>\n<td class="${p.chaClass}">${esc(p.alias)}</td>\n<td>${text}</td>\n</tr>\n`;
    });
  }
  // 참가자별 색상 → chaClass CSS 규칙 생성
  const chaColorMap = {};
  Object.values(participants).forEach((p) => {
    if (p.color && !chaColorMap[p.chaClass]) chaColorMap[p.chaClass] = p.color;
  });
  const chaCSS = Object.entries(chaColorMap)
    .map(([cls, color]) => `table.table__kakao-backup td.${cls}{color:${color};font-weight:bold;}`)
    .join('\n');

  const style = `<style>\ntable.table__kakao-backup{width:100%; table-layout: auto !important;}\ntable.table__kakao-backup>tbody>tr>td:not(.talk-date):first-of-type{width:9% !important; text-align:right;}\ntable.table__kakao-backup td.talk-date{text-align:center;color:#999;font-size:13px;padding:10px 0 6px;border-top:1px solid #eee;}\n${chaCSS}\n</style>`;
  return `${style}\n<table class="table__kakao-backup">\n<tbody>\n${rows}</tbody>\n</table>`;
}

/* ============================
   복사 / 다운로드
   ============================ */
function copyHTML() {
  const code = generateHTML();
  navigator.clipboard.writeText(code)
    .then(() => alert('HTML 코드가 복사되었습니다!'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('복사 완료!');
    });
}

function downloadHTML() {
  const code = generateHTML();
  const full = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>카카오톡 대화</title>
<style>
  body { max-width: 720px; margin: 0 auto; padding: 32px 20px; font-family: 'Noto Sans KR', sans-serif; line-height: 1.8; color: #222; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 4px 8px; vertical-align: top; font-size: 14px; line-height: 1.7; }
</style>
</head>
<body>
${code}
</body>
</html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([full], { type: 'text/html' }));
  a.download = 'kakao_backup.html';
  a.click();
}

/* ============================
   유틸
   ============================ */
function formatDay(d) {
  if (!d || d === '날짜불명') return d;
  const dt = new Date(d + 'T12:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
