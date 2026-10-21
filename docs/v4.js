/* 오늘의 숲 v4
   #/            오늘 — 바로 맞히기(Wordle) → 이 말이 생긴 과정(OWID 재생 막대) → 지금 이 순간 → 오늘의 사전 → 일정
   #/quiz        (발표 QR 호환) 오늘의 맞히기로
   #/talk/k/g    대화 보기 — 4단계 진행 표시, 두 AI의 메모를 양옆에
   #/word/k/s    단어 기록 — 세대별 모양, 말의 수명 막대
   #/notes       실험 노트 */
(async function(){
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
await TF.load();
const {SIDS, NAME, NOW, GENS, ID} = TF, esc = TF.esc;
const COL = {grid:'var(--grid)', line:'var(--line-i)', twin:'var(--twin)', cross:'var(--ink)'};
const HEX = {grid:'#0B8457', line:'#2450D8', twin:'#8A3F9E'};
const mob = () => innerWidth < 860;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let K = 'grid';
const W = (s, row, k = K) => TF.word(k, s, row);
const at = g => Date.parse(GENS[g - 1].at);
const slot = t => { const h = TF.hour(t); if (h >= 19) return `${TF.md(t)} 저녁`; if (h >= 7) return `${TF.md(t)} 아침`; return `${TF.md(t - 864e5)} 저녁`; };
const eul = w => TF.josa(w, '을', '를');
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const pic = (s, size = 28) => `<img src="img/${s}.png" alt="${esc(NAME[s] || '')}" width="${size}" height="${size}">`;
/* 1~N세대 중 첫날 연속으로 돈 세대 (같은 날짜) */
const FIRST_DAY = (() => { let g = 1; while (g < NOW && TF.md(at(g + 1)) === TF.md(at(1))) g++; return g; })();

/* 글자 칸: 그림 섬 3×3, 글자·비교 섬은 한 줄 */
const isGrid = k => TF.body(k === 'cross' ? 'grid' : k) === 'grid';
const qFor = (w, base, k) => isGrid(k) ? base : Math.round(base * Math.min(1, 3 / Math.max(3, [...w].length)));
function tiles(w, base, cls = '', k = K){
  if (w == null) return '<span class="cap">아직 말 없음</span>';
  const ch = [...w], grid = isGrid(k) && ch.length === 9; let n = 0;
  return `<span class="tiles ${cls}" style="--q:${qFor(w, base, grid ? 'grid' : 'line')}px;--cols:${grid ? 3 : ch.length}">${ch.map(c => c === '.' ? '<i></i>' : `<i class="f" style="--n:${n++}">${esc(c)}</i>`).join('')}</span>`;
}
const mini = (w, on, k = K) => tiles(w, 6, 'mini' + (on ? ' hot' : ''), k);
const run = (L, g) => { let r = 0; for (let i = g - 1; i >= 0 && L[i].w === L[g - 1].w; i--) r++; return r; };
const runsOf = L => { const out = []; for (const x of L) { if (!out.length || x.w !== out[out.length - 1].w) out.push({w: x.w, a: x.gen, b: x.gen}); else out[out.length - 1].b = x.gen; } return out; };
const segHTML = (cur, extra = []) => TF.ORDER.concat(extra).map(k => `<button aria-pressed="${k === cur}" data-k="${k}" style="--c:${COL[k]}"><i></i>${k === 'cross' ? '두 섬 사이' : TF.ISL[k]}</button>`).join('');

/* 상단 시계 */
const tick = () => { $('#clock').innerHTML = TF.overdue() ? `<b>${NOW}세대</b><span class="lg"> · </span> 다음 세대 만드는 중` : TF.nextSlot ? `<b>${NOW}세대</b><span class="lg"> · 다음 세대까지</span> ${TF.countdown()}` : `<b>${NOW}세대</b>`; };
tick(); setInterval(tick, 1000);
addEventListener('scroll', () => $('#top').classList.toggle('sc', scrollY > 8), {passive: true});

/* ════════ 오늘 ════════ */
$('#seg').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.k === K) return; K = b.dataset.k; drawToday(); };
let order = [], qi = 0, score = [];
function buildOrder(){
  const ws = SIDS.filter(s => W(s));
  const first = [ID.tree, ID.forest].filter(s => ws.includes(s));   // 나무 → 숲: 첫 두 문제로 합성어를 스스로 발견하게
  order = [...first, ...shuffle(ws.filter(s => !first.includes(s)))]; qi = 0;
}
const scoreHTML = () => score.length ? `<div class="row"><span class="score">${score.slice(-10).map(o => `<i class="${o ? 'ok' : 'no'}"></i>`).join('')}</span><span class="cap">${score.filter(Boolean).length} / ${score.length} 맞힘</span></div>` : '<p class="cap">그림은 말하는 AI만 봐요. 듣는 AI도 당신처럼 이 4장 중에서 골랐어요.</p>';
function ask(){
  const s = order[qi % order.length], w = W(s);
  $('#edition').textContent = `오늘의 말 · ${slot(at(NOW))}`;
  $('#qno').textContent = `${qi + 1}번째`;
  $('#qWord').innerHTML = tiles(w, mob() ? 54 : 104);
  $('#qMeta').innerHTML = `<span class="cap">${TF.ISL[K]} · ${TF.ISL_DESC[K]}</span>`;
  const others = shuffle(SIDS.filter(x => x !== s && W(x) && W(x) !== w)).slice(0, 3);
  const P = $('#picks'); P.className = 'picks';
  P.innerHTML = shuffle([s, ...others]).map(x => `<button class="pk" data-s="${x}"><img src="img/${x}.png" alt=""><span>${NAME[x]}</span></button>`).join('');
  P.onclick = e => { const b = e.target.closest('.pk'); if (b) answer(s, b.dataset.s); };
  $('#res').innerHTML = scoreHTML();
}
async function answer(s, g){
  const ok = s === g; score.push(ok);
  const P = $('#picks'); P.classList.add('done');
  for (const b of P.children) b.classList.add(b.dataset.s === s ? 'ok' : b.dataset.s === g ? 'no' : 'dim');
  $('#qWord .tiles') && $('#qWord .tiles').classList.add('on');
  const L = TF.lineage(K, s), r = run(L, L.length), from = L.length - r + 1;
  $('#qMeta').innerHTML = `<b>${NAME[s]}</b><i></i><span>${from === 1 ? '1세대부터 같은 말' : from === NOW ? '이번 세대에 바뀐 말' : `${from}세대부터 같은 말`}</span>`;
  const comp = TF.compounds(K).find(c => c.a === s && c.op !== '⊃');
  const say = ok ? ['맞았어요.', '정답이에요.', '맞혔어요.'][score.length % 3] : `아쉬워요. 정답은 ‘${NAME[s]}’.`;
  let sub = '';
  if (comp) sub = comp.op === '×' ? `${NAME[comp.parts[0]]} 말을 ${comp.n}번 반복하면 ${NAME[s]}. AI들이 스스로 만든 합성어예요.` : `${comp.parts.map(p => NAME[p]).join(' + ')} → ${NAME[s]}. 두 말을 합쳤어요.`;
  else if (!ok) sub = '듣는 AI도 처음엔 이렇게 틀렸어요. 통한 말만 다음 판에 다시 써요.';
  const G = await TF.loadGen(NOW), T = G ? G.islands[K].talks.filter(x => x.scene === s) : [], t0 = T.find(x => x.ok) || T[0];
  const memo = t0 ? `<div class="memo"><span class="cap">이번 세대 기록 · 이 그림으로 ${T.length}번 대화, ${T.filter(x => x.ok).length}번 통함</span>${tiles(t0.msg, 14, 'sm')}<span>AI ${t0.sp} → AI ${t0.li}</span><em>${t0.ok ? '통함' : '안 통함'}</em></div>` : '';
  $('#res').innerHTML = `<p class="say">${say}${sub ? `<small>${sub}</small>` : ''}</p>${memo}<div class="row"><button class="btn pri" id="nextQ">다음 말</button><button class="btn weak" id="whyQ">‘${NAME[s]}’${TF.josa(NAME[s], '이', '가')} 생긴 과정</button>${scoreHTML().replace('<div class="row">', '<div class="row" style="margin-left:auto">')}</div>`;
  $('#nextQ').onclick = () => { qi++; ask(); };
  $('#whyQ').onclick = () => { setScrub(s); $('#how').scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); setTimeout(() => playFrom(1), 500); };
}

/* 이 말이 생긴 과정 */
let SW = ID.forest, L = [], SG = NOW, timer = null;
const pct = g => NOW > 1 ? (g - 1) / (NOW - 1) * 100 : 100;
function setScrub(s){
  SW = s; L = TF.lineage(K, s);
  $('#howH').innerHTML = `${NOW}세대 동안의 ‘${NAME[s]}’. <span>처음엔 아무 글자나 쓰다가, 서로 통한 말만 남았어요.</span>`;
  $('#howCap').textContent = '막대를 끌거나 재생해 보세요 · 1세대 = 하루 두 번(07·19시) 자동 실행 1번, 그때마다 AI 4명 중 2명이 바뀜';
  $('#endLab').textContent = `${NOW}세대`;
  $('#track').setAttribute('aria-valuemax', NOW);
  $('#band').style.width = `calc(${pct(FIRST_DAY)}% + 6px)`; $('#band').hidden = FIRST_DAY < 3;
  const ch = L.map((r, i) => r.changed ? i + 1 : 0).filter(Boolean);
  $('#ticks').innerHTML = ch.filter(g => g > 1).map(g => `<span class="tick" style="left:${pct(g)}%"></span>`).join('');
  const show = ch.length > 8 ? [ch[0], ...ch.slice(-7)] : ch;
  $('#evs').innerHTML = show.map(g => `<button data-g="${g}">${g}세대 ${mini(L[g - 1].w)}</button>`).join('');
  $('#evs').onclick = e => { const b = e.target.closest('button'); if (b) { stop(); setGen(+b.dataset.g); } };
  spark(); setGen(NOW);
}
function spark(){
  const Wd = Math.round($('#spark').getBoundingClientRect().width) || 342, R0 = Wd - 6; $('#spark').setAttribute('viewBox', `0 -4 ${Wd} 98`);
  const n = NOW, x = g => 6 + (g - 1) / Math.max(1, n - 1) * (R0 - 6), y = v => 76 - Math.max(0, (v - .25) / .75) * 66;
  const v = GENS.map(g => g.islands[K].ok / g.islands[K].talks);
  const d = v.map((p, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(p).toFixed(1)}`).join('');
  $('#spark').innerHTML = `<line x1="6" x2="${R0}" y1="${y(.25)}" y2="${y(.25)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="6" y="${y(.25) - 5}" font-size="11" fill="var(--t3)">찍기 25%</text>
    <path d="${d}" fill="none" stroke="var(--k)" stroke-width="2.5" stroke-linejoin="round"/>
    <line id="spV" y1="4" y2="${y(.25)}" stroke="var(--ink)" stroke-width="1"/><circle id="spC" r="4.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>
    <rect id="spR" height="18" rx="5" fill="var(--ink)"/><text id="spT" font-size="12" font-weight="700" fill="#fff" text-anchor="middle"></text>
    <text x="${R0}" y="90" font-size="11" fill="var(--t3)" text-anchor="end">세대별 서로 알아들은 비율</text>`;
  spark.x = x; spark.y = y; spark.v = v; spark.r = R0;
}
function setGen(g){
  SG = g = Math.max(1, Math.min(NOW, g));
  const r = L[g - 1];
  $('#sWord').innerHTML = tiles(r.w, mob() ? 60 : 88, 'on');
  const rr = run(L, g), changed = r.changed && g > 1;
  const b = $('#sBadge'); b.className = 'badge' + (changed ? ' new' : ''); b.textContent = g === 1 ? '첫 말' : changed ? '이 세대에 바뀜' : `${rr}세대째 그대로`;
  $('#sGen').textContent = `${g}세대`;
  const isl = GENS[g - 1].islands[K];
  $('#sWhen').textContent = `${slot(at(g))}${g <= FIRST_DAY && FIRST_DAY > 2 ? ' (첫날 연속 실행)' : ''} · ${isl.ok}/${isl.talks} 통함`;
  $('#knob').style.left = $('#fillb').style.width = pct(g) + '%';
  $('#track').setAttribute('aria-valuenow', g); $('#track').setAttribute('aria-valuetext', `${g}세대`);
  const X = spark.x(g), Y = spark.y(spark.v[g - 1]);
  $('#spV').setAttribute('x1', X); $('#spV').setAttribute('x2', X); $('#spC').setAttribute('cx', X); $('#spC').setAttribute('cy', Y);
  const T = $('#spT'), R = $('#spR'), lx = Math.max(26, Math.min(spark.r - 20, X)), ly = Math.max(2, Y - 26); T.textContent = Math.round(spark.v[g - 1] * 100) + '%'; T.setAttribute('x', lx); T.setAttribute('y', ly + 13); R.setAttribute('x', lx - 20); R.setAttribute('width', 40); R.setAttribute('y', ly);
  for (const e of $('#evs').children) e.setAttribute('aria-pressed', +e.dataset.g === g);
}
const ICON = {play: '<svg viewBox="0 0 18 18"><path d="M5 3l10 6-10 6z" fill="currentColor"/></svg>', pause: '<svg viewBox="0 0 18 18"><path d="M4 3h3.5v12H4zM10.5 3H14v12h-3.5z" fill="currentColor"/></svg>'};
const stop = () => { clearInterval(timer); timer = null; $('#play').innerHTML = ICON.play; $('#play').setAttribute('aria-label', '재생'); };
function playFrom(g){ stop(); setGen(g); $('#play').innerHTML = ICON.pause; $('#play').setAttribute('aria-label', '멈춤');
  timer = setInterval(() => { if (SG >= NOW) return stop(); setGen(SG + 1); }, 320); }
stop();
$('#play').onclick = () => timer ? stop() : playFrom(SG >= NOW ? 1 : SG);
const tr = $('#track');
const fromX = e => { const r = tr.getBoundingClientRect(); return Math.round(1 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (NOW - 1)); };
tr.onpointerdown = e => { stop(); tr.setPointerCapture(e.pointerId); setGen(fromX(e)); tr.onpointermove = ev => setGen(fromX(ev)); };
tr.onpointerup = () => { tr.onpointermove = null; };
tr.onkeydown = e => { const d = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1}[e.key]; if (d) { e.preventDefault(); stop(); setGen(SG + d); } if (e.key === 'Home') setGen(1); if (e.key === 'End') setGen(NOW); };
let seen = false;
new IntersectionObserver(es => { if (!seen && es[0].isIntersecting && $('#vToday').classList.contains('on')) { seen = true; if (!reduce) playFrom(1); } }, {threshold: .45}).observe($('#how .scrub'));

/* 지금 이 순간 */
let liveT = null;
async function live(){
  clearInterval(liveT);
  const G = await TF.loadGen(NOW); if (!G) return;
  const T = G.islands[K].talks.filter(t => (t.from === K || !t.from) && t.msg);
  $('#liveH').innerHTML = `지금 ${NOW}세대, ${TF.ISL[K]}의 대화. <span>실제 기록을 그대로 다시 틀어요.</span>`;
  $('#tally').textContent = `${T.length}판 중 ${T.filter(t => t.ok).length}판 통함`;
  $('#liveLink').href = `#/talk/${K}/${NOW}`;
  let i = 0;
  const step = () => {
    if (!$('#vToday').classList.contains('on')) return;
    const t = T[i % T.length];
    $('#slots').innerHTML = Array.from({length: Math.max(32, T.length)}, (_, j) => `<i class="${j < (i % T.length) + 1 ? (T[j].ok ? 'ok' : 'no') : ''}${j === i % T.length ? ' cur' : ''}"></i>`).join('');
    $('#lrow').innerHTML = `<div><img src="img/${t.scene}.png" alt="${NAME[t.scene]}"><div class="who">AI ${t.sp}<br>그림을 봄</div></div><span class="ar">→</span><div>${tiles(t.msg, mob() ? 22 : 30)}</div><span class="ar">→</span><div><img src="img/${t.guess}.png" alt="${NAME[t.guess] || ''}"><div class="who">AI ${t.li}<br><span class="v" style="color:${t.ok ? 'var(--k)' : 'var(--t3)'}">${t.ok ? '맞힘' : `틀림 (정답 ${NAME[t.scene]})`}</span></div></div>`;
    i++;
  };
  step(); liveT = setInterval(step, 2600);
}

/* 오늘의 사전 */
function dict(){
  const ws = SIDS.filter(s => W(s));
  $('#dictH').innerHTML = `오늘의 사전 <span>${ws.length}개 · ${slot(at(NOW))}판</span>`;
  $('#dict').innerHTML = ws.map(s => { const Ls = TF.lineage(K, s), r = run(Ls, NOW), nw = r === 1 && NOW > 1;
    return `<a class="de" href="#/word/${K}/${s}"><span class="w">${tiles(W(s), mob() ? 18 : 22)}</span><span class="pc">${pic(s, 32)}</span><b>${NAME[s]}</b><span class="badge${nw ? ' new' : ''}">${nw ? '새 말' : r >= NOW ? '처음부터' : `${r}세대째`}</span></a>`; }).join('');
}
$('#hideSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; for (const x of $('#hideSeg').children) x.setAttribute('aria-pressed', x === b); $('#dict').classList.toggle('hide', b.dataset.v === '1'); };

/* 일정 */
function trip(){
  const t0 = at(1), t1 = TF.END, now = TF.now(), p = t => Math.max(0, Math.min(100, (t - t0) / (t1 - t0) * 100));
  const dd = t => { const d = TF.dday(t); return d > 0 ? `D-${d}` : d === 0 ? '오늘' : '지남'; };
  $('#tripH').innerHTML = `실험 일정 <span>${TF.met ? `두 섬이 만났어요 (${TF.meetGen}세대~)` : `두 섬이 만나기까지 ${dd(TF.MEET)}`}</span>`;
  const m = [[t0, '시작', TF.md(t0)], [TF.MEET, '두 섬 만남', `${TF.md(TF.MEET)} · ${dd(TF.MEET)}`], [t1, '발표', `${TF.md(t1)} · ${dd(t1)}`]];
  $('#trip').innerHTML = `<div class="ln"><i style="width:${p(now)}%"></i><u style="left:${p(now)}%"></u><em style="left:${p(now)}%;transform:translateX(${p(now) > 85 ? -100 : p(now) < 15 ? 0 : -50}%)">지금 ${NOW}세대</em></div>` +
    m.map(([t, a, b], j) => `<div class="m" style="left:${p(t)}%;transform:translateX(${j === 0 ? 0 : j === 2 ? -100 : -50}%);text-align:${j === 0 ? 'left' : j === 2 ? 'right' : 'center'}"><b>${a}</b><span>${b}</span></div>`).join('');
}
let todayInit = false;
function drawToday(){
  document.body.style.setProperty('--k', COL[K]);
  $('#seg').innerHTML = segHTML(K); buildOrder(); ask(); setScrub(W(ID.forest) ? ID.forest : SIDS.find(s => W(s))); live(); dict(); trip();
  todayInit = true;
}

/* ════════ 대화 보기 ════════ */
let talkK = 'grid', talkG = NOW, speed = 1, token = 0;
const wait = ms => sleep(ms / speed);
const toEntry = (x, k) => ({s: x[0], m: x[1], ok: !!x[2], f: x[3] || k});
function setStep(i){ document.querySelectorAll('#steps li').forEach((s, j) => { s.classList.toggle('cur', j === i); s.classList.toggle('done', j < i); }); }
function lineHTML(e, opt = {}){
  return `<div class="ml${opt.use ? ' use' : ''}${e.mut ? ' mut' : ''}${opt.add ? ' pop' : ''}">${tiles(e.m, 12, 'xs', e.f)}<span class="eqs">=</span>${pic(e.s, 26)}<span class="nm">${NAME[e.s]}</span><em class="${e.ok ? '' : 'no'}">${e.ok ? '통함' : '안 통함'}</em></div>`;
}
function spMemoHTML(mem, scene, used){
  const rows = mem.map((e, i) => [e, i]).filter(([e]) => e.s === scene).reverse().slice(0, 4);
  if (!rows.length) return `<div class="ml none">이 그림 메모 없음 → 새로 지어야 함</div>`;
  return rows.map(([e, i]) => lineHTML(e, {use: i === used})).join('');
}
function liMemoHTML(mem, msg){
  let rows = mem.filter(e => e.m === msg).reverse().slice(0, 3), same = true;
  if (!rows.length) { // 똑같은 말이 없으면 글자가 가장 많이 겹치는 줄
    const gs = TF.glyphSet(msg), sc = e => { const o = TF.glyphSet(e.m); let n = 0; for (const c of gs) if (o.has(c)) n++; return n; };
    rows = mem.filter(e => e.ok && sc(e) > 0).sort((a, b) => sc(b) - sc(a)).slice(0, 3); same = false; }
  $('#liCap').textContent = same ? `메모 · 이 말이 쓰였던 줄` : rows.length ? '메모 · 똑같은 말은 없음 → 비슷한 줄로 추측' : '메모 · 처음 듣는 말';
  return rows.length ? rows.map((e, i) => lineHTML(e, {use: i === 0})).join('') : '<div class="ml none">비슷한 줄도 없음 → 찍기</div>';
}
let SLOTS = 32;   // 섬 안 대화 32판, 두 섬 사이는 그 세대에 실제로 한 판 수
function drawSlots(list){
  $('#tSlots').innerHTML = Array.from({length: SLOTS}, (_, i) => { const r = list[i]; return `<i class="${r ? (r.ok ? 'ok' : 'no') : (i === list.length ? 'cur' : '')}"></i>`; }).join('');
  const ok = list.filter(r => r.ok).length;
  $('#tTally').textContent = list.length ? `${list.length} / ${SLOTS} · 통함 ${ok}` : '';
}
function clearStage(){
  $('#seen').classList.add('hide'); $('#msg').innerHTML = ''; $('#msgCap').innerHTML = '&nbsp;';
  $('#tag').className = 'tagx'; $('#verdict').className = 'verdict'; $('#verdict').textContent = '';
  $('#cands').innerHTML = '<div class="cand back"></div>'.repeat(4);
  $('#spLines').innerHTML = ''; $('#liLines').innerHTML = ''; setStep(-1);
}
const avHTML = (id, born, gen) => `${id}`;
const isNew = (id, ctx) => ctx.gen > 1 && ctx.born && ctx.born[id] === ctx.gen;
async function play(rec, tk, ctx){
  const from = rec.from;
  $('#vTalk').style.setProperty('--k', COL[from]);
  const spMem = ctx.mem[rec.sp] || (ctx.mem[rec.sp] = []), liMem = ctx.mem[rec.li] || (ctx.mem[rec.li] = []);
  clearStage();
  $('#spAv').innerHTML = avHTML(rec.sp); $('#liAv').innerHTML = avHTML(rec.li); $('#spNew').hidden = !isNew(rec.sp, ctx); $('#liNew').hidden = !isNew(rec.li, ctx);
  $('#spCap').textContent = `AI ${rec.sp}의 메모 · 이 그림(${NAME[rec.scene]})에 쓴 줄`;
  // 1 본다
  setStep(0); $('#seenImg').src = `img/${rec.scene}.png`;
  await wait(200); if (tk !== token) return;
  $('#seen').classList.remove('hide');
  $('#spLines').innerHTML = spMemoHTML(spMem, rec.scene);
  await wait(1100); if (tk !== token) return;
  // 2 말한다
  setStep(1);
  const used = [...spMem.keys()].reverse().find(i => spMem[i].s === rec.scene && spMem[i].m === rec.msg);
  $('#spLines').innerHTML = spMemoHTML(spMem, rec.scene, used);
  const tag = $('#tag'); tag.textContent = used !== undefined ? '메모에서 꺼냄' : '메모에 없음 → 새로 지음'; tag.className = 'tagx show' + (used !== undefined ? '' : ' new');
  $('#msgCap').textContent = `AI ${rec.sp}이 쓴 말`;
  const ch = [...rec.msg], grid = isGrid(from) && ch.length === 9, q = mob() ? 40 : 64;
  $('#msg').innerHTML = tiles(grid ? '.........' : ch.map(() => '.').join(''), q, '', from);
  const cells = $('#msg').querySelectorAll('i');
  for (let i = 0; i < ch.length; i++) { if (tk !== token) return; if (ch[i] !== '.') { cells[i].textContent = ch[i]; cells[i].classList.add('f', 'pop'); await wait(grid ? 110 : 200); } }
  await wait(700); if (tk !== token) return;
  // 3 고른다
  setStep(2); tag.className = 'tagx';
  $('#liLines').innerHTML = liMemoHTML(liMem, rec.msg);
  $('#cands').innerHTML = (rec.cands || []).map(c => `<div class="cand" data-s="${c}"><img src="img/${c}.png" alt=""><span>${NAME[c]}</span></div>`).join('');
  const els = [...$('#cands').children];
  await wait(500); if (tk !== token) return;
  for (let r = 0; r < 2; r++) for (const e of els) { if (tk !== token) return; e.classList.add('scan'); await wait(110); e.classList.remove('scan'); }
  const pick = els.find(e => e.dataset.s === rec.guess); pick && pick.classList.add('chosen');
  await wait(600); if (tk !== token) return;
  // 4 메모한다
  setStep(3);
  if (rec.ok) pick && pick.classList.add('right'); else { pick && pick.classList.add('wrong'); const t = els.find(e => e.dataset.s === rec.scene); t && t.classList.add('missed'); }
  els.forEach(e => { if (!e.classList.contains('right') && !e.classList.contains('wrong') && !e.classList.contains('missed')) e.classList.add('dim'); });
  const v = $('#verdict'); v.textContent = rec.ok ? `맞힘 · ${NAME[rec.scene]}` : `틀림 · 정답 ${NAME[rec.scene]}`; v.className = 'verdict show' + (rec.ok ? ' ok' : '');
  const e = {s: rec.scene, m: rec.msg, ok: !!rec.ok, f: from};
  for (const mm of [spMem, liMem]) { mm.push({...e}); if (mm.length > 30) mm.shift(); }
  $('#spLines').innerHTML = lineHTML(e, {add: true}) + spMemoHTML(spMem.slice(0, -1), rec.scene).replace(/ml none[^<]*<\/div>/, '');
  $('#liLines').insertAdjacentHTML('afterbegin', lineHTML(e, {add: true}));
  ctx.done.push(rec); drawSlots(ctx.done);
  await wait(1700);
}
function overlay(html){ $('#overBox').innerHTML = html; $('#over').classList.add('show'); }
function hideOverlay(){ $('#over').classList.remove('show'); }
async function talkView(){
  const k = talkK, gen = talkG, tk = ++token;
  hideOverlay(); clearStage(); drawSlots([]);
  $('#tGenLab').textContent = `${gen}세대 ${k === 'cross' ? '두 섬 사이 ' : ''}대화`;
  const [G, M] = await Promise.all([TF.loadGen(gen), TF.loadMem(gen)]); if (tk !== token) return;
  let talks = k === 'cross' ? ((G && G.cross || {}).talks || []) : ((G && G.islands[k]) || {}).talks || [];
  talks = talks.map(t => ({from: k, to: k, ...t})).filter(t => t.msg);
  SLOTS = k === 'cross' ? talks.length || 16 : 32; drawSlots([]);
  const ctx = {gen, done: [], born: {}, mem: {}};
  const fill = kk => { const MI = M && M.islands[kk]; if (!MI) return; for (const [id, arr] of Object.entries(MI.start)) { const mu = new Set((MI.mut || {})[id] || []); ctx.mem[id] = arr.map((x, i) => ({...toEntry(x, kk), mut: mu.has(i)})); } Object.assign(ctx.born, Object.fromEntries(Object.entries(MI.born || {}).map(([a, b]) => [+a, b]))); };
  if (k === 'cross') (TF.META.meet || []).forEach(fill); else fill(k);
  for (const rec of talks) { if (tk !== token) return; await play(rec, tk, ctx); }
  if (tk !== token) return;
  const ok = ctx.done.filter(r => r.ok).length;
  overlay(`<b class="bign">${ok} / ${ctx.done.length}</b><p>${gen}세대 · ${k === 'cross' ? '두 섬 사이' : TF.ISL[k]} · 통한 판</p>`);
  await wait(2600); if (tk !== token) return;
  const end = k !== 'cross' && M && M.islands[k] && M.islands[k].end;
  if (end) {
    const forestHas = b => b.pick.some(j => end.pool[j] && end.pool[j][0] === ID.forest);
    const mutHTML = b => b.mut.slice(0, 2).map(([p, a, z]) => `<div class="mutl">${tiles(a, 11, 'xs', k)}<span>→</span>${tiles(z, 11, 'xs', k)}<span class="badge">잘못 옮김</span></div>`).join('') || '<span class="cap">잘못 옮긴 줄 없음</span>';
    overlay(`<h3>세대 교체: ${gen} → ${gen + 1}세대</h3><div class="swap"><div><p class="cap">떠나는 AI · 메모도 같이 사라짐</p><div class="row">${end.left.map(i => `<span class="av gone">${i}</span>`).join('')}</div></div><span class="ar">→</span><div><p class="cap">새로 온 AI · 최근 64판 중 30줄 물려받음</p>${end.born.map(b => `<div class="nb"><div class="row"><span class="av">${b.id}</span><span class="cap">‘숲’ 메모 ${forestHas(b) ? '받음' : '<b class="ink">못 받음</b>'}</span></div>${mutHTML(b)}</div>`).join('')}</div></div>`);
    await wait(7000); if (tk !== token) return;
  }
  if (gen < NOW) { talkG = gen + 1; location.hash = `#/talk/${k}/${talkG}`; return; }
  overlay(`<b class="bign" id="cdn">${TF.overdue() ? "만드는 중" : TF.countdown()}</b><p>${TF.nextSlot ? `다음 ${TF.nextSlot.gen}세대 · ${TF.md(TF.nextSlot.t)} ${TF.hour(TF.nextSlot.t)}시` : ''}</p><div class="row" style="justify-content:center"><button class="btn pri" id="again">다시 보기</button><a class="btn weak" href="#/word/${k === 'cross' ? 'grid' : k}/${ID.forest}">‘숲’ 기록 보기</a></div>`);
  $('#again').onclick = () => talkView();
  while (tk === token) { const el = $('#cdn'); if (el) el.textContent = TF.overdue() ? "만드는 중" : TF.countdown(); await sleep(500); }
}
function drawTalk(){
  const extra = GENS.some(g => g.cross) ? ['cross'] : [];
  $('#talkSeg').innerHTML = segHTML(talkK, extra);
  $('#genSel').innerHTML = [...GENS].reverse().filter(g => talkK !== 'cross' || g.cross).map(g => `<option value="${g.gen}"${g.gen === talkG ? ' selected' : ''}>${g.gen}세대 · ${slot(Date.parse(g.at))}${g.gen === NOW ? ' (최신)' : ''}</option>`).join('');
  $('#speedBtn').textContent = speed + '×';
  talkView();
}
$('#talkSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; talkK = b.dataset.k; if (talkK === 'cross') talkG = NOW; location.hash = `#/talk/${talkK}/${talkG}`; };
$('#genSel').onchange = e => { talkG = +e.target.value; location.hash = `#/talk/${talkK}/${talkG}`; };
$('#speedBtn').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('#speedBtn').textContent = speed + '×'; };

/* ════════ 단어 기록 ════════ */
let wordK = 'grid', wordS = ID.forest;
function drawWord(){
  document.body.style.setProperty('--k', COL[wordK]);
  $('#wordSeg').innerHTML = segHTML(wordK);
  $('#wordH').innerHTML = `‘${NAME[wordS]}’의 기록. <span>1세대부터 이 그림을 부른 말. 바뀐 순간만 진하게.</span>`;
  $('#wpick').innerHTML = SIDS.map(s => `<a href="#/word/${wordK}/${s}" aria-current="${s === wordS}">${pic(s, 24)}${NAME[s]}</a>`).join('');
  const lin = TF.lineage(wordK, wordS), runs = runsOf(lin), last = runs[runs.length - 1], r = run(lin, NOW);
  const cs = TF.compounds(wordK).filter(c => c.op !== '⊃' && (c.a === wordS || c.parts.includes(wordS)));
  const eq = c => `<div class="eq">${c.parts.map(p => `<span class="ep">${tiles(W(p, undefined, wordK), 14, '', wordK)}<small>${NAME[p]}</small></span>`).join('<b>+</b>')}${c.op === '×' ? `<b>× ${c.n}</b>` : ''}<b>=</b><span class="ep">${tiles(W(c.a, undefined, wordK), 14, '', wordK)}<small>${NAME[c.a]}</small></span><span class="cap">${c.since}세대~</span></div>`;
  $('#wnow').innerHTML = `<div class="row" style="justify-content:space-between;width:100%"><span class="cap">${NOW}세대 · ${slot(at(NOW))}</span><span class="badge${r === 1 && NOW > 1 ? ' new' : ''}">${r === 1 && NOW > 1 ? '이번 세대에 바뀜' : r >= NOW ? '처음부터 같은 말' : `${r}세대째 그대로`}</span></div>
    ${tiles(W(wordS, undefined, wordK), mob() ? 64 : 92, 'on', wordK)}
    <div class="meta"><b>${NAME[wordS]}</b><i></i><span>${NOW}세대 동안 ${runs.length - 1}번 바뀜</span></div>${cs.map(eq).join('')}`;
  $('#strip').style.setProperty('--n', lin.length); $('#strip').innerHTML = lin.map((x, i) => `<span class="sc${x.changed ? ' ch' : ''}">${x.w ? mini(x.w, x.changed, wordK) : ''}<small>${x.gen}</small></span>`).join('');
  $('#runs').innerHTML = runs.map(rn => `<div class="rn"><span class="w">${rn.w ? tiles(rn.w, 10, '', wordK) : '·'}</span><b>${rn.a === rn.b ? rn.a + '세대' : rn.a + '–' + rn.b + '세대'}</b><span class="life"><i style="left:${(rn.a - 1) / NOW * 100}%;width:${Math.max(1.6, (rn.b - rn.a + 1) / NOW * 100)}%"${rn === last ? ' class="now"' : ''}></i></span><span class="cap">${rn.b - rn.a + 1}세대 동안</span></div>`).join('');
  const Wd = Math.round($('#wspark').getBoundingClientRect().width) || 1000, H = 140, x = i => 8 + i / Math.max(1, NOW - 1) * (Wd - 16), y = p => H - 24 - Math.max(0, (p - .25) / .75) * (H - 40);
  const v = GENS.map(g => g.islands[wordK].ok / g.islands[wordK].talks);
  $('#wspark').setAttribute('viewBox', `0 0 ${Wd} ${H}`);
  $('#wspark').innerHTML = `<line x1="8" x2="${Wd - 8}" y1="${y(.25)}" y2="${y(.25)}" stroke="var(--line)" stroke-dasharray="3 4"/>` + lin.filter(x2 => x2.changed && x2.gen > 1).map(x2 => `<line x1="${x(x2.gen - 1)}" x2="${x(x2.gen - 1)}" y1="10" y2="${y(.25)}" stroke="var(--line)"/>`).join('') + `<path d="${v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('')}" fill="none" stroke="var(--k)" stroke-width="2.5" stroke-linejoin="round"/>`;
  $('#wsparkCap').textContent = `세로 선 = ‘${NAME[wordS]}’${TF.josa(NAME[wordS], '이', '가')} 바뀐 세대 · 점선 = 찍기 25% · 1세대 ${GENS[0].islands[wordK].ok}/32 → ${NOW}세대 ${TF.LAST.islands[wordK].ok}/32`;
}
$('#wordSeg').onclick = e => { const b = e.target.closest('button'); if (b) location.hash = `#/word/${b.dataset.k}/${wordS}`; };

/* ════════ 실험 노트 ════════ */
async function drawNotes(){
  document.body.style.setProperty('--k', COL.grid);
  $('#notesSub').textContent = `규칙 3개로 시작해 ${NOW}세대 동안 생긴 것, 그리고 이 실험이 말할 수 없는 것.`;
  // 세대 계단
  TF.relay('grid', 4).then(rows => {
    const ids = [...new Set(rows.flatMap(r => r.ids))].sort((a, b) => a - b);
    $('#relay').innerHTML = `<div class="rl hd"><span></span><span class="cap">이 섬의 AI 4명 (번호)</span><span class="cap" style="text-align:center">그때의 ‘숲’</span></div>` + rows.map(r => `<div class="rl${r.next ? ' next' : ''}"><span><b>${r.gen}세대</b><small>${r.at ? slot(r.at) : ''}${r.next ? ' · 다음' : ''}</small></span><span class="ids" style="--n:${ids.length}">${ids.map(id => { if (!r.ids.includes(id)) return '<i></i>'; const nw = r.born[id] === r.gen && r !== rows[0], out = r.end && r.end.left.includes(id); return `<i><u class="${nw ? 'nw' : ''}${out ? ' out' : ''}">${id}</u></i>`; }).join('')}</span><span class="wd">${r.word ? tiles(r.word, 14, '', 'grid') : '<b class="q">?</b>'}</span></div>`).join('');
    const first = rows[0]; $('#relayPunch').textContent = first ? `${first.gen}세대의 AI(${first.ids[0]}–${first.ids[first.ids.length - 1]})는 이제 한 명도 없음. 그래도 ‘숲’은 같은 말로 이어져요.` : '';
  });
  // 세 섬 곡선
  { const svg = $('#chart'), Wd = Math.round(svg.getBoundingClientRect().width) || 1060, H = mob() ? 240 : 300, last = Math.max(NOW, TF.meetGen || 0) + 1, labW = mob() ? 0 : 110;
    const x = g => 40 + (g - 1) / (last - 1) * (Wd - 50 - labW), y = p => H - 30 - p * (H - 50);
    let h = '';
    for (const p of [.5, .75, 1]) h += `<line x1="40" x2="${x(last)}" y1="${y(p)}" y2="${y(p)}" stroke="var(--fill)"/><text x="0" y="${y(p) + 4}" font-size="12" fill="var(--t3)">${p * 100}%</text>`;
    h += `<line x1="40" x2="${x(last)}" y1="${y(.25)}" y2="${y(.25)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${x(Math.min(NOW, FIRST_DAY + 1))}" y="${y(.25) + 16}" font-size="12" fill="var(--t3)">찍기 25%</text>`;
    if (FIRST_DAY > 2) h += `<rect x="${x(1)}" y="20" width="${x(FIRST_DAY) - x(1)}" height="${y(0) - 20}" fill="var(--ink)" fill-opacity=".035"/><text x="${x(1) + 6}" y="36" font-size="12" fill="var(--t3)">첫날 연속 실행 1–${FIRST_DAY}</text>`;
    if (TF.meetGen) h += `<line x1="${x(TF.meetGen)}" x2="${x(TF.meetGen)}" y1="20" y2="${y(0)}" stroke="var(--ink)" stroke-dasharray="4 4"/><text x="${x(TF.meetGen)}" y="14" font-size="12" fill="var(--ink)" text-anchor="middle">만남 · ${TF.meetGen}세대 (${TF.md(TF.MEET)})</text>`;
    for (const k of ['twin', 'line', 'grid']) h += `<path d="${GENS.map((g, i) => `${i ? 'L' : 'M'}${x(g.gen).toFixed(1)},${y(g.islands[k].ok / g.islands[k].talks).toFixed(1)}`).join('')}" fill="none" stroke="${HEX[k]}" stroke-width="${k === 'grid' ? 3 : 2}" stroke-linejoin="round"/>`;
    if (GENS.some(g => g.cross)) h += `<path d="${GENS.filter(g => g.cross).map((g, i) => `${i ? 'L' : 'M'}${x(g.gen).toFixed(1)},${y(g.cross.ok / g.cross.talks).toFixed(1)}`).join('')}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-dasharray="1 0"/>`;
    { const cr = GENS.filter(g => g.cross); for (const g of cr) h += `<circle cx="${x(g.gen)}" cy="${y(g.cross.ok / g.cross.talks)}" r="5" fill="var(--ink)"/>`;
      const lc = cr[cr.length - 1]; if (lc) h += `<text x="${x(lc.gen) - 10}" y="${y(lc.cross.ok / lc.cross.talks) + 4}" font-size="13" font-weight="700" fill="var(--ink)" text-anchor="end">두 섬 사이 ${Math.round(lc.cross.ok / lc.cross.talks * 100)}%</text>`; }
    const ends = TF.ORDER.map(k => [k, TF.LAST.islands[k].ok / TF.LAST.islands[k].talks]).sort((a, b) => b[1] - a[1]);
    if (!mob()) { let py = -99; for (const [k, v] of ends) { let ly = Math.max(y(v) + 4, py + 18); py = ly; h += `<text x="${Wd}" y="${ly}" font-size="14" font-weight="700" fill="${HEX[k]}" text-anchor="end">${TF.ISL[k]} ${Math.round(v * 100)}%</text>`; } }
    for (const g of [1, Math.round(NOW / 2), NOW]) h += `<text x="${x(g)}" y="${H - 8}" font-size="12" fill="var(--t3)" text-anchor="middle">${g}세대</text>`;
    svg.setAttribute('viewBox', `0 0 ${Wd} ${H}`); svg.innerHTML = h;
    if (mob()) svg.insertAdjacentHTML('afterend', `<div class="legend">${ends.map(([k, v]) => `<span style="--c:${COL[k]}"><i></i>${TF.ISL[k]} ${Math.round(v * 100)}%</span>`).join('')}</div>`); }
  // 합성
  const SP = TF.split('grid'), all = TF.compounds('grid').filter(c => c.op !== '⊃' && (!SP || c.a !== SP.b));
  const f0 = all.find(c => c.a === ID.forest), rest = all.filter(c => c !== f0), byS = (a, b) => a.since - b.since;
  const cs = [f0, rest.filter(c => c.op === '×').sort(byS)[0], rest.filter(c => c.op === '+').sort(byS)[0]].filter(Boolean);
  const ep = s => `<span class="ep">${tiles(W(s, undefined, 'grid'), 16, '', 'grid')}<small>${NAME[s]}</small></span>`;
  $('#eqs').innerHTML = cs.length ? cs.map(c => `<div class="eq">${c.parts.map(ep).join('<b>+</b>')}${c.op === '×' ? `<b>× ${c.n}</b>` : ''}<b>=</b>${ep(c.a)}<span class="cap">${c.since}세대~</span></div>`).join('') : '<p class="cap">이번 세대엔 합친 말이 안 보임</p>';
  if (SP) { const lane = (s, rs) => { const pk = rs.length > 2 ? [rs[0], rs[rs.length - 1]] : rs, more = rs.length - pk.length;
      return `<div class="eq lane"><span class="ep">${pic(s, 36)}<small>${NAME[s]}</small></span>${pk.map((r2, i) => `${i ? `<b>→</b>${more ? `<span class="cap">${more}번 더 바뀜</span><b>→</b>` : ''}` : '<b>→</b>'}<span class="ep">${tiles(r2.w, 16, '', 'grid')}<small>${r2.a === r2.b ? r2.a + '세대' : r2.b === NOW ? r2.a + '세대~' : r2.a + '–' + r2.b + '세대'}</small></span>`).join('')}</div>`; };
    $('#split').innerHTML = lane(SP.a, SP.ra) + lane(SP.b, SP.rb) + `<p class="cap">${NAME[SP.a]}: ${SP.from}칸 → ${SP.to}칸 (${SP.shrank}세대) · 긴 말은 ${NAME[SP.b]}${TF.josa(NAME[SP.b], '이', '가')} 가져감 (${SP.took}세대)</p>`; }
  else { $('#splitH').textContent = '짧아짐'; $('#split').innerHTML = TF.lengths('grid').map(r2 => `<div class="eq"><b class="ink">${{3: '자주 나오는 그림', 2: '보통', 1: '가끔 나오는 그림'}[r2.t]}</b><span class="cap">${r2.first.toFixed(1)}칸 → ${r2.last.toFixed(1)}칸</span></div>`).join(''); }
  // 섬 / 만남
  const MT = TF.meeting(), F = ID.forest;
  if (MT) {
    $('#islH').innerHTML = `두 섬의 만남 (${MT.mg}세대~). <span>섞이면 말이 어떻게 되나.</span>`;
    $('#islCap').textContent = '글자 섬 · 비교 섬: 조건이 같음 → 둘의 차이 = 만남의 영향';
    const pc = v => Math.round(v * 100);
    $('#isls').innerHTML = `<div class="meet"><div class="card mstat"><p class="cap">두 섬 사이 대화 성공률</p>${MT.days > 1 ? `<b class="bign">${pc(MT.first)}% <i>→</i> ${pc(MT.recent)}%</b><p class="cap">만난 날 → 최근 3세대 평균 · ${MT.days}세대째</p>` : `<b class="bign">${pc(MT.first)}%</b><p class="cap">만난 첫 세대 · ${TF.LAST.cross.talks}판 중 ${TF.LAST.cross.ok}판 통함 (찍기 25%)</p>`}</div>` +
      TF.ORDER.map(k => { const r2 = MT.isl[k], met = (TF.META.meet || []).includes(k); return `<div class="card isl" style="--c:${COL[k]}"><div class="ih"><i></i><b>${TF.ISL[k]}</b><span class="cap">${met ? '만남' : '만남 없음 (기준)'}</span></div><div class="box">${tiles(W(F, undefined, k), isGrid(k) ? 30 : 48, 'on', k)}</div><div class="kv"><span>다른 섬 글자 섞인 말</span><b>${pc(r2.borrow)}%</b></div><div class="kv"><span>만난 뒤 바뀐 단어</span><b>${r2.changed} / ${r2.total}</b></div><div class="fg">${r2.foreign.length ? r2.foreign.slice(0, 8).map(c => `<span>${esc(c)}</span>`).join('') : '<span class="cap">빌린 글자 없음</span>'}</div></div>`; }).join('') + `</div>`;
  } else {
    $('#islH').innerHTML = `섬 3개, 같은 조건, 다른 말. <span>같은 AI·같은 규칙인데 ‘숲’이 섬마다 달라요.</span>`;
    const dd = TF.dday(TF.MEET);
    $('#islCap').textContent = `${TF.md(TF.MEET)}${dd > 0 ? `(D-${dd})` : ''} 글자 섬과 그림 섬이 처음 만남. 비교 섬은 끝까지 만나지 않음 → 만남의 영향을 견주는 기준`;
    $('#isls').innerHTML = `<div class="isl3">${TF.ORDER.map(k => { const w = W(F, undefined, k), met = (TF.META.meet || []).includes(k); return `<div class="card isl" style="--c:${COL[k]}"><div class="ih"><i></i><b>${TF.ISL[k]}</b><span class="cap" style="color:${met ? 'var(--c)' : ''}">${met ? `${TF.md(TF.MEET)} 만남` : '만남 없음 (기준)'}</span></div><div class="box">${tiles(w, isGrid(k) ? 36 : 56, 'on', k)}</div><b>‘숲’ · ${TF.scriptsIn(w).map(x2 => TF.SCRIPT_KO[x2]).join('·')}</b><span class="cap">${TF.ISL_DESC[k]}</span></div>`; }).join('')}</div>`;
  }
  // 새어 나온 말
  { const g = W(ID.mountain, undefined, 'grid'), sea = W(ID.sea, undefined, 'grid'), tm = W(ID.mountain, undefined, 'twin'), lm = W(ID.mountain, undefined, 'line'), bits = [];
    if (g && g.includes('ㅅ')) bits.push('산 = ㅅ'); if (sea && sea.includes('ㅂ')) bits.push('바다 = ㅂ');
    let t = bits.length ? `${bits.join(', ')} (한국어 첫소리)` : '';
    if ((tm && tm.startsWith('ο')) || (lm && lm.startsWith('ο'))) t += `${t ? ' · ' : ''}${lm && lm.startsWith('ο') ? '글자 섬' : '비교 섬'} 산 = ο (그리스어 όρος)`;
    $('#leak').textContent = (t || '모양이 닮은 글자부터 고름') + '. 글자도 아는 문자(한글·그리스 문자)부터 고름.'; }
  // 메모가 없으면
  const Cc = await TF.loadControl(); const CG = (Cc && GENS.find(x2 => x2.gen === Cc.gen)) || TF.LAST;
  $('#ctrl').innerHTML = TF.ORDER.map(k => { const c = Cc && Cc.islands && Cc.islands[k], a = c ? Math.round(c.ok / c.talks * 100) : null, b = Math.round(CG.islands[k].ok / CG.islands[k].talks * 100);
    return `<div class="cb" style="--c:${COL[k]}"><div class="row" style="justify-content:space-between"><b>${TF.ISL[k]}</b><span class="cap">${a == null ? '측정 중' : `메모 없음 ${a}% → 30줄 ${b}%`}</span></div>${a == null ? '' : `<span class="bt"><i class="m" style="width:${a}%"></i></span>`}<span class="bt"><i style="width:${b}%"></i></span></div>`; }).join('') + `<p class="cap">같은 AI·같은 규칙에서 메모만 지우고 섬마다 32판${Cc && Cc.gen ? ` (${Cc.gen}세대 기준)` : ''} · 찍기 25%</p>`;
}

/* ════════ 길 찾기 ════════ */
function route(){
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean), v = p[0] || '';
  token++;
  const map = {'': 'vToday', quiz: 'vToday', talk: 'vTalk', word: 'vWord', notes: 'vNotes'}, id = map[v] || 'vToday';
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
  const navKey = id === 'vTalk' ? '#/talk' : id === 'vNotes' ? '#/notes' : '#/';
  document.querySelectorAll('#nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === navKey));
  if (id === 'vToday') { if (!todayInit) drawToday(); else document.body.style.setProperty('--k', COL[K]); if (v === 'quiz') $('#quiz').scrollIntoView(); else scrollTo(0, 0); }
  else scrollTo(0, 0);
  if (id === 'vTalk') { if (p[1] && (TF.ORDER.includes(p[1]) || p[1] === 'cross')) talkK = p[1]; if (p[2]) talkG = Math.max(1, Math.min(NOW, +p[2] || NOW)); drawTalk(); }
  if (id === 'vWord') { if (p[1] && TF.ORDER.includes(p[1])) wordK = p[1]; if (p[2] && SIDS.includes(p[2])) wordS = p[2]; drawWord(); }
  if (id === 'vNotes') drawNotes();
}
addEventListener('hashchange', route);
route();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if ($('#vToday').classList.contains('on')) { spark(); setGen(SG); } }, 150); });
})();
