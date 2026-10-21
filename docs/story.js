/* 오늘의 숲 발표 v4 — 피그마 05 슬라이드 9장. 숫자·단어는 전부 실제 데이터에서.
   ← → / Space / PageUp·Down / 클릭 점으로 넘김. #3 처럼 주소로 바로 감. 세로 화면이면 위아래로 쌓음. */
(async function(){
const $ = s => document.querySelector(s);
await TF.load();
const {SIDS, NAME, NOW, GENS, ID} = TF, esc = TF.esc;
const COL = {grid:'var(--grid)', line:'var(--line-i)', twin:'var(--twin)'};
const W = (s, k = 'grid', row) => TF.word(k, s, row);
const pct = v => Math.round(v * 100);
const isGrid = k => TF.body(k) === 'grid';
function tiles(w, q, cls = '', k = 'grid'){
  if (w == null) return '<span class="cap">아직 말 없음</span>';
  const ch = [...w], g = isGrid(k) && ch.length === 9; let n = 0;
  if (!g) q = Math.round(q * Math.min(1.6, Math.max(.9, 4 / Math.max(2, ch.length))));
  return `<span class="tiles ${cls}" style="--q:${q}px;--cols:${g ? 3 : ch.length}">${ch.map(c => c === '.' ? '<i></i>' : `<i class="f" style="--n:${n++}">${esc(c)}</i>`).join('')}</span>`;
}
const img = (s, z) => `<img src="img/${s}.png" alt="${esc(NAME[s])}" width="${z}" height="${z}">`;
const runsOf = L => { const o = []; for (const x of L) { if (!x.w) continue; if (!o.length || x.w !== o[o.length - 1].w) o.push({w: x.w, a: x.gen, b: x.gen}); else o[o.length - 1].b = x.gen; } return o; };
const span = r => r.a === r.b ? `${r.a}세대` : r.b === NOW ? `${r.a}세대~` : `${r.a}–${r.b}세대`;
const F = ID.forest, QW = W(F);

/* 1 표지 */
const nWords = SIDS.filter(s => W(s)).length;
$('#s1sub').textContent = `AI 4명이 사람 말 없이 그림 맞히기만 했어요. ${NOW}세대 동안 생긴 말 ${nWords}개.`;
$('#s1big').innerHTML = tiles(QW, 88, 'on');
$('#s1cap').textContent = `‘숲’ · 그림 섬 ${NOW}세대`;
$('#s1dict').innerHTML = SIDS.map((s, i) => `<div class="w rv" style="--d:${3 + i * .25}">${tiles(W(s), 30)}<span>${NAME[s]}</span></div>`).join('');

/* 2 퀴즈 — 숲. 틀리면 메모 한 줄(나무)을 힌트로 */
const comp = TF.compounds('grid').filter(c => c.op !== '⊃'), f0 = comp.find(c => c.a === F);
const hintS = f0 ? f0.parts[0] : ID.tree;
const picks = [ID.village, F, ID.tree, ID.crowd].filter((s, i, a) => s && a.indexOf(s) === i);
$('#s2word').innerHTML = tiles(QW, 110);
$('#s2picks').innerHTML = picks.map(s => `<button class="pk" data-s="${s}">${img(s, 120)}<span>${NAME[s]}</span></button>`).join('');
$('#s2picks').onclick = e => {
  const b = e.target.closest('.pk'); if (!b) return;
  const ok = b.dataset.s === F;
  for (const x of $('#s2picks').children) { x.classList.remove('ok', 'no', 'dim'); const c = x === b ? (ok ? 'ok' : 'no') : ok ? 'dim' : ''; if (c) x.classList.add(c); }
  const memo = `<span class="memo">${img(hintS, 28)}${tiles(W(hintS), 14, 'sm')}<span>= ${NAME[hintS]}</span><em>통함</em></span>`;
  if (ok) { $('#s2word .tiles').classList.add('on'); $('#s2say').innerHTML = `정답: 숲 <small>${f0 ? `${NAME[hintS]} 말을 ${f0.n}번 반복 = 숲. AI가 스스로 만든 합성어` : 'AI도 이렇게 맞혀요'}</small>`; }
  else $('#s2say').innerHTML = `힌트: AI의 메모 한 줄 ${memo}`;
};

/* 3 한 판 — 이번 세대 실제 대화에서 */
$('#l1').innerHTML = img(F, 150);
$('#l2').innerHTML = tiles(QW, 40);
{ const by = new Set(TF.META.islands.grid.chars.map(c => c[1]));
  $('#l2s').textContent = `사람 말 금지 · ${[...by].map(s => (TF.SCRIPT_KO[s] || s).replace(' 문자', '').replace(' 자모', '')).slice(0, 4).join('·')} 등 ${TF.META.islands.grid.chars.length}자 중`; }
const G = await TF.loadGen(NOW);
{ const ft = G && [...G.islands.grid.talks].reverse().find(t => t.scene === F && t.cands);
  const c = ft ? ft.cands : [ID.house, ID.volcano, F, ID.village];
  $('#l3').innerHTML = c.map(s => `<span class="${s === F ? 'on' : ''}">${img(s, 56)}</span>`).join(''); }
$('#l4').innerHTML = `<span class="chip">${tiles(QW, 13)}= 숲 · 통함</span>`;

/* 4 세대 — 실제 AI 번호 */
TF.relay('grid', 4).then(rows => {
  if (!rows.length) return;
  const ids = [...new Set(rows.flatMap(r => r.ids))].sort((a, b) => a - b);
  $('#relay').innerHTML = rows.map(r => `<div class="rl${r.next ? ' nx' : ''}"><b>${r.next ? `${r.gen} · 다음` : `${r.gen}세대`}</b><span class="ids" style="--n:${ids.length}">${ids.map(id => { if (!r.ids.includes(id)) return '<i></i>'; const nw = r.born[id] === r.gen && (r !== rows[0] || r.gen > 1), out = r.end && r.end.left.includes(id); return `<i><u class="${nw && !out ? 'nw' : ''}${out ? ' out' : ''}">${id}</u></i>`; }).join('')}</span><span class="wd">${r.word ? tiles(r.word, 12) : '<b class="q">?</b>'}</span></div>`).join('');
  const first = rows[0], lastReal = [...rows].reverse().find(r => !r.next);
  const gone = first && lastReal && first !== lastReal && first.ids.every(i => !lastReal.ids.includes(i)), same = first && lastReal && first.word === lastReal.word;
  $('#punch').innerHTML = gone ? `<h3>${first.gen}세대의 AI는<br>이제 한 명도 없음.</h3><p>${same ? '그래도 ‘숲’은 같은 말.<br>사람이 다 바뀌어도 남는 말 = 물려받은 언어.' : '그사이 ‘숲’은 조금 흔들림.<br>옮겨 적는 실수가 말을 바꿈.'}</p>` : `<h3>AI는 계속 바뀌어도<br>말은 이어짐.</h3><p>물려받은 메모 30줄이 다리 역할.</p>`;
});

/* 5 배운 흔적 */
{ const lin = TF.lineage('grid', F), runs = runsOf(lin);
  $('#s5h').textContent = `‘숲’: ${NOW}세대 동안 ${runs.length - 1}번 바뀜`;
  $('#s5sub').textContent = '처음엔 아무 글자나 쓰다가, 서로 통한 말만 남았어요.' + (f0 && f0.op === '×' ? ` 지금은 ‘${NAME[f0.parts[0]]}’ 글자 ${f0.n}칸.` : '');
  const r5 = GENS.slice(-5), avg = r5.reduce((a, g) => a + g.islands.grid.ok / g.islands.grid.talks, 0) / r5.length;
  $('#s5v').innerHTML = `<span>${pct(GENS[0].islands.grid.ok / GENS[0].islands.grid.talks)}%</span><i>→</i><b>${pct(avg)}%</b>`;
  const st = $('#s5strip'); st.style.setProperty('--n', lin.length);
  st.innerHTML = lin.map(x => `<span class="s${x.changed ? ' ch' : ''}">${x.w ? tiles(x.w, 6, 'mini' + (x.changed ? ' hot' : '')) : ''}<small>${x.gen}</small></span>`).join('');
  const pick = runs.length <= 4 ? runs : [runs[0], runs[Math.round((runs.length - 1) / 3)], runs[Math.round((runs.length - 1) * 2 / 3)], runs[runs.length - 1]];
  $('#s5keys').innerHTML = pick.map((r, i) => `<div class="k1${i === pick.length - 1 ? ' now' : ''}">${tiles(r.w, 34, i === pick.length - 1 ? 'on' : '')}<span>${i === pick.length - 1 ? `지금 ${NOW}세대` : `${r.a}세대`}</span></div>`).join('<b>→</b>'); }

/* 6 규칙 */
{ const SP = TF.split('grid'), all = comp.filter(c => !SP || c.a !== SP.b), rest = all.filter(c => c !== f0), byS = (a, b) => a.since - b.since;
  const cs = [f0, rest.filter(c => c.op === '×').sort(byS)[0], rest.filter(c => c.op === '+').sort(byS)[0]].filter(Boolean);
  for (const c of rest) if (cs.length < 3 && !cs.includes(c)) cs.push(c);
  const ep = s => `<span class="ep">${tiles(W(s), 22)}<span>${NAME[s]}</span></span>`;
  $('#eqs').innerHTML = cs.length ? cs.map(c => `<div class="eq">${c.parts.map(ep).join('<b>+</b>')}${c.op === '×' ? `<b>× ${c.n}</b>` : ''}<b>=</b>${ep(c.a)}<span class="since">${c.since}세대~</span></div>`).join('') : '<p class="sub">이번 세대엔 합친 말이 안 보임</p>';
  $('#s6sub').textContent = f0 ? `그림 섬 기준. ‘${NAME[F]} = ${NAME[f0.parts[0]]} 여럿’은 AI의 상식일 수 있음. 다만 섬 전체가 같은 규칙으로 씀.` : '그림 섬 기준. 아무도 가르치지 않았는데 생긴 규칙.';
  if (SP) {
    const lane = (s, rs) => { const pk = rs.length > 2 ? [rs[0], rs[rs.length - 1]] : rs, more = rs.length - pk.length;
      return `<div class="eq"><span class="ep">${img(s, 40)}<span>${NAME[s]}</span></span>${pk.map((r, i) => `<b>→</b>${i && more ? `<span class="more">${more}번 더</span><b>→</b>` : ''}<span class="ep">${tiles(r.w, 22)}<span>${span(r)}</span></span>`).join('')}</div>`; };
    $('#split').innerHTML = lane(SP.a, SP.ra) + lane(SP.b, SP.rb) + `<p class="note">${NAME[SP.a]}: ${SP.from}칸 → ${SP.to}칸 · 긴 말은 ${NAME[SP.b]}${TF.josa(NAME[SP.b], '이', '가')} 가져감</p>`;
  } else { $('#splitH').textContent = '짧아짐'; $('#split').innerHTML = TF.lengths('grid').map(r => `<div class="eq"><b class="ink" style="font-size:18px">${{3: '자주 나오는 그림', 2: '보통', 1: '가끔 나오는 그림'}[r.t]}</b><span class="since">${r.first.toFixed(1)}칸 → ${r.last.toFixed(1)}칸</span></div>`).join(''); } }

/* 7 섬 — 만나기 전 / 만난 뒤 */
{ const MT = TF.meeting(), meetK = TF.META.meet || [];
  if (MT) {
    $('#s7k').textContent = '06 · 두 섬의 만남';
    $('#s7h').textContent = MT.recent > MT.first ? `만난 지 ${MT.days}세대, 서로의 말을 배우는 중` : `만난 지 ${MT.days}세대, 아직 서로 낯섦`;
    $('#s7sub').textContent = `${MT.mg}세대부터 글자 섬과 그림 섬이 섞여 대화. 비교 섬은 안 만남 → 둘의 차이 = 만남의 영향.`;
    $('#isls').innerHTML = `<div class="mt"><div class="cd ms rv"><p class="cap" style="font-size:15px;color:var(--t2)">두 섬 사이 대화 성공</p><p class="v">${pct(MT.first)}%<i> → </i>${pct(MT.recent)}%</p><p class="cap" style="font-size:14px;color:var(--t2)">만난 날 → 최근 3세대 평균</p></div>` +
      TF.ORDER.map((k, i) => { const r = MT.isl[k], met = meetK.includes(k); return `<div class="cd isl rv" style="--c:${COL[k]};--k:${COL[k]};--d:${i + 1};padding:24px"><div class="ih"><i></i><b>${TF.ISL[k]}</b><span class="${met ? 'c' : ''}">${met ? '만남' : '만남 없음 (기준)'}</span></div><div class="box">${tiles(W(F, k), isGrid(k) ? 34 : 50, 'on', k)}</div><div class="kv"><span>다른 섬 글자 섞인 말</span><b>${pct(r.borrow)}%</b></div><div class="kv"><span>만난 뒤 바뀐 단어</span><b>${r.changed} / ${r.total}</b></div><div class="fg">${r.foreign.length ? r.foreign.slice(0, 8).map(c => `<span>${esc(c)}</span>`).join('') : '<em class="cap" style="font-style:normal">빌린 글자 없음</em>'}</div></div>`; }).join('') + '</div>';
  } else {
    const dd = TF.dday(TF.MEET);
    $('#s7h').textContent = '섬 3개, 같은 ‘숲’도 섬마다 달라요';
    $('#s7sub').textContent = `${dd === 1 ? '내일 ' : dd > 1 ? `D-${dd} ` : ''}${TF.md(TF.MEET)}, 글자 섬과 그림 섬이 처음 만나요. 비교 섬은 끝까지 만나지 않는 기준이에요.`;
    $('#isls').innerHTML = `<div class="isl3">${TF.ORDER.map((k, i) => { const w = W(F, k), met = meetK.includes(k); return `<div class="cd isl rv" style="--c:${COL[k]};--k:${COL[k]};--d:${i}"><div class="ih"><i></i><b>${TF.ISL[k]}</b><span class="${met ? 'c' : ''}">${met ? `${TF.md(TF.MEET)} 만남` : '만남 없음'}</span></div><div class="box">${tiles(w, isGrid(k) ? 52 : 80, 'on', k)}</div><p class="nm">‘숲’ · ${TF.scriptsIn(w).map(x => TF.SCRIPT_KO[x]).join('·')}</p><p class="ds">${k === 'twin' ? '글자 섬과 같은 조건' : TF.ISL_DESC[k]}</p></div>`; }).join('')}</div>`;
  } }

/* 8 한계 */
{ const g = W(ID.mountain), sea = W(ID.sea), tm = W(ID.mountain, 'twin'), lm = W(ID.mountain, 'line'), bits = [];
  if (g && g.includes('ㅅ')) bits.push('산 = ㅅ'); if (sea && sea.includes('ㅂ')) bits.push('바다 = ㅂ');
  let t = bits.length ? `${bits.join(', ')}(한국어 첫소리)` : '';
  if ((lm && lm.startsWith('ο')) || (tm && tm.startsWith('ο'))) t += `${t ? ', ' : ''}${lm && lm.startsWith('ο') ? '글자 섬' : '비교 섬'} 산 = ο(그리스어 όρος)`;
  $('#leak').textContent = (t ? t + '. ' : '') + '아는 문자부터 고름.'; }
{ const C = await TF.loadControl(), CG = (C && GENS.find(x => x.gen === C.gen)) || TF.LAST;
  $('#ctrl').innerHTML = TF.ORDER.map(k => { const c = C && C.islands && C.islands[k], a = c ? pct(c.ok / c.talks) : null, b = pct(CG.islands[k].ok / CG.islands[k].talks);
    return `<div class="cb" style="--c:${COL[k]}"><div class="hd"><b>${TF.ISL[k]}</b><span>${a == null ? '측정 중' : `${a}% → ${b}%`}</span></div>${a == null ? '' : `<span class="bt"><i class="m" style="width:${a}%"></i></span>`}<span class="bt"><i style="width:${b}%"></i></span></div>`; }).join('') +
    `<p class="cap">회색 = 메모 없음 · 색 = 메모 30줄 · 같은 AI, 섬마다 32판${C && C.gen ? ` (${C.gen}세대)` : ''} · 찍기 25%</p>`; }

/* 9 끝 — 실시간 */
const tick = () => { $('#clk').textContent = TF.overdue() ? '지금 다음 세대를 만드는 중 · 매일 07·19시에 새 세대' : TF.nextSlot ? `다음 세대까지 ${TF.countdown()} (실시간) · 매일 07·19시에 새 세대` : `${NOW}세대에서 실험 끝`; };
tick(); setInterval(tick, 1000);

/* ── 넘기기 ── */
const S = [...document.querySelectorAll('.sl')];
S.forEach((s, i) => s.insertAdjacentHTML('beforeend', `<span class="pg">${i + 1} / ${S.length}</span>`));
$('#nav2').innerHTML = S.map((s, i) => `<button aria-label="${i + 1}번째 슬라이드: ${s.getAttribute('aria-label')}"></button>`).join('');
let cur = -1;
function go(i){
  i = Math.max(0, Math.min(S.length - 1, i)); if (i === cur) return; cur = i;
  S.forEach((s, j) => s.classList.toggle('on', j === i));
  [...$('#nav2').children].forEach((b, j) => b.toggleAttribute('aria-current', j === i));
  document.body.classList.toggle('dk', S[i].classList.contains('dark'));
  history.replaceState(null, '', `#${i + 1}`);
}
$('#nav2').onclick = e => { const b = e.target.closest('button'); if (b) go([...$('#nav2').children].indexOf(b)); };
addEventListener('keydown', e => {
  if (document.body.classList.contains('stack')) return;
  const n = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
  if (e.key === 'Home') return go(0); if (e.key === 'End') return go(S.length - 1);
  if (!n || ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button'))) return;
  e.preventDefault(); go(cur + n);
});
let tx = null;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, {passive: true});
addEventListener('touchend', e => { if (tx == null || document.body.classList.contains('stack')) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) go(cur + (d < 0 ? 1 : -1)); tx = null; });
function fit(){
  const stack = innerWidth < innerHeight;
  document.body.classList.toggle('stack', stack);
  const z = stack ? innerWidth / 1440 : Math.min(innerWidth / 1440, innerHeight / 810);
  document.documentElement.style.setProperty('--z', z);
  $('#deck').style.setProperty('--z', z);
  if (stack) S.forEach(s => s.classList.add('on'));
  else { const c = cur; cur = -1; S.forEach(s => s.classList.remove('on')); go(c < 0 ? (+location.hash.slice(1) || 1) - 1 : c); }
}
addEventListener('resize', fit); fit();
})();
