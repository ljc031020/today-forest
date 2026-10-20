/* 오늘의 숲 v4 시안 — 첫 화면에서 바로 맞혀 보고(Wordle), 그 말이 생긴 과정을 끌어 보는(Our World in Data) 흐름 */
(async function(){
const $ = s => document.querySelector(s);
await TF.load();
const {SIDS, NAME, NOW, GENS} = TF;
const COL = {grid:'var(--grid)', line:'var(--line-i)', twin:'var(--twin)'};
const mob = () => innerWidth < 860;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let K = 'grid';
const W = (s, row) => TF.word(K, s, row);
const at = g => Date.parse(GENS[g - 1].at);
const slot = t => { const h = TF.hour(t); if (h >= 19) return `${TF.md(t)} 저녁`; if (h >= 7) return `${TF.md(t)} 아침`; return `${TF.md(t - 864e5)} 저녁`; };
const eul = w => TF.josa(w, '을', '를');
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

/* 글자 칸: 그림 섬 3×3, 글자·비교 섬은 한 줄 (같은 칸 언어로 두 방식의 차이가 보이게) */
const qFor = (w, base) => TF.body(K) === 'grid' ? base : Math.round(base * Math.min(1, 3 / Math.max(3, [...w].length)));
function tiles(w, base, cls = ''){
  if (w == null) return '<span class="cap">아직 말 없음</span>';
  const ch = [...w], grid = TF.body(K) === 'grid'; let n = 0;
  return `<span class="tiles ${cls}" style="--q:${qFor(w, base)}px;--cols:${grid ? 3 : ch.length}">${ch.map(c => c === '.' ? '<i></i>' : `<i class="f" style="--n:${n++}">${TF.esc(c)}</i>`).join('')}</span>`;
}
const run = (L, g) => { let r = 0; for (let i = g - 1; i >= 0 && L[i].w === L[g - 1].w; i--) r++; return r; };

/* 상단 시계 */
const tick = () => { $('#clock').innerHTML = `<b>${NOW}세대</b> · 다음 세대까지 ${TF.countdown()}`; };
tick(); setInterval(tick, 1000);
addEventListener('scroll', () => $('#top').classList.toggle('sc', scrollY > 8), {passive: true});

/* 섬 고르기 */
function seg(){
  $('#seg').innerHTML = TF.ORDER.map(k => `<button aria-pressed="${k === K}" data-k="${k}" style="--c:${COL[k]}"><i></i>${TF.ISL[k]}</button>`).join('');
}
$('#seg').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.k === K) return; K = b.dataset.k; all(); };

/* 1. 오늘의 말 */
let order = [], qi = 0, score = [];
function buildOrder(){
  const ws = SIDS.filter(s => W(s));
  const first = ['q8', 'r9'].filter(s => ws.includes(s));   // 나무 → 숲: 첫 두 문제로 합성어를 스스로 발견하게
  order = [...first, ...shuffle(ws.filter(s => !first.includes(s)))]; qi = 0;
}
const scoreHTML = () => score.length ? `<div class="row"><span class="score">${score.slice(-10).map(o => `<i class="${o ? 'ok' : 'no'}"></i>`).join('')}</span><span class="cap">${score.filter(Boolean).length} / ${score.length} 맞힘</span></div>` : '<p class="cap">그림은 말하는 AI만 봐요. 듣는 AI도 당신처럼 이 4장 중에서 골랐어요.</p>';
function ask(){
  const s = order[qi % order.length], w = W(s);
  $('#edition').textContent = `오늘의 말 · ${slot(at(NOW))}`;
  $('#qno').textContent = `${qi + 1}번째`;
  $('#qWord').innerHTML = tiles(w, mob() ? 54 : 104);
  $('#qMeta').innerHTML = `<span class="cap">${TF.ISL[K]} · ${TF.ISL_DESC[K]}</span>`;
  $('#ask').textContent = '이 말은 무슨 그림일까요?';
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
  $('#qMeta').innerHTML = `<b>${NAME[s]}</b><i></i><span>${from === 1 ? '1세대부터 같은 말' : `${from}세대부터 같은 말`}</span>`;
  const comp = TF.compounds(K).find(c => c.a === s && c.op !== '⊃');
  const say = ok ? ['맞았어요.', '정답이에요.', '맞혔어요.'][score.length % 3] : `아쉬워요. 정답은 ‘${NAME[s]}’.`;
  let sub = '';
  if (comp) sub = comp.op === '×' ? `${NAME[comp.parts[0]]}${eul(NAME[comp.parts[0]])} ${comp.n}번 → ${NAME[s]}. AI들이 스스로 만든 합성어예요.` : `${comp.parts.map(p => NAME[p]).join(' + ')} → ${NAME[s]}. 두 말을 합쳤어요.`;
  else if (!ok) sub = '듣는 AI도 처음엔 이렇게 틀렸어요. 통한 말만 다음 판에 다시 써요.';
  const G = await TF.loadGen(NOW), T = G ? G.islands[K].talks.filter(x => x.scene === s) : [], t0 = T.find(x => x.ok) || T[0];
  const memo = t0 ? `<div class="memo"><span class="cap">이번 세대 기록 · 이 그림으로 ${T.length}번 대화, ${T.filter(x => x.ok).length}번 통함</span>${tiles(t0.msg, 14, 'sm')}<span>AI ${t0.sp} → AI ${t0.li}</span><em>${t0.ok ? '통함' : '안 통함'}</em></div>` : '';
  $('#res').innerHTML = `<p class="say">${say}${sub ? `<small>${sub}</small>` : ''}</p>${memo}<div class="row"><button class="btn pri" id="nextQ">다음 말</button><button class="btn weak" id="whyQ">‘${NAME[s]}’${TF.josa(NAME[s], '이', '가')} 생긴 과정</button>${scoreHTML().replace('<div class="row">', '<div class="row" style="margin-left:auto">')}</div>`;
  $('#nextQ').onclick = () => { qi++; ask(); };
  $('#whyQ').onclick = () => { setScrub(s); $('#how').scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); setTimeout(() => playFrom(1), 500); };
}

/* 2. 이 말이 생긴 과정 */
let SW = 'r9', L = [], SG = NOW, timer = null;
const pct = g => NOW > 1 ? (g - 1) / (NOW - 1) * 100 : 100;
function setScrub(s){
  SW = s; L = TF.lineage(K, s);
  $('#howH').innerHTML = `${NOW}세대 동안의 ‘${NAME[s]}’. <span>처음엔 아무 글자나 쓰다가, 서로 통한 말만 남았어요.</span>`;
  $('#howCap').textContent = '막대를 끌거나 재생해 보세요 · 1세대 = 하루 두 번(07·19시) 자동 실행 1번, 그때마다 AI 4명 중 2명이 바뀜';
  $('#endLab').textContent = `${NOW}세대`;
  $('#track').setAttribute('aria-valuemax', NOW);
  const ch = L.map((r, i) => r.changed ? i + 1 : 0).filter(Boolean);
  $('#ticks').innerHTML = ch.filter(g => g > 1).map(g => `<span class="tick" style="left:${pct(g)}%"></span>`).join('');
  const show = ch.length > 8 ? [ch[0], ...ch.slice(-7)] : ch;
  $('#evs').innerHTML = show.map(g => `<button data-g="${g}">${g}세대 ${tiles(L[g - 1].w, 8)}</button>`).join('');
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
  $('#sWhen').textContent = `${slot(at(g))} · ${isl.ok}/${isl.talks} 통함`;
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
new IntersectionObserver(es => { if (!seen && es[0].isIntersecting) { seen = true; if (!reduce) playFrom(1); } }, {threshold: .45}).observe($('#how .scrub'));

/* 3. 지금 이 순간 */
let liveT = null;
async function live(){
  clearInterval(liveT);
  const G = await TF.loadGen(NOW); if (!G) return;
  const T = G.islands[K].talks.filter(t => t.from === K || !t.from);
  $('#liveH').innerHTML = `지금 ${NOW}세대, ${TF.ISL[K]}의 대화. <span>실제 기록을 그대로 다시 틀어요.</span>`;
  $('#tally').textContent = `${T.length}판 중 ${T.filter(t => t.ok).length}판 통함`;
  let i = 0;
  const step = () => {
    const t = T[i % T.length];
    $('#slots').innerHTML = Array.from({length: Math.max(32, T.length)}, (_, j) => `<i class="${j < (i % T.length) + 1 ? (T[j].ok ? 'ok' : 'no') : ''}${j === i % T.length ? ' cur' : ''}"></i>`).join('');
    $('#lrow').innerHTML = `<div><img src="img/${t.scene}.png" alt="${NAME[t.scene]}"><div class="who">AI ${t.sp}<br>그림을 봄</div></div><span class="ar">→</span><div>${tiles(t.msg, mob() ? 22 : 30)}</div><span class="ar">→</span><div><img src="img/${t.guess}.png" alt="${NAME[t.guess] || ''}"><div class="who">AI ${t.li}<br><span class="v" style="color:${t.ok ? 'var(--k)' : 'var(--t3)'}">${t.ok ? '맞힘' : `틀림 (정답 ${NAME[t.scene]})`}</span></div></div>`;
    i++;
  };
  step(); liveT = setInterval(step, 2600);
}

/* 4. 오늘의 사전 */
function dict(){
  const ws = SIDS.filter(s => W(s));
  $('#dictH').innerHTML = `오늘의 사전 <span>${ws.length}개 · ${slot(at(NOW))}판</span>`;
  $('#dict').innerHTML = ws.map(s => { const Ls = TF.lineage(K, s), r = run(Ls, NOW), nw = r === 1 && NOW > 1;
    return `<div class="de"><span class="w">${tiles(W(s), mob() ? 18 : 22)}</span><b>${NAME[s]}</b><span class="badge${nw ? ' new' : ''}">${nw ? '새 말' : r >= NOW ? '처음부터' : `${r}세대째`}</span></div>`; }).join('');
}
$('#hideSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; for (const x of $('#hideSeg').children) x.setAttribute('aria-pressed', x === b); $('#dict').classList.toggle('hide', b.dataset.v === '1'); };

/* 5. 일정 */
function trip(){
  const t0 = at(1), t1 = TF.END, now = TF.now(), p = t => Math.max(0, Math.min(100, (t - t0) / (t1 - t0) * 100));
  const dd = t => { const d = TF.dday(t); return d > 0 ? `D-${d}` : d === 0 ? '오늘' : '지남'; };
  $('#tripH').innerHTML = `실험 일정 <span>${TF.met ? '두 섬이 만났어요' : `두 섬이 만나기까지 ${dd(TF.MEET)}`}</span>`;
  const m = [[t0, '시작', TF.md(t0)], [TF.MEET, '두 섬 만남', `${TF.md(TF.MEET)} · ${dd(TF.MEET)}`], [t1, '발표', `${TF.md(t1)} · ${dd(t1)}`]];
  $('#trip').innerHTML = `<div class="ln"><i style="width:${p(now)}%"></i><u style="left:${p(now)}%"></u></div>` +
    m.map(([t, a, b], j) => `<div class="m" style="left:${p(t)}%;transform:translateX(${j === 0 ? 0 : j === 2 ? -100 : -50}%);text-align:${j === 0 ? 'left' : j === 2 ? 'right' : 'center'}"><b>${a}</b><span>${b}</span></div>`).join('');
}

function all(){
  document.body.style.setProperty('--k', COL[K]);
  seg(); buildOrder(); ask(); setScrub(SIDS.includes('r9') && W('r9') ? 'r9' : SIDS.find(s => W(s))); live(); dict(); trip();
}
all();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { spark(); setGen(SG); }, 150); });
})();
