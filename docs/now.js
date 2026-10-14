/* 오늘의 숲 · 지금 — 세 단계 깊이
   #/            전체: 세 섬과 여정
   #/twin        섬: 이 섬의 말, AI 넷, 말이 변해 온 길
   #/twin/15     대화: 15세대 대화를 한 번씩 (끝나면 세대 교체)
   #/twin/15/relay  세대 교체만 */
(async function(){
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const COLOR = {line:'var(--line)', grid:'var(--grid)', twin:'var(--twin)', cross:'var(--ink)'};
const SCENE_KO = {water:'물',fire:'불',tree:'나무',person:'사람',mountain:'산',house:'집',sea:'바다',forest:'숲',village:'마을',volcano:'화산','big fire':'큰 불',crowd:'군중'};
const S = await (await fetch('data/summary.json', {cache:'no-store'})).json();
const META = S.meta, GENS = S.gens;
const SIDS = Object.values(META.scenes);
const ID2KO = {}; for (const [en, id] of Object.entries(META.scenes)) ID2KO[id] = SCENE_KO[en] || en;
const JOSA = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c % 28 ? a : b; };
const ORDER = ['line','grid','twin'];
const KO = k => k === 'cross' ? '두 섬 사이' : META.islands[k].ko;
const BODY = k => META.islands[k].body;
const LAST = GENS[GENS.length - 1];
const nowGen = LAST.gen;
const cache = {};
const getJSON = u => cache[u] || (cache[u] = fetch(u, {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null));
const pad = n => String(n).padStart(3, '0');
const loadGen = n => getJSON(`data/gens/g${pad(n)}.json`);
const loadMem = n => getJSON(`data/mem/g${pad(n)}.json`);
const rowOf = g => GENS.find(x => x.gen === g);

/* ── 여정: 지난 세대 + 앞으로 올 세대(07·19시) ── */
const KST = 9 * 3600e3;
const fmtMD = t => { const d = new Date(t + KST); return `${d.getUTCMonth()+1}/${d.getUTCDate()}`; };
const hourOf = t => new Date(t + KST).getUTCHours();
const END = Date.parse('2026-10-29T07:00:00+09:00');
const MEET = Date.parse(META.meet_at || '2026-10-22T00:00:00+09:00');
const trip = GENS.map(g => ({gen: g.gen, t: Date.parse(g.at), row: g}));
{ const t = Date.parse(LAST.at); let n = LAST.gen;
  const d0 = new Date(t + KST); let day = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) - KST;
  for (let k = 0; k < 40; k++) { for (const h of [7, 19]) { const s = day + h * 3600e3; if (s > t + 3600e3 && s <= END) trip.push({gen: ++n, t: s, row: null}); } day += 864e5; } }
const N = trip.length;
const meetGen = META.met_gen || (trip.find(x => x.t >= MEET) || {}).gen;
const endGen = trip[N - 1].gen;
const nextSlot = trip.find(x => !x.row);
const met = !!META.met_gen;
const dday = t => { const a = new Date(Date.now() + KST), b = new Date(t + KST); return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 864e5); };
const countdown = () => { if (!nextSlot) return ''; let s = Math.max(0, Math.floor((nextSlot.t - Date.now()) / 1000)); const h = Math.floor(s / 3600); s %= 3600; return `${h}:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/* ── 상태 ── */
const qs = new URLSearchParams(location.search);
let scene = META.scenes.forest, speed = +qs.get('speed') || 1, token = 0, liveOn = false, route = {};
const wait = ms => sleep(ms / speed);

/* ── 글자 그리기 ── */
function wordHTML(w, k, q){
  if (w == null) return '<span class="g" style="color:var(--faint)">—</span>';
  if (BODY(k) === 'grid') return `<span class="g3" style="--q:${q || 14}px;--k:${COLOR[k]}">${[...w].map(c => `<i>${c === '.' ? '' : esc(c)}</i>`).join('')}</span>`;
  return `<span class="g">${esc(w)}</span>`;
}
const wordAt = (row, k, s = scene) => row && row.islands[k] && (row.islands[k].words || {})[s];


/* 섬 모양: 씨앗마다 다른 해안선 + 안쪽 등고선 */
function blobPath(seed, cx = 50, cy = 41, rx = 44, ry = 32){
  const n = 12, P = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2;
    const j = 1 + 0.07 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 2.3) + 0.03 * Math.cos(2 * a + seed * 0.7);
    P.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
  const f = v => v.toFixed(2);
  let d = `M${f(P[0][0])},${f(P[0][1])}`;
  for (let i = 0; i < n; i++) { const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`; }
  return d + 'Z';
}
const SEED = {line: 1.3, grid: 4.1, twin: 2.6};
function topoSVG(k, cx = 50, cy = 41){
  const d = blobPath(SEED[k]);
  const ring = (s, o) => `<path d="${d}" transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})" style="fill:none;stroke:${COLOR[k]};stroke-opacity:${o}" vector-effect="non-scaling-stroke" stroke-width="1.2"/>`;
  return `<svg class="topo" viewBox="0 0 100 82" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" transform="translate(1.4 2.6)" style="fill:rgba(19,32,26,.07)"/>
    <path d="${d}" style="fill:color-mix(in srgb,${COLOR[k]} 12%,var(--card));stroke:${COLOR[k]};stroke-opacity:.55" vector-effect="non-scaling-stroke" stroke-width="2"/>
    ${ring(.84, .32)}${ring(.68, .22)}${ring(.52, .14)}</svg>`;
}
/* ════════ 1단계: 전체 ════════ */
async function drawOverview(){
  const M = await loadMem(nowGen);
  const map = $('#map'), W = map.clientWidth, H = map.clientHeight;
  const w = Math.max(200, Math.min(W * 0.28, H * 0.47 / 0.82, 400)), h = w * 0.82;
  const P = {line: [W * 0.25, h * 0.5 + 14], grid: [W * 0.75, h * 0.5 + 14], twin: [W * 0.5, H - h * 0.5 - 24]};
  let html = '';
  const y = P.line[1], x1 = P.line[0] + w / 2 - 4, x2 = P.grid[0] - w / 2 + 4, my = y + Math.min(46, h * 0.18);
  if (innerWidth > 900) html += `<svg class="route" width="${W}" height="${H}" aria-hidden="true"><path d="M${x1},${y} Q${W / 2},${my * 2 - y} ${x2},${y}" ${met ? '' : 'stroke-dasharray="2 9"'}/></svg>`;
  for (const k of ORDER) {
    const r = LAST.islands[k] || {}, w0 = wordAt(LAST, k);
    const born = (M && M.islands[k] && M.islands[k].born) || {};
    const ids = Object.keys(born).map(Number).sort((a, b) => a - b);
    const [cx, cy] = P[k];
    const pos = innerWidth > 900 ? `left:${cx - w / 2}px;top:${cy - h / 2}px;` : '';
    html += `<a class="isle" href="#/${k}" style="--k:${COLOR[k]};--w:${w}px;${pos}order:${{line:1,grid:3,twin:4}[k]};view-transition-name:isle-${k}">${topoSVG(k)}
      <span class="nm"><i></i>${KO(k)}</span>
      <span class="word">${wordHTML(w0, k, Math.round(w * 0.085))}</span>
      <span class="meta"><span class="dots">${ids.map(id => `<b class="${born[id] === nowGen ? 'new' : ''}" title="AI #${id}"></b>`).join('')}</span>${r.ok}/32 통함</span>
      <span class="go">들어가 보기</span></a>`;
  }
  const mx = innerWidth > 900 ? `left:${W / 2}px;top:${my}px` : 'order:2';
  html += met
    ? `<a class="flag" href="#/cross/${nowGen}" style="${mx}">두 섬이 만나는 중<small>섬 사이 대화 보기</small></a>`
    : `<div class="flag" style="${mx}">${fmtMD(MEET)} 만남<small>D-${dday(MEET)}</small></div>`;
  const tx = innerWidth > 900 ? `left:${P.twin[0] + w / 2 + 40}px;top:${P.twin[1]}px;transform:translate(0,-50%)` : 'order:5';
  html += `<div class="flag quiet" style="${tx}"><b>만나지 않는 섬</b>끝까지 혼자 말을 만들어요<br>두 섬과 견줘 보는 기준</div>`;
  map.innerHTML = html;

  $('#picks').innerHTML = `<span class="k">그림을 고르면 세 섬의 말이 바뀌어요</span>` + SIDS.map(id => `<button aria-pressed="${id === scene}" data-s="${id}" aria-label="${esc(ID2KO[id])}" title="${esc(ID2KO[id])}"><img src="img/${id}.png" alt=""></button>`).join('');
  $('#picks').querySelectorAll('button').forEach(b => b.onclick = () => { scene = b.dataset.s; drawOverview(); });

  const at = g => ((trip.findIndex(x => x.gen === g)) / (N - 1) * 100);
  const marks = [[1, `${fmtMD(trip[0].t)} 시작`, ''], [nowGen, `지금 · ${nowGen}세대`, 'now'], [meetGen, `${fmtMD(MEET)} 만남`, ''], [endGen, `${fmtMD(trip[N - 1].t)} 발표`, '']];
  $('#jbar').innerHTML = `<div class="tr"></div><div class="done" style="width:${at(nowGen)}%"></div>` +
    marks.filter(m => m[0]).map(([g, t, c]) => `<div class="mk ${c}" style="left:${at(g)}%"><b></b><span>${t}</span></div>`).join('');
}

/* ════════ 2단계: 섬 ════════ */
async function drawIsland(k){
  const M = await loadMem(nowGen);
  const MI = M && M.islands[k] || {};
  const prev = rowOf(nowGen - 1);
  $('#dictH').innerHTML = `이 섬의 말 <small>${nowGen}세대 · 그림을 누르면 아래에 변해 온 길이 나와요</small>`;
  $('#dict').innerHTML = SIDS.map(s => {
    const w = wordAt(LAST, k, s), p = wordAt(prev, k, s);
    return `<button class="dc" data-s="${s}" aria-pressed="${s === scene}" style="--k:${COLOR[k]}">${p !== undefined && p !== w ? '<span class="new">바뀜</span>' : ''}<span class="dh"><img src="img/${s}.png" alt=""><span>${esc(ID2KO[s])}</span></span><span class="gword">${wordHTML(w, k, 24)}</span></button>`;
  }).join('');
  $('#dict').querySelectorAll('.dc').forEach(b => b.onclick = () => { scene = b.dataset.s; drawIsland(k); });

  const born = MI.born || {};
  const ids = Object.keys(born).map(Number).sort((a, b) => a - b);
  $('#ais').innerHTML = ids.map(id => `<div class="ai"><span class="av" style="border-color:${COLOR[k]};color:${COLOR[k]}">${id}${born[id] === nowGen ? '<span class="new">새</span>' : ''}</span><p><b>AI #${id}</b>${born[id]}세대에 옴</p></div>`).join('');
  const next = (MI.end && MI.end.born || []).map(b => '#' + b.id).join(', ');
  const mini = (kk, x, op = 1) => `<g transform="translate(${x} 4) scale(.34)" opacity="${op}"><path d="${blobPath(SEED[kk])}" style="fill:color-mix(in srgb,${COLOR[kk]} 22%,var(--card));stroke:${COLOR[kk]}" stroke-width="3"/></g>`;
  const fate = k === 'twin'
    ? `<svg class="ic" viewBox="0 0 92 36" aria-hidden="true">${mini('twin', 0)}<path d="M40,18 L56,18" stroke="var(--rule)" stroke-width="2" stroke-dasharray="2 4"/><circle cx="74" cy="18" r="13" fill="none" stroke="var(--rule)" stroke-width="1.5" stroke-dasharray="3 3"/></svg><p><b>만나지 않는 섬</b>글자 섬과 같은 조건으로 시작해서, 끝까지 혼자 말을 만들어요. 만남이 말을 어떻게 바꾸는지 견줘 보는 기준이에요.</p>`
    : `<svg class="ic" viewBox="0 0 92 36" aria-hidden="true">${mini(k, 0)}<path d="M36,22 Q46,30 56,22" fill="none" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="2 4"/>${mini(k === 'line' ? 'grid' : 'line', 54)}</svg><p><b>${met ? '다른 섬과 만나는 중' : `${fmtMD(MEET)}, ${KO(k === 'line' ? 'grid' : 'line')}${JOSA(KO(k === 'line' ? 'grid' : 'line'), '과', '와')} 만나요 · D-${dday(MEET)}`}</b>그날부터 두 섬의 AI가 서로에게 말을 걸어요. 들은 낯선 글자는 빌려 쓸 수 있어요.</p>`;
  $('#fate').innerHTML = fate;
  $('#cta').innerHTML = `<a class="pill pri" href="#/${k}/${nowGen}" style="background:${COLOR[k]};border-color:${COLOR[k]}">${nowGen}세대 대화 보기</a>` +
    `<a class="pill" href="#/${k}/${nowGen}/relay">세대 교체만 보기${next ? ` · 다음 세대 ${next}` : ''}</a>`;

  // 말이 변해 온 길
  $('#lineH').innerHTML = `‘${esc(ID2KO[scene])}’${JOSA(ID2KO[scene], '을', '를')} 부르는 말 <small>칸을 누르면 그 세대 대화를 봐요</small>`;
  const lane = $('#lane');
  const P = trip.filter(x => x.row).length, F = N - P;
  lane.style.setProperty('--cols', `repeat(${P}, minmax(0,3fr)) repeat(${F}, minmax(0,1fr))`);
  const colW = lane.clientWidth / (P * 3 + F) * 3;
  let h = '', lastMD = '';
  for (const x of trip) {
    const md = fmtMD(x.t), cls = x.gen === nowGen ? 'now' : x.gen === meetGen ? 'meet' : x.gen === endGen ? 'end' : '';
    const lab = cls === 'now' ? '지금' : cls === 'meet' ? `${md} 만남` : cls === 'end' ? `${md} 발표` : (x.row && md !== lastMD && Math.abs(x.gen - nowGen) > 1 ? md : '');
    lastMD = md;
    h += `<div class="mk ${cls || (lab ? 'date' : '')}">${lab ? `<span>${lab}</span>` : ''}</div>`;
  }
  let prevW;
  for (const x of trip) {
    let inner = '';
    if (x.row) {
      const w = wordAt(x.row, k), same = w != null && w === prevW; prevW = w;
      const ok = (x.row.islands[k] || {}).ok || 0;
      if (BODY(k) === 'grid') { const q = Math.max(5, Math.min(13, Math.floor((colW - 10) / 3.4))); inner = (w ? wordHTML(w, k, q).replace('class="g3"', `class="g3${same ? ' same' : ''}"`) : '·'); }
      else { const fs = Math.max(12, Math.min(30, (colW - 8) / ([...(w || '·')].length * 0.62))); inner = `<span class="g w${same ? ' same' : ''}" style="--fs:${fs}px">${esc(w || '·')}</span>`; }
      inner += `<span class="bar"><u style="height:${Math.round(ok / 32 * 100)}%"></u></span>`;
    }
    h += `<div class="cell ${x.row ? 'past' : 'fut'}${x.gen === nowGen ? ' cur' : ''}" style="--k:${COLOR[k]}" data-g="${x.gen}">${inner}</div>`;
  }
  lane.innerHTML = h;
  const cx = g => { const c = lane.querySelector(`.cell[data-g="${g}"]`); return c ? c.offsetLeft + c.offsetWidth / 2 : 0; };
  for (const [g, c] of [[nowGen, ''], [meetGen, ' dash'], [endGen, ' dash']]) if (g) lane.insertAdjacentHTML('beforeend', `<div class="vline${c}" style="left:${cx(g)}px"></div>`);
  lane.querySelectorAll('.cell.past').forEach(e => {
    e.onclick = () => { location.hash = `#/${k}/${e.dataset.g}`; };
    e.onmouseenter = () => { const x = trip.find(y => y.gen === +e.dataset.g), r = x.row.islands[k] || {};
      const tip = $('#tip'); tip.textContent = `${x.gen}세대 · ${fmtMD(x.t)} ${hourOf(x.t)}시 · ${r.ok}/32 통함`; tip.classList.add('show');
      const b = e.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, b.left + b.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = (b.top - tip.offsetHeight - 6) + 'px'; };
    e.onmouseleave = () => $('#tip').classList.remove('show');
  });
}

/* ════════ 3단계: 대화 ════════ */
const view = $('#vTalk');
function setColor(k){ view.style.setProperty('--c', COLOR[k] || 'var(--ink)'); }
function setStep(i){ view.querySelectorAll('.step').forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); }); }

// 기억 한 줄: {s:그림, m:말, ok, f:말한 섬, mut:베끼다 바뀐 줄}
const toEntry = (x, k) => ({s: x[0], m: x[1], ok: !!x[2], f: x[3] || k});
function chipInner(e){
  if (BODY(e.f) === 'grid') return `<span class="gm">${[...e.m].map(c => `<i class="${c === '.' ? '' : 'f'}"></i>`).join('')}</span>`;
  return esc(e.m);
}
function shelfHTML(mem, k, opt = {}){
  const by = {}; SIDS.forEach(s => by[s] = []);
  mem.forEach((e, i) => { (by[e.s] || (by[e.s] = [])).push([e, i]); });
  return SIDS.map(s => `<div class="col${opt.look === s ? ' look' : ''}" data-s="${s}"><img src="img/${s}.png" alt="" title="${esc(ID2KO[s])}"><div class="chips">` +
    by[s].slice().reverse().map(([e, i]) => `<span class="chip ${e.ok ? 'ok' : 'no'}${e.f !== k ? ' far' : ''}${e.mut ? ' mut' : ''}${opt.add === i ? ' add' : ''}" data-i="${i}" style="--k:${COLOR[e.f]};--k2:${COLOR[e.f]}">${chipInner(e)}</span>`).join('') +
    `</div></div>`).join('');
}
function remember(mem, e){ mem.push(e); if (mem.length > 30) mem.shift(); return mem.length - 1; }

function drawSlots(list){
  $('#slots').innerHTML = Array.from({length: 32}, (_, i) => {
    const r = list[i];
    if (!r) return `<div class="slot${i === list.length ? ' cur' : ''}"></div>`;
    return `<div class="slot ${r.ok ? 'ok' : 'no'}" style="--c:${COLOR[r.from] || 'var(--ink)'}" title="${esc(ID2KO[r.scene] || '')}"><img src="img/${r.scene}.png" alt=""></div>`;
  }).join('');
  const ok = list.filter(r => r.ok).length;
  $('#tally').innerHTML = list.length ? `${ok}<small>/ ${list.length} 통함</small>` : '';
}
function drawRoster(ids, born, gen, sp, li){
  $('#roster').innerHTML = ids.map(id => `<span class="av${id === sp ? ' speak' : id === li ? ' listen' : ''}">${id}${gen > 1 && born[id] === gen ? '<span class="new">새</span>' : ''}</span>`).join('');
}
function clearScene(){
  $('#target').classList.add('hide'); const m = $('#msg'); m.innerHTML = ''; m.className = 'msg'; m.style.left = '0px';
  $('#verdict').classList.remove('show','ok'); $('#tag').className = 'tag';
  $('#cands').innerHTML = Array.from({length: 4}, () => '<div class="cand back"><img alt=""></div>').join('');
  setStep(-1);
}
function hideOverlays(){ ['#relay','#wait','#summary'].forEach(s => $(s).classList.remove('show')); }

async function play(rec, tk, ctx){
  const from = rec.from, to = rec.to, body = BODY(from);
  setColor(from);
  const spMem = ctx.mem[rec.sp] || (ctx.mem[rec.sp] = []), liMem = ctx.mem[rec.li] || (ctx.mem[rec.li] = []);
  $('#spAv').textContent = rec.sp; $('#liAv').textContent = rec.li;
  $('#spAv').style.cssText = `background:${COLOR[from]};border-color:${COLOR[from]}`;
  $('#liAv').style.cssText = `border-color:${COLOR[to]};color:${COLOR[to]}`;
  drawRoster(ctx.ids, ctx.born, ctx.gen, rec.sp, rec.li);
  $('#spShelf').innerHTML = shelfHTML(spMem, from); $('#spShelf').style.setProperty('--c', COLOR[from]);
  $('#liShelf').innerHTML = shelfHTML(liMem, to); $('#liShelf').style.setProperty('--c', COLOR[to]);
  clearScene();
  // 1 본다
  setStep(0); $('#targetImg').src = `img/${rec.scene}.png`;
  await wait(200); if (tk !== token) return;
  $('#target').classList.remove('hide');
  await wait(500); if (tk !== token) return;
  const col = $(`#spShelf .col[data-s="${rec.scene}"]`); col && col.classList.add('look');
  await wait(700); if (tk !== token) return;
  // 2 말한다
  setStep(1);
  const used = [...spMem.keys()].reverse().find(i => spMem[i].s === rec.scene && spMem[i].m === rec.msg);
  const tag = $('#tag');
  if (used !== undefined) { const c = $(`#spShelf .chip[data-i="${used}"]`); c && c.classList.add('use'); tag.textContent = '기억에서 꺼냄'; tag.className = 'tag memo show'; }
  else { tag.textContent = '새로 지음'; tag.className = 'tag fresh show'; }
  await wait(500); if (tk !== token) return;
  const m = $('#msg'); m.className = 'msg' + (body === 'grid' ? ' grid' : '');
  if (body === 'grid') { m.innerHTML = '<i></i>'.repeat(9); const cells = m.querySelectorAll('i');
    for (let i = 0; i < 9; i++) { if (tk !== token) return; const c = rec.msg[i]; if (c !== '.') { cells[i].textContent = c; cells[i].animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:1}], 220); await wait(120); } } }
  else for (const c of rec.msg) { if (tk !== token) return; m.insertAdjacentHTML('beforeend', `<span>${esc(c)}</span>`); await wait(200); }
  await wait(300); if (tk !== token) return;
  m.style.left = Math.max(0, $('#track').clientWidth - m.offsetWidth) + 'px';
  await wait(950); if (tk !== token) return;
  // 3 고른다
  setStep(2); tag.className = 'tag';
  const heard = liMem.map((e, i) => [e, i]).filter(([e]) => e.m === rec.msg);
  heard.forEach(([e, i]) => { const c = $(`#liShelf .chip[data-i="${i}"]`); c && c.classList.add('hear'); const cl = c && c.closest('.col'); cl && cl.classList.add('look'); });
  tag.textContent = heard.length ? '들어 본 말' : '처음 듣는 말'; tag.className = 'tag ' + (heard.length ? 'memo' : 'fresh') + ' show';
  const cands = rec.cands || [];
  $('#cands').innerHTML = cands.map(c => `<div class="cand" data-s="${c}"><img src="img/${c}.png" alt="${esc(ID2KO[c] || '')}"></div>`).join('');
  const els = [...$('#cands').children];
  await wait(400); if (tk !== token) return;
  const known = new Set(heard.filter(([e]) => e.ok).map(([e]) => e.s));
  els.forEach(e => known.has(e.dataset.s) && e.classList.add('hint'));
  for (let r = 0; r < 2; r++) for (const e of els) { if (tk !== token) return; e.classList.add('scan'); await wait(110); e.classList.remove('scan'); }
  const pick = els.find(e => e.dataset.s === rec.guess);
  pick && pick.classList.add('chosen');
  await wait(600); if (tk !== token) return;
  // 4 기억한다
  setStep(3); tag.className = 'tag';
  if (rec.ok) pick && pick.classList.add('right');
  else { pick && pick.classList.add('wrong'); const t = els.find(e => e.dataset.s === rec.scene); t && t.classList.add('missed'); }
  const v = $('#verdict'); v.querySelector('span').textContent = rec.ok ? '통했다' : '안 통했다'; v.classList.toggle('ok', !!rec.ok); v.classList.add('show');
  const e = {s: rec.scene, m: rec.msg, ok: !!rec.ok, f: from};
  const a = remember(spMem, {...e}); const b = remember(liMem, {...e});
  $('#spShelf').innerHTML = shelfHTML(spMem, from, {look: rec.scene, add: a});
  $('#liShelf').innerHTML = shelfHTML(liMem, to, {look: rec.scene, add: b});
  ctx.done.push(rec); drawSlots(ctx.done); const sl = $('#slots').children[ctx.done.length - 1]; sl && sl.classList.add('fill');
  await wait(1600);
}

function flash(el, html){
  const r = el.getBoundingClientRect(), s = view.getBoundingClientRect();
  const f = document.createElement('div'); f.className = 'flash'; f.innerHTML = html;
  f.style.left = (r.left - s.left + r.width / 2) + 'px'; f.style.top = (r.top - s.top - 34) + 'px'; f.style.transform = 'translateX(-50%)';
  view.appendChild(f); setTimeout(() => f.remove(), 1600 / speed);
}
async function relay(gen, k, M, ctx, tk){
  const end = M && M.islands[k] && M.islands[k].end; if (!end) return;
  setColor(k); setStep(-1);
  const R = $('#relay');
  $('#relaySub').textContent = `${KO(k)} · ${gen}세대 → ${gen + 1}세대`;
  $('#leaving').innerHTML = end.left.map(id => `<div class="agent" data-id="${id}"><span class="av">${id}</span><div class="shelf">${shelfHTML(ctx.mem[id] || [], k)}</div></div>`).join('<div style="height:12px"></div>');
  const pool = end.pool.map(x => toEntry(x, k));
  $('#pool').innerHTML = pool.map((e, j) => `<div class="pc${e.ok ? '' : ' no'}" data-j="${j}"><img src="img/${e.s}.png" alt=""><s>${BODY(e.f) === 'grid' ? '▦' : esc(e.m)}</s></div>`).join('');
  $('#arriving').innerHTML = end.born.map(b => `<div class="agent" data-id="${b.id}"><span class="av">${b.id}<span class="new">새</span></span><div class="shelf">${shelfHTML([], k)}</div></div>`).join('<div style="height:12px"></div>');
  R.classList.add('show');
  await wait(1200); if (tk !== token) return;
  R.querySelectorAll('#leaving .agent').forEach(a => a.classList.add('gone'));
  await wait(1000); if (tk !== token) return;
  for (const b of end.born) {
    const mem = [], mut = Object.fromEntries(b.mut.map(x => [x[0], x]));
    const box = R.querySelector(`#arriving .agent[data-id="${b.id}"] .shelf`);
    for (let p = 0; p < b.pick.length; p++) {
      if (tk !== token) return;
      const j = b.pick[p], src = pool[j], pc = R.querySelector(`.pc[data-j="${j}"]`);
      const e = {...src}; if (mut[p]) { e.m = mut[p][2]; e.mut = true; }
      mem.push(e);
      pc.classList.add('hit', 'taken');
      box.innerHTML = shelfHTML(mem, k, {add: mem.length - 1});
      if (mut[p]) { const c = box.querySelector(`.chip[data-i="${mem.length - 1}"]`); c && flash(c, `${esc(mut[p][1])} → ${esc(mut[p][2])}<small>잘못 옮김</small>`); await wait(900); }
      else await wait(70);
      pc.classList.remove('hit');
    }
    await wait(400);
    R.querySelectorAll('.pc.taken').forEach(x => x.classList.remove('taken'));
  }
  if (tk !== token) return;
  R.querySelectorAll(`#arriving .col[data-s="${scene}"]`).forEach(c => c.classList.add(c.querySelector('.chip') ? 'look' : 'empty-ring'));
  await wait(2800);
}
async function endCard(k, gen, tk){
  const W = $('#wait');
  $('#waitRow').innerHTML = `<a class="pill" href="#/${k}">${KO(k)}으로</a><button class="pill" id="again">다시 보기</button>`;
  $('#again').onclick = () => route.k && go();
  W.classList.add('show');
  if (gen < nowGen) { $('#waitT').textContent = `${gen + 1}세대`; $('#waitP').textContent = '이어서 다음 세대 대화를 봐요'; await wait(2500); if (tk === token) location.hash = `#/${k}/${gen + 1}`; return; }
  $('#waitP').textContent = nextSlot ? `${KO(k)}의 ${nextSlot.gen}세대는 ${fmtMD(nextSlot.t)} ${hourOf(nextSlot.t)}시에 시작해요` : '마지막 세대까지 끝났어요';
  while (tk === token) { $('#waitT').textContent = countdown() || '끝'; await sleep(500); }
}

function buildCtx(gen, k, G, M){
  let talks = k === 'cross' ? ((G && G.cross || {}).talks || []) : ((G && G.islands[k]) || {}).talks || [];
  talks = talks.map(t => ({from: k, to: k, ...t})).filter(t => t.msg);
  const ctx = {gen, done: [], born: {}, mem: {}, ids: [], talks};
  if (k === 'cross') {
    ctx.ids = [...new Set(talks.flatMap(t => [t.sp, t.li]))].sort((a, b) => a - b);
    for (const kk of META.meet || []) { const mm = M && M.islands[kk]; if (mm) for (const [id, arr] of Object.entries(mm.start)) ctx.mem[id] = arr.map(x => toEntry(x, kk)); }
  } else {
    const MI = M && M.islands[k] || {};
    for (const [id, arr] of Object.entries(MI.start || {})) { const mu = new Set((MI.mut || {})[id] || []); ctx.mem[id] = arr.map((x, i) => ({...toEntry(x, k), mut: mu.has(i)})); }
    ctx.born = Object.fromEntries(Object.entries(MI.born || {}).map(([a, b]) => [+a, b]));
    ctx.ids = Object.keys(MI.start || {}).map(Number).sort((a, b) => a - b);
    if (!ctx.ids.length) ctx.ids = [...new Set(talks.flatMap(t => [t.sp, t.li]))].sort((a, b) => a - b);
  }
  return ctx;
}

async function talkView(k, gen, onlyRelay){
  const tk = ++token; hideOverlays(); clearScene(); drawSlots([]);
  const [G, M] = await Promise.all([loadGen(gen), loadMem(gen)]); if (tk !== token) return;
  const ctx = buildCtx(gen, k, G, M);
  drawRoster(ctx.ids, ctx.born, gen); setColor(k);
  if (onlyRelay) {
    for (const r of ctx.talks) { const e = {s: r.scene, m: r.msg, ok: !!r.ok, f: r.from}; remember(ctx.mem[r.sp] || (ctx.mem[r.sp] = []), {...e}); remember(ctx.mem[r.li] || (ctx.mem[r.li] = []), {...e}); }
  } else {
    for (const rec of ctx.talks) { if (tk !== token) return; await play(rec, tk, ctx); }
    if (tk !== token) return;
    const ok = ctx.done.filter(r => r.ok).length;
    $('#sumN').textContent = `${ok}/${ctx.done.length}`; $('#sumP').textContent = `${gen}세대 ${KO(k)}에서 통한 대화`;
    $('#summary').classList.add('show'); await wait(2600); $('#summary').classList.remove('show');
  }
  if (tk !== token) return;
  if (k !== 'cross') await relay(gen, k, M, ctx, tk);
  if (tk !== token) return;
  $('#relay').classList.remove('show');
  await endCard(k, gen, tk);
}

async function liveView(k){
  const tk = ++token; hideOverlays(); clearScene(); drawSlots([]);
  const st = await getJSON('data/state.json');
  const ctx = {gen: (st && st.gen || nowGen) + 1, done: [], born: {}, mem: {}, ids: []};
  for (const kk of ORDER) for (const a of (st && st.islands[kk].agents) || []) { ctx.mem[a.id] = a.memory.map(x => ({s: x.scene, m: x.msg, ok: x.ok, f: x.from || kk})); if (kk === k) { ctx.ids.push(a.id); ctx.born[a.id] = a.born; } }
  ctx.ids.sort((a, b) => a - b);
  const es = new EventSource(`/api/live?island=${k}&n=8`);
  const q = []; let end = false, wake = null;
  es.onmessage = e => { const d = JSON.parse(e.data); if (d.kind === 'done' || d.kind === 'error') { end = true; es.close(); } else if (d.kind === 'result' && d.msg) q.push(d); wake && wake(); };
  es.onerror = () => { end = true; es.close(); wake && wake(); };
  while (tk === token) {
    if (!q.length) { if (end) break; await new Promise(r => wake = r); wake = null; continue; }
    const d = q.shift();
    await play({...d, from: d.from || k, to: d.to || k}, tk, ctx);
  }
  es.close();
}

/* ════════ 길 찾기 ════════ */
function parse(){
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const k = p[0] && (ORDER.includes(p[0]) || p[0] === 'cross') ? p[0] : null;
  const g = p[1] ? Math.min(nowGen, Math.max(1, +p[1] || nowGen)) : null;
  return {k, g, relay: p[2] === 'relay'};
}
function crumb(r){
  const parts = [`<a class="logo" href="#/">오늘의 숲</a>`];
  if (!r.k) parts.push(`<span class="tagline">AI들이 낯선 글자로 말을 만드는 세 섬 · ${nowGen}세대째</span>`);
  if (r.k) parts.push('<span class="sep">›</span>', r.g ? `<a class="lvl" href="#/${r.k === 'cross' ? '' : r.k}" style="--k:${COLOR[r.k]}"><i></i>${KO(r.k)}</a>` : `<span class="here" style="--k:${COLOR[r.k]}"><i></i>${KO(r.k)}</span>`);
  if (r.g) parts.push('<span class="sep">›</span>', `<span class="here" style="--k:${COLOR[r.k]}">${r.g}세대 ${r.relay ? '세대 교체' : '대화'}</span>`);
  $('#crumb').innerHTML = parts.join('');
}
function show(id){ ['vOverview','vIsland','vTalk'].forEach(v => $('#' + v).classList.toggle('on', v === id)); }
function render(){
  route = parse(); crumb(route); $('#tip').classList.remove('show');
  const talk = !!(route.k && route.g);
  $('#speedBtn').hidden = !talk; $('#liveBtn').hidden = !(talk && liveReady && route.k !== 'cross');
  if (!talk) token++;
  if (!route.k) { show('vOverview'); drawOverview(); }
  else if (!route.g) { if (route.k === 'cross') { location.hash = `#/cross/${nowGen}`; return; } show('vIsland'); drawIsland(route.k); }
  else { show('vTalk'); go(); }
}
function go(){ if (liveOn && route.k !== 'cross') liveView(route.k); else talkView(route.k, route.g, route.relay); }
function navigate(){ if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(render); else render(); }

/* ── 버튼 ── */
let liveReady = false;
$('#speedBtn').textContent = speed + '×';
$('#speedBtn').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('#speedBtn').textContent = speed + '×'; };
$('#introBtn').onclick = () => $('#intro').classList.add('open');
$('#introClose').onclick = () => { $('#intro').classList.remove('open'); try { localStorage.setItem('tf-intro', '1'); } catch(e) {} };
$('#intro').onclick = e => { if (e.target.id === 'intro') $('#intro').classList.remove('open'); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#intro').classList.remove('open'); });
let seen = false; try { seen = localStorage.getItem('tf-intro') === '1'; } catch(e) {}
if (!seen && !qs.has('nointro')) $('#intro').classList.add('open');
addEventListener('hashchange', navigate);
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!route.k) drawOverview(); else if (!route.g) drawIsland(route.k); }, 150); });
setInterval(() => { $('#clockT').textContent = countdown(); $('#clockP').textContent = nextSlot ? `${nextSlot.gen}세대 시작까지 · ${fmtMD(nextSlot.t)} ${hourOf(nextSlot.t)}시` : ''; }, 1000);
$('#clockT').textContent = countdown(); $('#clockP').textContent = nextSlot ? `${nextSlot.gen}세대 시작까지 · ${fmtMD(nextSlot.t)} ${hourOf(nextSlot.t)}시` : '';
render();

if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  try { const j = await (await fetch('/api/ping', {cache:'no-store'})).json();
    if (j.key) { liveReady = true; const b = $('#liveBtn'); b.hidden = !(route.k && route.g); b.onclick = () => { liveOn = !liveOn; b.querySelector('span').textContent = liveOn ? '기록 재생으로' : '실시간으로 보기'; go(); }; } } catch(e) {}
}
})();
