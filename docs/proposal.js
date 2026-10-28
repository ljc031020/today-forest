/* 기획 제안 10장 — 숫자·단어는 전부 실제 데이터에서. ?print 이면 10장을 한 쪽씩 늘어놓아 PDF로 */
(async function(){
const $ = s => document.querySelector(s);
await TF.load();
const {SIDS, NAME, NOW, GENS, ID} = TF, esc = TF.esc;
const COL = {grid:'var(--grid)', line:'var(--line-i)', twin:'var(--twin)'};
const W = (s, k = 'grid', row) => TF.word(k, s, row);
const pct = v => Math.round(v * 100);
const isGrid = k => TF.body(k) === 'grid';
function tiles(w, q, cls = '', k = 'grid'){
  if (w == null) return '';
  const ch = [...w], g = isGrid(k) && ch.length === 9;
  return `<span class="tiles ${cls}" style="--q:${q}px;--cols:${g ? 3 : ch.length}">${ch.map(c => c === '.' ? '<i></i>' : `<i class="f">${esc(c)}</i>`).join('')}</span>`;
}
const runsOf = L => { const o = []; for (const x of L) { if (!x.w) continue; if (!o.length || x.w !== o[o.length - 1].w) o.push({w: x.w, a: x.gen, b: x.gen}); else o[o.length - 1].b = x.gen; } return o; };
const F = ID.forest, r = k => GENS[GENS.length - 1].islands[k];

/* 공통 계산 */
const lin = TF.lineage('grid', F), runs = runsOf(lin), nCh = runs.length - 1;
const MG = TF.META.met_gen || null;
const okp = (g, k) => g.islands[k].ok / g.islands[k].talks;
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const preTo = MG ? MG - 1 : NOW, preFrom = Math.max(1, preTo - 9);
const pre = mean(GENS.filter(g => g.gen >= preFrom && g.gen <= preTo).map(g => okp(g, 'grid')));
const first = okp(GENS[0], 'grid');
const P = n => [((n - 1) % 3), Math.floor((n - 1) / 3)];
function glyph(strokes, s = 92, col = 'var(--ink)'){
  const g = s / 4, xy = n => P(n).map(v => g + v * g);
  let h = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;
  for (let n = 1; n <= 9; n++) { const [x, y] = xy(n); h += `<circle cx="${x}" cy="${y}" r="${Math.max(2, s / 32)}" fill="#C4CAC2"/>`; }
  for (const [a, b] of strokes) { const [x1, y1] = xy(a), [x2, y2] = xy(b); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${s * .07}" stroke-linecap="round"/>`; }
  return h + '</svg>';
}
const EX = [[[1, 5], [5, 9]], [[2, 8], [4, 6], [1, 3]], [[1, 7], [7, 9], [3, 5]], [[1, 3], [3, 9], [9, 7]]];

/* 1 표지 */
$('#cvBig').innerHTML = tiles(W(F), 72, 'on');
$('#cvCap').textContent = `오늘의 ‘숲’ · 그림 섬 ${NOW}세대`;
$('#cvDict').innerHTML = SIDS.filter(s => W(s)).map(s => `<div class="w">${tiles(W(s), 20)}<span>${NAME[s]}</span></div>`).join('');
$('#cvNow').textContent = `${TF.md(Date.parse(GENS[0].at))} 시작 · 지금 ${NOW}세대 · 매일 07·19시 자동 실행`;

/* 2 목표 */
$('#g1').innerHTML = `${tiles(W(F), 15, 'on')}<b class="ar" style="font-size:18px">=</b><img src="img/${F}.png" alt="숲" width="46" height="46"><span class="cap">AI들이 만든 ‘숲’</span>`;
$('#g1s').textContent = `진행 중 · ${NOW}세대째`;
$('#g2').innerHTML = `${glyph([[1, 3], [3, 9]], 56)}<b class="ar" style="font-size:18px">↔</b><span class="chars" style="margin:0"><i>ㄱ</i><i>7</i><i>Γ</i></span><span class="cap">닮았나?</span>`;
$('#g3').innerHTML = EX.map(e => glyph(e, 50)).join('') + '<span class="cap">예시</span>';

/* 6 중간 결과 */
$('#r1k').textContent = `05 · 중간 결과 — ${TF.md(Date.parse(GENS[0].at))}부터 ${NOW}세대`;
$('#f1').innerHTML = `<span>${pct(first)}%</span><i>→</i><b>${pct(pre)}%</b>`;
$('#f1c').textContent = `그림 섬 · 1세대 → ${preFrom}–${preTo}세대 평균 · 찍으면 25%`;
$('#f2p').textContent = `‘숲’을 부르는 말은 ${NOW}세대 동안 ${nCh}번 바뀌었다. 그동안에도 서로 알아들었다.`;
{ const pick = runs.length <= 4 ? runs : [runs[0], runs[Math.round((runs.length - 1) / 3)], runs[Math.round((runs.length - 1) * 2 / 3)], runs[runs.length - 1]];
  $('#f2').innerHTML = pick.map((x, i) => { const last = i === pick.length - 1; return `<div class="k1${last ? ' now' : ''}">${tiles(x.w, 22, last ? 'on' : '')}<span>${last ? `지금` : `${x.a}세대`}</span></div>`; }).join('<b>→</b>'); }
{ const C = await TF.loadControl(), CG = (C && GENS.find(x => x.gen === C.gen)) || TF.LAST;
  $('#f3').innerHTML = TF.ORDER.map(k => { const c = C && C.islands && C.islands[k], a = c ? pct(c.ok / c.talks) : null, b = pct(okp(CG, k));
    return `<div class="cb" style="--c:${COL[k]}"><div class="hd" style="font-size:14px"><b>${TF.ISL[k]}</b><span>${a == null ? '측정 중' : `${a}% → ${b}%`}</span></div>${a == null ? '' : `<span class="bt"><i class="m" style="width:${a}%"></i></span>`}<span class="bt"><i style="width:${b}%"></i></span></div>`; }).join('') + `<p class="cap" style="margin-top:10px">회색 = 메모 없음 · 색 = 메모 30줄${C && C.gen ? ` (${C.gen}세대)` : ''}</p>`; }
{ const cr = GENS.filter(g => g.cross);
  let t = '';
  if (cr.length) { const a = cr.map(g => g.cross.ok / g.cross.talks), rest = a.slice(1);
    const post = TF.ORDER.map(k => `${TF.ISL[k].replace(' 섬', '')} ${pct(mean(GENS.filter(g => g.gen >= MG).map(g => okp(g, k))))}%`).join(' · ');
    t = `두 섬 사이 대화(${MG}세대~): 첫 세대 ${pct(a[0])}%${rest.length ? ` → 이후 평균 ${pct(mean(rest))}%` : ''} (찍기 25%) · ${MG}세대 이후 섬 안 성공률은 ${post}로 조금 내려옴 — 만나지 않은 비교 섬도 함께 내려가, 원인은 분석 중`; }
  $('#r1fn').textContent = t; }

/* 7 결론·한계 */
$('#conclN').textContent = `근거 (${NOW}세대까지, 섬마다 1번 실행한 관찰): 그림 섬 ${pct(first)}% → ${pct(pre)}% · ‘숲’ ${nCh}번 바뀌어도 소통 유지 · 메모를 지우면 성공률이 절반으로`;
$('#chars').innerHTML = TF.META.islands.grid.chars.map(c => `<i>${esc(c[0])}</i>`).join('');
{ const sea = W(ID.sea), lm = W(ID.mountain, 'line'), tm = W(ID.mountain, 'twin'), out = [];
  if (sea && sea.includes('ㅂ')) out.push(`<div>${tiles(sea, 22)}<span class="cap"><b class="ink">바다</b> = ㅂ (한국어 첫소리)</span></div>`);
  const om = (lm && lm.startsWith('ο')) ? ['line', lm] : (tm && tm.startsWith('ο')) ? ['twin', tm] : null;
  if (om) out.push(`<div><span style="--k:${COL[om[0]]}">${tiles(om[1], 30, 'on', om[0])}</span><span class="cap"><b class="ink">산</b> = ο (그리스어 όρος) · ${TF.ISL[om[0]]}</span></div>`);
  $('#leak').innerHTML = out.join('') || '<span class="cap">모양이 닮은 글자부터 고름</span>'; }

/* 8 선과 점 */
$('#glyphs').innerHTML = EX.slice(0, 3).map(e => glyph(e)).join('') + '<span class="cap">예시 모양<br>(실제 결과 아님)</span>';

/* 9 결과물 */
$('#o2').innerHTML = EX.map(e => glyph(e, 76)).join('');
$('#o3').innerHTML = `<span class="tiles mini" style="--q:6px;--cols:3">${'<i class="f"></i>'.repeat(6)}<i></i><i></i><i></i></span><b class="ar" style="font-size:18px">→</b>` + tiles(W(F), 20) + `<span class="cap" style="margin-left:6px">‘숲’의 모양 ${runs.length}개</span>`;
$('#o1').innerHTML = `<span class="tag g">그림 섬</span><span class="tag" style="background:var(--line-i);color:#fff">글자 섬</span><span class="tag" style="background:var(--twin);color:#fff">비교 섬</span><span class="tag k">+ 선과 점 섬</span>`;
$('#schNow').textContent = MG ? `기존 문자 섬 ${NOW}세대째 운영, 두 섬 만남 ${NOW - MG + 1}세대째` : `기존 문자 섬 ${NOW}세대째 운영`;

/* 10 끝 */
$('#endLive').textContent = `지금 ${NOW}세대 · 매일 07·19시에 새 세대`;

/* ── 넘기기 / 인쇄 ── */
const S = [...document.querySelectorAll('.sl')];
const print = new URLSearchParams(location.search).has('print');
if (print) { document.body.classList.add('print'); window.__ready = true; return; }
$('#nav2').innerHTML = S.map((s, i) => `<button aria-label="${i + 1}번째: ${s.getAttribute('aria-label')}"></button>`).join('');
let cur = -1;
function go(i){ i = Math.max(0, Math.min(S.length - 1, i)); if (i === cur) return; cur = i;
  S.forEach((s, j) => s.classList.toggle('on', j === i));
  [...$('#nav2').children].forEach((b, j) => b.toggleAttribute('aria-current', j === i));
  document.body.classList.toggle('dk', S[i].classList.contains('dark'));
  history.replaceState(null, '', `#${i + 1}`); }
$('#nav2').onclick = e => { const b = e.target.closest('button'); if (b) go([...$('#nav2').children].indexOf(b)); };
addEventListener('keydown', e => { if (document.body.classList.contains('stack')) return;
  const n = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
  if (e.key === 'Home') return go(0); if (e.key === 'End') return go(S.length - 1);
  if (!n) return; e.preventDefault(); go(cur + n); });
function fit(){ const stack = innerWidth < innerHeight; document.body.classList.toggle('stack', stack);
  const z = stack ? innerWidth / 1440 : Math.min(innerWidth / 1440, innerHeight / 810);
  $('#deck').style.setProperty('--z', z); document.documentElement.style.setProperty('--z', z);
  if (stack) S.forEach(s => s.classList.add('on')); else { const c = cur; cur = -1; go(c < 0 ? (+location.hash.slice(1) || 1) - 1 : c); } }
addEventListener('resize', fit); fit(); window.__ready = true;
})();
