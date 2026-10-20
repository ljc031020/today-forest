/* 오늘의 숲 · 사이트
   #/               단어장 (첫 화면)
   #/quiz           맞혀 보기 (발표 QR이 도착하는 곳)
   #/talk/grid/25   대화 보기 (섬, 세대)
   #/word/grid/r9   단어 기록 (섬, 그림) — 단어장에서 단어를 누르면
   #/notes          실험 노트 */
(async function(){
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TF = await window.TF.load();
const {ID, NAME, SIDS, NOW, LAST, GENS} = TF, esc = TF.esc, g3 = TF.g3, C = TF.COLOR;
const W = (k, s, r) => TF.word(k, s, r);
const pct = v => Math.round(v / 32 * 100);
const big = (w, k, q = 20) => TF.wordHTML(w, k, q);
const pic = (s, size = 30) => `<img src="img/${s}.png" alt="${esc(NAME[s])}" style="width:${size}px;height:${size}px">`;
const qs = new URLSearchParams(location.search);
let speed = +qs.get('speed') || 1, token = 0;
const wait = ms => sleep(ms / speed);

function tabs(el, val, on, extra = []){
  const ks = TF.ORDER.concat(extra);
  el.innerHTML = ks.map(k => `<button aria-pressed="${k === val}" data-k="${k}" style="--k:${C[k] || 'var(--ink)'}"><i></i>${k === 'cross' ? '두 섬 사이' : TF.ISL[k]}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => on(b.dataset.k));
}

/* 시계 */
const tick = () => { $('#clockpill').innerHTML = TF.nextSlot ? `${NOW}세대<span class="lg"> · 다음 세대까지</span> <b>${TF.countdown()}</b>` : `${NOW}세대`; };
tick(); setInterval(tick, 1000);

/* ════════ 오늘의 언어 ════════ */
let todayK = 'grid', hideMeaning = false;
function drawToday(){
  const d0 = new Date(Date.parse(GENS[0].at) + TF.KST);
  $('#heroWhen').textContent = `${d0.getUTCMonth() + 1}월 ${d0.getUTCDate()}일 시작 → 지금 ${NOW}세대 (하루 2세대)`;
  tabs($('#todayTabs'), todayK, k => { todayK = k; drawToday(); });
  const prev = GENS[GENS.length - 2];
  $('#spec').innerHTML = SIDS.map(s => { const w = W(todayK, s), p = W(todayK, s, prev);
    return `<a class="wd" href="#/word/${todayK}/${s}" style="--k:${C[todayK]}">${p !== undefined && p !== w ? '<span class="new">바뀜</span>' : ''}<span class="big">${big(w, todayK, 18)}</span><span class="mn" style="visibility:${hideMeaning ? 'hidden' : 'visible'}">${pic(s, 26)}${NAME[s]}</span></a>`; }).join('');
  $('#hideBtn').textContent = hideMeaning ? '뜻 보기' : '뜻 가리기';
  $('#hideBtn').onclick = () => { hideMeaning = !hideMeaning; drawToday(); };
  const r = LAST.islands[todayK];
  const dd = TF.dday(TF.MEET);
  $('#todayMeta').innerHTML = `<b>${TF.ISL[todayK]}</b> · ${TF.ISL_DESC[todayK]} · 이번 세대 32판 중 ${r.ok}판 통함 · ` +
    (TF.met ? `${TF.META.met_gen}세대부터 글자 섬 × 그림 섬 만남 중` : `10.22 글자 섬 × 그림 섬 첫 만남 ${dd > 0 ? 'D-' + dd : '오늘'}`) + '<br>단어를 누르면 1세대부터 바뀐 기록이 나와요.';
}

/* ════════ 직접 해 보기 ════════ */
let quizK = 'grid', score = {right: 0, total: 0}, Q = null;
async function newQuestion(){
  const cs = TF.compounds(quizK).filter(c => c.op !== '⊃');
  const words = SIDS.filter(s => W(quizK, s));
  const target = (cs.length && Math.random() < .5) ? cs[Math.floor(Math.random() * cs.length)].a : words[Math.floor(Math.random() * words.length)];
  const others = words.filter(s => s !== target && W(quizK, s) !== W(quizK, target)).sort(() => Math.random() - .5).slice(0, 3);
  Q = {target, opts: [target, ...others].sort(() => Math.random() - .5), tries: 0, done: false, comp: cs.find(c => c.a === target)};
  drawQuiz();
}
async function drawQuiz(){
  tabs($('#quizTabs'), quizK, k => { quizK = k; newQuestion(); });
  if (!Q) return newQuestion();
  $('#score').innerHTML = score.total ? `한 번에 맞힘 <b>${score.right}</b> / ${score.total}` : '';
  $('#qWord').innerHTML = big(W(quizK, Q.target), quizK, 60);
  $('#choices').innerHTML = Q.opts.map(s => `<button class="ch" data-s="${s}" aria-label="${esc(NAME[s])}"><img src="img/${s}.png" alt=""><span class="nm"></span></button>`).join('');
  $('#qMemo').style.display = 'none'; $('#nextQ').style.display = 'none';
  say('넷 중 하나를 골라보세요', '처음엔 찍어도 돼요. AI 1세대도 그랬어요');
  document.querySelectorAll('#choices .ch').forEach(b => b.onclick = () => answer(b));
}
const say = (b, t) => { $('#qSay').innerHTML = `<b>${b}</b><span>${t}</span>`; };
async function answer(b){
  if (Q.done) return;
  Q.tries++;
  const right = b.dataset.s === Q.target;
  b.classList.add(right ? 'right' : 'wrong'); b.querySelector('.nm').textContent = NAME[b.dataset.s];
  if (right) {
    Q.done = true; score.total++; if (Q.tries === 1) score.right++;
    $('#score').innerHTML = `한 번에 맞힘 <b>${score.right}</b> / ${score.total}`;
    Q.tries === 1 ? say(`정답, ${NAME[Q.target]}`, '감으로 맞혔다면 AI 1세대와 같은 상태') : say(`정답, ${NAME[Q.target]}`, '메모를 보고 맞힌 것. 이게 AI가 배우는 방식');
    $('#nextQ').style.display = 'inline-flex';
    return;
  }
  if (Q.tries === 1) {
    let lines = '';
    if (Q.comp) lines = Q.comp.parts.map(p => `<div class="ml">${pic(p)}${big(W(quizK, p), quizK, 13)}<span>= ${NAME[p]}</span><em>통함</em></div>`).join('');
    else { const M = await TF.loadMem(NOW); const all = M ? Object.values(M.islands[quizK].start).flat() : [];
      const w = W(quizK, Q.target), G = await TF.loadGen(NOW), t = G && [...G.islands[quizK].talks].reverse().find(x => x.msg === w && x.ok);
      const hit = all.find(e => e[1] === w && e[2]) || (t && [t.scene, t.msg, true]);
      lines = hit ? `<div class="ml">${pic(hit[0])}${big(hit[1], quizK, 13)}<em>통함</em></div>` : '<div class="ml none">메모에 없는 말</div>'; }
    $('#qMemoLines').innerHTML = lines; $('#qMemo').style.display = 'grid'; $('#qMemo').classList.add('pop');
    Q.comp ? say('힌트: 이 말 안에 든 작은 말', '메모를 보고 다시 골라보세요') : lines.includes('none') ? say('AI 메모에도 없는 말', 'AI도 이럴 땐 찍어요. 다시 골라보세요') : say('힌트: AI의 메모 한 줄', '같은 말이 쓰였던 그림이에요');
  } else say('다시 한 번', '남은 그림 중에 있어요');
}
$('#nextQ').onclick = newQuestion;

/* ════════ 대화 보기 ════════ */
let talkK = 'grid', talkG = NOW, liveOn = false;
const toEntry = (x, k) => ({s: x[0], m: x[1], ok: !!x[2], f: x[3] || k});
function setColor(k){ $('#vTalk').style.setProperty('--c', C[k] || 'var(--ink)'); }
function setStep(i){ document.querySelectorAll('#steps .step').forEach((s, j) => { s.classList.toggle('on', j === i); s.classList.toggle('done', j < i); }); }
function lineHTML(e, opt = {}){
  return `<div class="ml${opt.use ? ' use' : ''}${e.mut ? ' mut' : ''}${opt.add ? ' pop' : ''}">${pic(e.s)}${big(e.m, e.f, 12)}<em class="${e.ok ? '' : 'no'}">${e.ok ? '통함' : '안 통함'}</em></div>`;
}
function spMemoHTML(mem, scene, used){
  const rows = mem.map((e, i) => [e, i]).filter(([e]) => e.s === scene).reverse().slice(0, 4);
  if (!rows.length) return `<div class="ml none">이 그림 메모 없음 · 전체 ${mem.length}줄</div>`;
  return rows.map(([e, i]) => lineHTML(e, {use: i === used})).join('') + `<div class="ml none">… 전체 ${mem.length}줄</div>`;
}
function liMemoHTML(mem, msg){
  const rows = mem.map((e, i) => [e, i]).filter(([e]) => e.m === msg).reverse().slice(0, 4);
  if (!rows.length) return `<div class="ml none">처음 듣는 말 · 전체 ${mem.length}줄</div>`;
  return rows.map(([e]) => lineHTML(e, {use: true})).join('') + `<div class="ml none">… 전체 ${mem.length}줄</div>`;
}
function drawSlots(list){
  $('#slots').innerHTML = Array.from({length: 32}, (_, i) => { const r = list[i];
    return r ? `<div class="slot ${r.ok ? 'ok' : 'no'}" style="--c:${C[r.from]}">${pic(r.scene, 24)}</div>` : `<div class="slot${i === list.length ? ' cur' : ''}"></div>`; }).join('');
  const ok = list.filter(r => r.ok).length;
  $('#tally').innerHTML = list.length ? `${ok}<small>/ ${list.length} 통함</small>` : '';
}
function clearStage(){
  $('#target').classList.add('hide'); $('#msg').innerHTML = ''; $('#msg').style.transform = 'none';
  $('#tag').className = 'tag'; $('#verdict').className = 'verdict';
  $('#cands').innerHTML = '<div class="cand back"><img alt=""></div>'.repeat(4);
  $('#spLines').innerHTML = ''; $('#liLines').innerHTML = ''; setStep(-1);
}
function avHTML(id, born, gen){ return `${id}${gen > 1 && born && born[id] === gen ? '<span class="nw">새</span>' : ''}`; }

async function play(rec, tk, ctx){
  const from = rec.from, to = rec.to; setColor(from);
  const spMem = ctx.mem[rec.sp] || (ctx.mem[rec.sp] = []), liMem = ctx.mem[rec.li] || (ctx.mem[rec.li] = []);
  clearStage();
  $('#spAv').innerHTML = avHTML(rec.sp, ctx.born, ctx.gen); $('#liAv').innerHTML = avHTML(rec.li, ctx.born, ctx.gen);
  $('#spAv').style.cssText = `--c:${C[from]}`; $('#liAv').style.cssText = `--c:${C[to]}`;
  // 1 본다
  setStep(0); $('#targetImg').src = `img/${rec.scene}.png`;
  await wait(200); if (tk !== token) return;
  $('#target').classList.remove('hide');
  $('#spLines').innerHTML = spMemoHTML(spMem, rec.scene);
  await wait(1100); if (tk !== token) return;
  // 2 말한다
  setStep(1);
  const used = [...spMem.keys()].reverse().find(i => spMem[i].s === rec.scene && spMem[i].m === rec.msg);
  $('#spLines').innerHTML = spMemoHTML(spMem, rec.scene, used);
  const tag = $('#tag'); tag.textContent = used !== undefined ? '메모에서 꺼냄' : '메모에 없음 → 새로 지음'; tag.className = 'tag show';
  const m = $('#msg');
  if (TF.body(from) === 'grid') { m.innerHTML = `<span class="g3">${'<i></i>'.repeat(9)}</span>`; const cells = m.querySelectorAll('i');
    for (let i = 0; i < 9; i++) { if (tk !== token) return; const c = rec.msg[i]; if (c !== '.') { cells[i].textContent = c; cells[i].classList.add('pop'); await wait(110); } } }
  else { m.innerHTML = '<span class="g"></span>'; const g = m.firstChild; for (const c of rec.msg) { if (tk !== token) return; g.insertAdjacentHTML('beforeend', `<span class="pop" style="display:inline-block">${esc(c)}</span>`); await wait(200); } }
  await wait(700); if (tk !== token) return;
  // 3 고른다
  setStep(2); tag.className = 'tag';
  $('#liLines').innerHTML = liMemoHTML(liMem, rec.msg);
  const heard = liMem.filter(e => e.m === rec.msg && e.ok).map(e => e.s);
  $('#cands').innerHTML = (rec.cands || []).map(c => `<div class="cand" data-s="${c}"><img src="img/${c}.png" alt="${esc(NAME[c])}"></div>`).join('');
  const els = [...$('#cands').children];
  await wait(500); if (tk !== token) return;
  els.forEach(e => heard.includes(e.dataset.s) && e.classList.add('hint'));
  for (let r = 0; r < 2; r++) for (const e of els) { if (tk !== token) return; e.classList.add('scan'); await wait(110); e.classList.remove('scan'); }
  const pick = els.find(e => e.dataset.s === rec.guess); pick && pick.classList.add('chosen');
  await wait(600); if (tk !== token) return;
  // 4 메모한다
  setStep(3);
  if (rec.ok) pick && pick.classList.add('right'); else { pick && pick.classList.add('wrong'); const t = els.find(e => e.dataset.s === rec.scene); t && t.classList.add('missed'); }
  const v = $('#verdict'); v.querySelector('span').textContent = rec.ok ? '통함' : '안 통함'; v.className = 'verdict show' + (rec.ok ? ' ok' : '');
  const e = {s: rec.scene, m: rec.msg, ok: !!rec.ok, f: from};
  for (const mm of [spMem, liMem]) { mm.push({...e}); if (mm.length > 30) mm.shift(); }
  $('#spLines').innerHTML = lineHTML(e, {add: true}) + spMemoHTML(spMem.slice(0, -1), rec.scene);
  $('#liLines').innerHTML = lineHTML(e, {add: true}) + liMemoHTML(liMem.slice(0, -1), rec.msg);
  ctx.done.push(rec); drawSlots(ctx.done);
  await wait(1700);
}

function overlay(html){ $('#overBox').innerHTML = html; $('#over').classList.add('show'); }
function hideOverlay(){ $('#over').classList.remove('show'); }

async function talkView(){
  const k = talkK, gen = talkG, tk = ++token;
  hideOverlay(); clearStage(); drawSlots([]); setColor(k);
  const [G, M] = await Promise.all([TF.loadGen(gen), TF.loadMem(gen)]); if (tk !== token) return;
  let talks = k === 'cross' ? ((G && G.cross || {}).talks || []) : ((G && G.islands[k]) || {}).talks || [];
  talks = talks.map(t => ({from: k, to: k, ...t})).filter(t => t.msg);
  const ctx = {gen, done: [], born: {}, mem: {}};
  const fill = kk => { const MI = M && M.islands[kk]; if (!MI) return; for (const [id, arr] of Object.entries(MI.start)) { const mu = new Set((MI.mut || {})[id] || []); ctx.mem[id] = arr.map((x, i) => ({...toEntry(x, kk), mut: mu.has(i)})); } Object.assign(ctx.born, Object.fromEntries(Object.entries(MI.born || {}).map(([a, b]) => [+a, b]))); };
  if (k === 'cross') (TF.META.meet || []).forEach(fill); else fill(k);
  for (const rec of talks) { if (tk !== token) return; await play(rec, tk, ctx); }
  if (tk !== token) return;
  const ok = ctx.done.filter(r => r.ok).length;
  overlay(`<div class="big-n">${ok} / ${ctx.done.length}</div><p>${gen}세대 · ${k === 'cross' ? '두 섬 사이' : TF.ISL[k]} · 통한 판</p>`);
  await wait(2600); if (tk !== token) return;
  const end = k !== 'cross' && M && M.islands[k] && M.islands[k].end;
  if (end) {
    const mutHTML = b => b.mut.slice(0, 2).map(([p, a, z]) => `<div class="mutl">${big(a, k, 11)}<span>→</span>${big(z, k, 11)}<span class="tagp">잘못 옮김</span></div>`).join('') || '<span class="k-small">잘못 옮긴 줄 없음</span>';
    const forestHas = b => b.pick.some(j => end.pool[j][0] === ID.forest);
    overlay(`<h2>세대 교체: ${gen} → ${gen + 1}세대</h2>
      <div class="gen-swap">
        <div class="col gone"><h3>떠나는 AI</h3><div class="ids">${end.left.map(i => `<span class="av" style="--c:${C[k]}">${i}</span>`).join('')}</div><span class="k-small">메모도 같이 사라짐</span></div>
        <span style="font:300 40px/1 var(--f-num);color:var(--faint)">→</span>
        <div class="col"><h3>새로 온 AI <span class="k-small">최근 64판 중 30줄 물려받음</span></h3>${end.born.map(b => `<div style="display:grid;gap:6px"><div class="row"><span class="av" style="--c:${C[k]}">${b.id}</span><span class="k-small">‘숲’ 메모 ${forestHas(b) ? '받음' : '<b style="color:var(--ink)">못 받음</b>'}</span></div>${mutHTML(b)}</div>`).join('')}</div>
      </div>`);
    await wait(7000); if (tk !== token) return;
  }
  if (gen < NOW) { talkG = gen + 1; location.hash = `#/talk/${k}/${talkG}`; return; }
  overlay(`<div class="big-n" style="color:var(--ink)" id="cdn">${TF.countdown()}</div><p>${TF.nextSlot ? `다음 ${TF.nextSlot.gen}세대: ${TF.md(TF.nextSlot.t)} ${TF.hour(TF.nextSlot.t)}시` : ''}</p><div class="row" style="justify-content:center"><button class="btn" id="again">다시 보기</button><a class="btn ghost" href="#/word/${k === 'cross' ? 'grid' : k}/${ID.forest}">‘숲’ 기록 보기</a></div>`);
  $('#again').onclick = () => talkView();
  while (tk === token) { const el = $('#cdn'); if (el) el.textContent = TF.countdown(); await sleep(500); }
}

async function liveView(){
  const k = talkK, tk = ++token; hideOverlay(); clearStage(); drawSlots([]);
  const st = await TF.getJSON('data/state.json');
  const ctx = {gen: (st && st.gen || NOW) + 1, done: [], born: {}, mem: {}};
  for (const kk of TF.ORDER) for (const a of (st && st.islands[kk].agents) || []) { ctx.mem[a.id] = a.memory.map(x => ({s: x.scene, m: x.msg, ok: x.ok, f: x.from || kk})); ctx.born[a.id] = a.born; }
  const es = new EventSource(`/api/live?island=${k}&n=8`);
  const q = []; let end = false, wake = null;
  es.onmessage = e => { const d = JSON.parse(e.data); if (d.kind === 'done' || d.kind === 'error') { end = true; es.close(); } else if (d.kind === 'result' && d.msg) q.push(d); wake && wake(); };
  es.onerror = () => { end = true; es.close(); wake && wake(); };
  while (tk === token) { if (!q.length) { if (end) break; await new Promise(r => wake = r); wake = null; continue; } const d = q.shift(); await play({...d, from: d.from || k, to: d.to || k}, tk, ctx); }
  es.close();
}
function drawTalk(){
  tabs($('#talkTabs'), talkK, k => { talkK = k; talkG = k === 'cross' ? NOW : talkG; location.hash = `#/talk/${k}/${talkG}`; }, GENS.some(g => g.cross) ? ['cross'] : []);
  $('#genSel').innerHTML = [...GENS].reverse().filter(g => talkK !== 'cross' || g.cross).map(g => `<option value="${g.gen}"${g.gen === talkG ? ' selected' : ''}>${g.gen}세대 · ${TF.md(Date.parse(g.at))} ${TF.hour(Date.parse(g.at))}시${g.gen === NOW ? ' (최신)' : ''}</option>`).join('');
  $('#genSel').onchange = e => { talkG = +e.target.value; location.hash = `#/talk/${talkK}/${talkG}`; };
  $('#speedBtn').textContent = speed + '×';
  liveOn ? liveView() : talkView();
}
$('#speedBtn').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('#speedBtn').textContent = speed + '×'; };
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  fetch('/api/ping', {cache: 'no-store'}).then(r => r.json()).then(j => { if (!j.key) return; const b = $('#liveBtn'); b.hidden = false;
    b.onclick = () => { liveOn = !liveOn; b.textContent = liveOn ? '기록 재생' : '● 실시간'; drawTalk(); }; }).catch(() => {});
}

/* ════════ 단어의 일생 ════════ */
let wordK = 'grid', wordS = ID.forest;
function drawWord(){
  tabs($('#wordTabs'), wordK, k => { location.hash = `#/word/${k}/${wordS}`; });
  $('#picks').innerHTML = SIDS.map(s => `<button aria-pressed="${s === wordS}" data-s="${s}" aria-label="${esc(NAME[s])}" title="${esc(NAME[s])}"><img src="img/${s}.png" alt=""></button>`).join('');
  $('#picks').querySelectorAll('button').forEach(b => b.onclick = () => { location.hash = `#/word/${wordK}/${b.dataset.s}`; });
  const lin = TF.lineage(wordK, wordS), runs = [];
  for (const x of lin) { if (x.changed || !runs.length) runs.push({w: x.w, a: x.gen, b: x.gen}); else runs[runs.length - 1].b = x.gen; }
  const last = runs[runs.length - 1];
  $('#wordH').textContent = `‘${NAME[wordS]}’의 기록`;
  $('#nowW').style.setProperty('--k', C[wordK]);
  $('#nowW').innerHTML = `${pic(wordS, 84)}<span class="big">${big(W(wordK, wordS), wordK, 34)}</span><b>${TF.ISL[wordK]}의 ‘${NAME[wordS]}’</b><span class="k-small">${last.a === last.b ? `${NOW}세대에 새로 바뀜` : `${last.a}세대부터 ${NOW - last.a + 1}세대째 같은 말`} · 총 ${runs.length - 1}번 바뀜</span>`;
  $('#runs').style.setProperty('--k', C[wordK]);
  $('#runs').innerHTML = runs.map((r, i) => `<div class="run${i === runs.length - 1 ? ' last' : ''}"><span class="big">${r.w ? big(r.w, wordK, 14) : '·'}</span><b>${r.a === r.b ? r.a : r.a + '–' + r.b}세대</b></div>`).join('<span class="to">→</span>');
  $('#spark').style.setProperty('--k', C[wordK]);
  $('#spark').innerHTML = GENS.map(g => `<u style="height:${pct(g.islands[wordK].ok)}%" title="${g.gen}세대 ${g.islands[wordK].ok}/32"></u>`).join('');
  const cs = TF.compounds(wordK).filter(c => c.op !== '⊃' && (c.a === wordS || c.parts.includes(wordS)));
  $('#wordEqs').innerHTML = cs.map(eqHTML.bind(null, wordK)).join(''); $('#wordEqsB').style.display = cs.length ? '' : 'none';
}
function eqHTML(k, c){
  const p = s => `<div class="pic">${pic(s, 38)}${NAME[s]}</div>`;
  return `<div class="eq">${c.parts.map(s => p(s) + big(W(k, s), k, 20)).join('<span class="op">+</span>')}${c.op === '×' ? `<span class="op">× ${c.n}</span>` : ''}<span class="op">=</span>${big(W(k, c.a), k, 20)}${p(c.a)}<span class="say">${c.since}세대~</span></div>`;
}

/* ════════ 실험 노트 ════════ */
async function drawNotes(){
  $('#notesChart').innerHTML = TF.okChart({w: 1000, h: 300});
  const SP = TF.split('grid'), all = TF.compounds('grid').filter(c => c.op !== '⊃' && (!SP || c.a !== SP.b));
  const f0 = all.find(c => c.a === ID.forest), rest = all.filter(c => c !== f0), byS = (x, y) => x.since - y.since;
  const cs = [f0, rest.filter(c => c.op === '×').sort(byS)[0], rest.filter(c => c.op === '+').sort(byS)[0]].filter(Boolean);
  for (const c of rest) if (cs.length < 4 && !cs.includes(c)) cs.push(c);
  $('#notesEqs').innerHTML = (cs.length ? cs.map(eqHTML.bind(null, 'grid')).join('') : '<p class="note">이번 세대엔 합친 말이 안 보임</p>') + `<p class="note">그림 섬 기준 · ‘숲 = 나무 여럿’ 같은 건 AI의 상식일 수 있음. 다만 섬 전체가 같은 규칙으로 씀</p>`;
  if (SP) $('#notesLen').innerHTML = TF.splitHTML('grid', 16) + `<p class="note">${NAME[SP.a]}: ${SP.from}칸 → ${SP.to}칸 (${SP.shrank}세대) · 긴 말은 ${NAME[SP.b]}${TF.josa(NAME[SP.b], '이', '가')} 가져감 (${SP.took}세대)</p>`;
  else { $('#notesLenH').textContent = '짧아짐'; $('#notesLen').innerHTML = `<div class="card" style="display:grid;gap:16px">${TF.lengths('grid').map(r => `<div class="bar"><div class="k">${{3:'자주 나오는 그림', 2:'보통', 1:'가끔 나오는 그림'}[r.t]}<small>${r.ex}</small></div><div class="tr"><div class="b" style="width:${r.first / 9 * 75}%"><span>${r.first.toFixed(1)}칸</span></div><div class="b now" style="width:${r.last / 9 * 75}%"><span>${r.last.toFixed(1)}칸</span></div></div></div>`).join('')}</div>`; }
  const MT = TF.meeting();
  if (MT) { $('#notesIslsH').textContent = `두 섬의 만남 (${MT.mg}세대~)`; $('#notesIsls').className = ''; $('#notesIsls').innerHTML = TF.meetHTML(); }
  else $('#notesIsls').innerHTML = TF.ORDER.map(k => { const w = W(k, ID.forest); return `<div class="isl" style="--k:${C[k]}"><h3><i></i>${TF.ISL[k]}</h3><div class="big">${big(w, k, 26)}</div><span class="k-small">‘숲’ · ${TF.scriptsIn(w).map(x => TF.SCRIPT_KO[x]).join('·')}</span><p>${TF.ISL_DESC[k]}</p></div>`; }).join('');
  $('#notesMeet').innerHTML = MT ? '' : `<b>10.22</b> 글자 섬 × 그림 섬 첫 만남. 비교 섬은 끝까지 만나지 않음 → 만남의 영향을 견주는 기준`;
  { const g = W('grid', ID.mountain), sea = W('grid', ID.sea), tm = W('twin', ID.mountain), bits = [];
    if (g && g.includes('ㅅ')) bits.push('산 = ㅅ'); if (sea && sea.includes('ㅂ')) bits.push('바다 = ㅂ');
    let t = bits.length ? `${bits.join(', ')} (한국어 첫소리)` : '';
    if (tm && tm.startsWith('ο')) t += `${t ? ' · ' : ''}산 = ο (그리스어 όρος)`;
    $('#leak').textContent = (t || '모양이 닮은 글자부터 고름') + '. 글자도 아는 문자(한글·그리스 문자)부터 고름.'; }
  const Cc = await TF.loadControl();
  $('#notesCmp').innerHTML = TF.ORDER.map(k => { const c = Cc && Cc.islands && Cc.islands[k]; const CG = (Cc && GENS.find(x => x.gen === Cc.gen)) || LAST; const v = c ? pct(c.ok / c.talks * 32) : null, now = pct(CG.islands[k].ok);
    return `<div class="bar"><div class="k">${TF.ISL[k]}<small>메모 없음 / 30줄</small></div><div class="tr">${v == null ? '<span class="tagp">측정 중</span>' : `<div class="b" style="width:${v * .75}%"><span>${v}%</span></div>`}<div class="b now" style="width:${now * .75}%;background:${C[k]}"><span>${now}%</span></div></div></div>`; }).join('') +
    `<p class="note" style="margin:0">같은 AI·같은 규칙에서 메모만 지우고 섬마다 32판${Cc && Cc.gen ? ` (${Cc.gen}세대 기준)` : ''} · 찍기 25%</p>`;
}

/* ════════ 길 찾기 ════════ */
function route(){
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const v = p[0] || '';
  token++;
  const map = {'': 'vToday', quiz: 'vQuiz', talk: 'vTalk', word: 'vWord', notes: 'vNotes'};
  const id = map[v] || 'vToday';
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === id));
  const navKey = v === 'word' ? '' : (map[v] ? v : ''); document.querySelectorAll('#nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === `#/${navKey}` ? 'page' : 'false'));
  scrollTo(0, 0);
  if (id === 'vToday') drawToday();
  if (id === 'vQuiz') drawQuiz();
  if (id === 'vTalk') { if (p[1] && (TF.ORDER.includes(p[1]) || p[1] === 'cross')) talkK = p[1]; if (p[2]) talkG = Math.max(1, Math.min(NOW, +p[2] || NOW)); drawTalk(); }
  if (id === 'vWord') { if (p[1] && TF.ORDER.includes(p[1])) wordK = p[1]; if (p[2] && SIDS.includes(p[2])) wordS = p[2]; drawWord(); }
  if (id === 'vNotes') drawNotes();
}
addEventListener('hashchange', route);
route();
})();
