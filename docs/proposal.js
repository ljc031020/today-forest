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

/* 1 표지 */
$('#cvBig').innerHTML = tiles(W(F), 72, 'on');
$('#cvCap').textContent = `오늘의 ‘숲’ · 그림 섬 ${NOW}세대`;
$('#cvDict').innerHTML = SIDS.filter(s => W(s)).map(s => `<div class="w">${tiles(W(s), 20)}<span>${NAME[s]}</span></div>`).join('');
$('#cvNow').textContent = `${TF.md(Date.parse(GENS[0].at))} 시작 · 지금 ${NOW}세대 · 매일 07·19시 자동 실행`;

/* 5 결과 ① */
const lin = TF.lineage('grid', F), runs = runsOf(lin);
$('#r1h').textContent = `‘숲’을 부르는 말: ${NOW}세대 동안 ${runs.length - 1}번 바뀌고, 지금도 통한다.`;
{ const r5 = GENS.slice(-5), avg = r5.reduce((a, g) => a + g.islands.grid.ok / g.islands.grid.talks, 0) / r5.length;
  $('#r1v').innerHTML = `<span>${pct(GENS[0].islands.grid.ok / GENS[0].islands.grid.talks)}%</span><i>→</i><b>${pct(avg)}%</b>`; }
{ const st = $('#r1strip'); st.style.setProperty('--n', lin.length);
  st.innerHTML = lin.map(x => `<span class="s${x.changed ? ' ch' : ''}">${x.w ? tiles(x.w, 6, 'mini' + (x.changed ? ' hot' : '')) : ''}<small>${x.gen}</small></span>`).join('');
  const pick = runs.length <= 4 ? runs : [runs[0], runs[Math.round((runs.length - 1) / 3)], runs[Math.round((runs.length - 1) * 2 / 3)], runs[runs.length - 1]];
  $('#r1keys').innerHTML = pick.map((x, i) => { const last = i === pick.length - 1; return `<div class="k1${last ? ' now' : ''}">${tiles(x.w, 40, last ? 'on' : '')}<span>${last ? `지금 ${NOW}세대` : `${x.a}세대`}</span></div>`; }).join('<b>→</b>'); }

/* 6 결과 ② 메모 비교 + 두 섬 */
{ const C = await TF.loadControl(), CG = (C && GENS.find(x => x.gen === C.gen)) || TF.LAST;
  $('#ctrl').innerHTML = TF.ORDER.map(k => { const c = C && C.islands && C.islands[k], a = c ? pct(c.ok / c.talks) : null, b = pct(CG.islands[k].ok / CG.islands[k].talks);
    return `<div class="cb" style="--c:${COL[k]}"><div class="hd"><b>${TF.ISL[k]}</b><span>${a == null ? '측정 중' : `메모 없음 ${a}% → 메모 30줄 ${b}%`}</span></div>${a == null ? '' : `<span class="bt"><i class="m" style="width:${a}%"></i></span>`}<span class="bt"><i style="width:${b}%"></i></span></div>`; }).join('');
  $('#ctrlCap').textContent = `회색 = 메모를 지운 같은 AI · 색 = 메모 30줄 · ${C && C.gen ? `${C.gen}세대 기준, ` : ''}섬마다 32판 · 찍으면 25%`; }
{ const cr = GENS.filter(g => g.cross);
  if (cr.length) {
    $('#crossSub').textContent = `${TF.META.met_gen}세대부터`;
    $('#cross').innerHTML = cr.map((g, i) => { const v = g.cross.ok / g.cross.talks; return `<div class="c"><b>${pct(v)}%</b><i style="height:${Math.max(4, v * 120)}px"></i><small>만남 ${i + 1}세대째</small></div>`; }).join('');
    $('#crossCap').textContent = `글자 섬 × 그림 섬 사이 대화, 세대마다 ${cr[0].cross.talks}판 · 첫 세대는 찍기(25%)보다 낮음 → 서로 다른 약속이 오히려 방해. 이후 서로의 말을 배우는 중`;
  } else { $('#cross').innerHTML = '<p class="cap">10/22부터 만남 시작</p>'; } }

/* 7 결론·한계 */
{ const r5 = GENS.slice(-5), avg = r5.reduce((a, g) => a + g.islands.grid.ok / g.islands.grid.talks, 0) / r5.length;
  $('#conclN').textContent = `근거 (${NOW}세대 기준, 섬마다 1번 실행한 관찰): 찍기 25% → ${pct(avg)}% · ‘숲’ ${runs.length - 1}번 바뀌어도 소통 유지 · 메모를 지우면 성공률이 절반 가까이로`; }
$('#chars').innerHTML = TF.META.islands.grid.chars.map(c => `<i>${esc(c[0])}</i>`).join('');
{ const sea = W(ID.sea), lm = W(ID.mountain, 'line'), tm = W(ID.mountain, 'twin'), out = [];
  if (sea && sea.includes('ㅂ')) out.push(`<div>${tiles(sea, 22)}<span class="cap"><b class="ink">바다</b> = ㅂ (한국어 첫소리)</span></div>`);
  const om = (lm && lm.startsWith('ο')) ? ['line', lm] : (tm && tm.startsWith('ο')) ? ['twin', tm] : null;
  if (om) out.push(`<div><span style="--k:${COL[om[0]]}">${tiles(om[1], 30, 'on', om[0])}</span><span class="cap"><b class="ink">산</b> = ο (그리스어 όρος) · ${TF.ISL[om[0]]}</span></div>`);
  $('#leak').innerHTML = out.join('') || '<span class="cap">모양이 닮은 글자부터 고름</span>'; }

/* 8 선과 점: 예시 글자 (모양 예시일 뿐, 실제 결과 아님) */
const P = n => [((n - 1) % 3), Math.floor((n - 1) / 3)];
function glyph(strokes, s = 92, col = 'var(--ink)'){
  const g = s / 4, xy = n => P(n).map(v => g + v * g);
  let h = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;
  for (let n = 1; n <= 9; n++) { const [x, y] = xy(n); h += `<circle cx="${x}" cy="${y}" r="3" fill="#C4CAC2"/>`; }
  for (const [a, b] of strokes) { const [x1, y1] = xy(a), [x2, y2] = xy(b); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${s * .07}" stroke-linecap="round"/>`; }
  return h + '</svg>';
}
$('#glyphs').innerHTML = glyph([[1, 5], [5, 9]]) + glyph([[2, 8], [4, 6], [1, 3]]) + glyph([[1, 7], [7, 9], [3, 5]]) + '<span class="cap">예시 모양<br>(실제 결과 아님)</span>';

/* 9 결과물 그림 */
$('#o1').innerHTML = `<span class="tag g">그림 섬</span><span class="tag" style="background:var(--line-i);color:#fff">글자 섬</span><span class="tag" style="background:var(--twin);color:#fff">비교 섬</span><span class="tag k">+ 선과 점 섬</span>`;
$('#o2').innerHTML = glyph([[1, 5], [5, 9]], 76) + glyph([[2, 8], [4, 6], [1, 3]], 76) + glyph([[1, 7], [7, 9], [3, 5]], 76) + glyph([[1, 3], [3, 9], [9, 7]], 76);
$('#o3').innerHTML = `<span class="tiles mini" style="--q:6px;--cols:3">${'<i class="f"></i>'.repeat(6)}<i></i><i></i><i></i></span><b class="ar" style="font-size:18px">→</b>` + tiles(W(F), 20) + `<span class="cap" style="margin-left:6px">‘숲’ ${runs.length}개의 모양</span>`;

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
