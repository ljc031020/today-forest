/* 오늘의 숲 — 발표(story)와 사이트(index)가 함께 쓰는 데이터·그리기 도구 */
(function(){
const TF = window.TF = {};
const KO = {water:'물',fire:'불',tree:'나무',person:'사람',mountain:'산',house:'집',sea:'바다',forest:'숲',village:'마을',volcano:'화산','big fire':'큰 불',crowd:'군중'};
const esc = TF.esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
TF.COLOR = {line:'var(--line)', grid:'var(--grid)', twin:'var(--twin)'};
TF.ISL = {line:'글자 섬', grid:'그림 섬', twin:'비교 섬'};
TF.ISL_DESC = {line:'글자를 한 줄로 늘어놓는 섬', grid:'3×3 칸에 글자를 놓는 섬', twin:'글자 섬과 같은 조건, 아무도 만나지 않는 섬'};
TF.ORDER = ['grid', 'line', 'twin'];
TF.SCRIPT_KO = {greek:'그리스 문자', georgian:'조지아 문자', cherokee:'체로키 문자', arabic:'아랍 문자', armenian:'아르메니아 문자', runic:'룬 문자', hangul:'한글 자모', digit:'숫자'};
const pad = n => String(n).padStart(3, '0');
/* ?preview : 시험 모드(가짜 응답)로 만든 '발표 날' 데이터로 미리 보기 */
TF.PREVIEW = new URLSearchParams(location.search).has('preview');
const D = TF.PREVIEW ? 'preview/data/' : 'data/';
const T0 = Date.now();
TF.now = () => TF.PREVIEW && TF.LAST ? Date.parse(TF.LAST.at) + 3 * 3600e3 + (Date.now() - T0) : Date.now();
const cache = {};
const getJSON = TF.getJSON = u => cache[u] || (cache[u] = fetch(u, {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null));

TF.load = async function(){
  const S = await getJSON(D + 'summary.json');
  TF.S = S; TF.META = S.meta; TF.GENS = S.gens; TF.LAST = S.gens[S.gens.length - 1]; TF.NOW = TF.LAST.gen;
  TF.ID = S.meta.scenes; TF.NAME = {}; TF.EN = {};
  for (const [en, id] of Object.entries(TF.ID)) { TF.NAME[id] = KO[en] || en; TF.EN[id] = en; }
  TF.SIDS = Object.values(TF.ID);
  TF.KO = KO;
  buildTrip();
  if (TF.PREVIEW) document.addEventListener('DOMContentLoaded', banner), document.readyState !== 'loading' && banner();
  return TF;
};
function banner(){ if (document.getElementById('pvb')) return; const b = document.createElement('div'); b.id = 'pvb'; b.className = 'pvb';
  b.innerHTML = `미리보기 · 10/29 발표 날을 가정한 <b>가짜 데이터</b>예요 (AI 대신 시험 모드가 대답). 숫자와 단어는 의미 없어요. <a href="${location.pathname}${location.hash}">실제 데이터로</a>`; document.body.prepend(b); }
TF.loadGen = n => getJSON(`${D}gens/g${pad(n)}.json`);
TF.loadMem = n => getJSON(`${D}mem/g${pad(n)}.json`);
TF.loadControl = () => getJSON(D + 'control.json');
TF.body = k => TF.META.islands[k].body;
TF.word = (k, s, row = TF.LAST) => row && row.islands[k] && (row.islands[k].words || {})[s];
TF.josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c % 28 ? a : b; };

/* 글자 그리기: 그림 섬은 3×3, 나머지는 한 줄 */
TF.g3 = (w, q = 20, k) => `<span class="g3" style="--q:${q}px${k ? `;--k:${k}` : ''}">${[...w].map(c => `<i>${c === '.' ? '' : esc(c)}</i>`).join('')}</span>`;
TF.cells = w => [...w].map(c => `<i>${c === '.' ? '' : esc(c)}</i>`).join('');
TF.wordHTML = (w, k, q = 20) => w == null ? '<span class="g" style="opacity:.3">—</span>' : TF.body(k) === 'grid' ? TF.g3(w, q) : `<span class="g">${esc(w)}</span>`;
TF.glyphSet = w => new Set([...w].filter(c => c !== '.'));
TF.nCells = w => [...w].filter(c => c !== '.').length;

/* 합성어: 지금 말 A가 다른 말들의 글자로만 이루어졌는지 → '나무 ×3 = 숲', '집 + 사람 = 마을' */
TF.compounds = function(k = 'grid', row = TF.LAST){
  const W = s => TF.word(k, s, row);
  const out = [];
  for (const a of TF.SIDS) {
    const A = W(a); if (!A) continue;
    const ga = TF.glyphSet(A), na = TF.nCells(A);
    const subs = TF.SIDS.filter(b => b !== a && W(b) && TF.nCells(W(b)) < na && [...TF.glyphSet(W(b))].every(c => ga.has(c)));
    if (!subs.length) continue;
    // 한 단어의 반복
    const one = subs.find(b => [...ga].every(c => TF.glyphSet(W(b)).has(c)) && na % TF.nCells(W(b)) === 0);
    if (one) { out.push({a, parts: [one], op: '×', n: na / TF.nCells(W(one))}); continue; }
    // 두 단어 합
    let two = null;
    for (const b of subs) for (const c of subs) if (b < c) { const u = new Set([...TF.glyphSet(W(b)), ...TF.glyphSet(W(c))]); if (u.size === ga.size && [...ga].every(x => u.has(x))) two = two || [b, c]; }
    if (two) { out.push({a, parts: two, op: '+'}); continue; }
    out.push({a, parts: [subs[0]], op: '⊃'});
  }
  // 언제부터 이렇게 썼나: 현재 관계(× 는 같은 배수까지)가 끊기지 않고 이어진 첫 세대
  for (const c of out) {
    let since = TF.NOW;
    for (let i = TF.GENS.length - 1; i >= 0; i--) {
      const r = TF.GENS[i], A = TF.word(k, c.a, r); if (!A) break;
      const ok = c.parts.every(b => { const B = TF.word(k, b, r); return B && [...TF.glyphSet(B)].every(x => TF.glyphSet(A).has(x)); }) && (c.op !== '×' || (TF.nCells(A) === c.n * TF.nCells(TF.word(k, c.parts[0], r)) && [...TF.glyphSet(A)].every(x => TF.glyphSet(TF.word(k, c.parts[0], r)).has(x))));
      if (!ok) break; since = r.gen;
    }
    c.since = since;
  }
  const rank = {'×': 0, '+': 1, '⊃': 2};
  return out.sort((x, y) => rank[x.op] - rank[y.op] || x.since - y.since);
};

/* 길이: 자주·보통·가끔 그림의 평균 칸(글자) 수, 처음 3세대 vs 최근 3세대 */
TF.lengths = function(k = 'grid'){
  const tier = TF.META.tier, by = t => Object.entries(TF.ID).filter(([en]) => tier[en] === t).map(([, id]) => id);
  const avg = (rows, t) => { const v = rows.flatMap(g => by(t).map(s => TF.word(k, s, g)).filter(Boolean).map(TF.nCells)); return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length); };
  return [3, 2, 1].map(t => ({t, first: avg(TF.GENS.slice(0, 3), t), last: avg(TF.GENS.slice(-3), t), ex: by(t).map(s => TF.NAME[s]).join('·')}));
};

/* 여정: 지난 세대 + 앞으로 올 세대(매일 07·19시) */
const KST = TF.KST = 9 * 3600e3;
TF.md = t => { const d = new Date(t + KST); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
TF.hour = t => new Date(t + KST).getUTCHours();
function buildTrip(){
  const END = Date.parse('2026-10-29T07:00:00+09:00');
  TF.MEET = Date.parse(TF.META.meet_at || '2026-10-22T00:00:00+09:00');
  const trip = TF.GENS.map(g => ({gen: g.gen, t: Date.parse(g.at), row: g}));
  const t0 = Date.parse(TF.LAST.at); let n = TF.LAST.gen;
  const d0 = new Date(t0 + KST); let day = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()) - KST;
  for (let i = 0; i < 40; i++) { for (const h of [7, 19]) { const s = day + h * 3600e3; if (s > t0 + 3600e3) trip.push({gen: ++n, t: s, row: null}); } day += 864e5; }
  TF.trip = trip; TF.END = END;
  TF.meetGen = TF.META.met_gen || (trip.find(x => x.t >= TF.MEET) || {}).gen;
  TF.endGen = (trip.filter(x => x.t <= END).pop() || trip[trip.length - 1]).gen;
  TF.nextSlot = trip.find(x => !x.row);
  TF.met = !!TF.META.met_gen;
}
TF.countdown = () => { if (!TF.nextSlot) return ''; let s = Math.max(0, Math.floor((TF.nextSlot.t - TF.now()) / 1000)); const h = Math.floor(s / 3600); s %= 3600; return `${h}:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
TF.dday = t => { const a = new Date(TF.now() + KST), b = new Date(t + KST); return Math.round((Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) - Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) / 864e5); };

/* 통한 비율 그래프 (SVG 문자열) */
TF.okChart = function(opt = {}){
  const W = opt.w || 640, H = opt.h || 300, X0 = 44, X1 = W - 16, Y0 = H - 30, Y1 = 14, n = TF.GENS.length;
  const x = i => X0 + (X1 - X0) * (n === 1 ? 0 : i / (n - 1)), y = v => Y0 - (Y0 - Y1) * v / 32;
  let h = '';
  for (const v of [0, 8, 16, 24, 32]) h += `<line x1="${X0}" x2="${X1}" y1="${y(v)}" y2="${y(v)}" stroke="#C7D0CA" stroke-width="1"/><text x="${X0 - 10}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="#5D6A63">${Math.round(v / 32 * 100)}%</text>`;
  h += `<line x1="${X0}" x2="${X1}" y1="${y(8)}" y2="${y(8)}" stroke="#9AA59F" stroke-width="2" stroke-dasharray="6 6"/>`;
  const cols = {line:'#2450D8', grid:'#0B8457', twin:'#8A3F9E'};
  for (const k of (opt.only || ['line','grid','twin'])) {
    const pts = TF.GENS.map((g, i) => `${x(i).toFixed(1)},${y(g.islands[k].ok).toFixed(1)}`).join(' ');
    h += `<polyline points="${pts}" fill="none" stroke="${cols[k]}" stroke-width="${opt.only ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"/>`;
    h += `<circle cx="${x(n - 1)}" cy="${y(TF.LAST.islands[k].ok)}" r="5" fill="${cols[k]}"/>`;
  }
  if (TF.meetGen && TF.meetGen <= TF.NOW) { const i = TF.GENS.findIndex(g => g.gen === TF.meetGen); h += `<line x1="${x(i)}" x2="${x(i)}" y1="${Y1}" y2="${Y0}" stroke="#13201A" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${x(i) + 6}" y="${Y1 + 12}" font-size="13" fill="#13201A">만남</text>`; }
  h += `<text x="${X0}" y="${H - 8}" font-size="13" fill="#5D6A63">1세대</text><text x="${X1}" y="${H - 8}" text-anchor="end" font-size="13" fill="#5D6A63">${TF.NOW}세대</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="세대별 통한 대화 비율">${h}</svg>`;
};

/* 글자 → 문자 이름 */
TF.scriptOf = c => { for (const v of Object.values(TF.META.islands)) for (const [ch, sc] of v.chars) if (ch === c) return sc; return null; };
TF.own = k => new Set(TF.META.islands[k].chars.map(([c]) => c));
TF.scriptsIn = w => [...new Set([...TF.glyphSet(w || '')].map(TF.scriptOf).filter(Boolean))];

/* 만남: 두 섬 사이 통한 비율, 남의 글자가 섞인 말, 만난 뒤 바뀐 단어 수 */
TF.meeting = function(){
  const mg = TF.META.met_gen; if (!mg) return null;
  const rows = TF.GENS.filter(g => g.gen >= mg && g.cross), before = TF.GENS.filter(g => g.gen < mg).pop();
  if (!rows.length) return null;
  const last3 = rows.slice(-3), per = r => r.cross.ok / r.cross.talks;
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const isl = {};
  for (const k of TF.ORDER) {
    const own = TF.own(k), now = TF.LAST.islands[k].words || {}, was = (before && before.islands[k].words) || {};
    const changed = TF.SIDS.filter(s => now[s] && was[s] && now[s] !== was[s]).length;
    const foreign = [...new Set(Object.values(now).flatMap(w => [...TF.glyphSet(w)]).filter(c => !own.has(c)))];
    isl[k] = {borrow: avg(TF.GENS.slice(-3).map(g => g.islands[k].borrow || 0)), changed, total: TF.SIDS.filter(s => now[s] && was[s]).length, foreign};
  }
  return {mg, rows, first: per(rows[0]), recent: avg(last3.map(per)), isl, days: rows.length};
};

TF.crossChart = function(opt = {}){
  const m = TF.meeting(); if (!m) return '';
  const W = opt.w || 560, H = opt.h || 240, X0 = 44, X1 = W - 16, Y0 = H - 30, Y1 = 14, n = m.rows.length;
  const x = i => X0 + (X1 - X0) * (n === 1 ? .5 : i / (n - 1)), y = v => Y0 - (Y0 - Y1) * v;
  let h = '';
  for (const v of [0, .25, .5, .75, 1]) h += `<line x1="${X0}" x2="${X1}" y1="${y(v)}" y2="${y(v)}" stroke="#C7D0CA"/><text x="${X0 - 10}" y="${y(v) + 4}" text-anchor="end" font-size="13" fill="#5D6A63">${v * 100}%</text>`;
  h += `<line x1="${X0}" x2="${X1}" y1="${y(.25)}" y2="${y(.25)}" stroke="#9AA59F" stroke-width="2" stroke-dasharray="6 6"/>`;
  const pts = m.rows.map((r, i) => `${x(i).toFixed(1)},${y(r.cross.ok / r.cross.talks).toFixed(1)}`).join(' ');
  h += `<polyline points="${pts}" fill="none" stroke="#13201A" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  m.rows.forEach((r, i) => { h += `<circle cx="${x(i)}" cy="${y(r.cross.ok / r.cross.talks)}" r="${i === n - 1 ? 6 : 3.5}" fill="#13201A"/>`; });
  h += `<text x="${X0}" y="${H - 8}" font-size="13" fill="#5D6A63">${m.mg}세대 · 만난 날</text><text x="${X1}" y="${H - 8}" text-anchor="end" font-size="13" fill="#5D6A63">${TF.NOW}세대</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="두 섬 사이 통한 대화 비율">${h}</svg>`;
};

/* 만남 카드 묶음 (발표·사이트 공용) */
TF.meetHTML = function(q = 22){
  const m = TF.meeting(); if (!m) return '';
  const pc = v => Math.round(v * 100);
  const card = k => { const r = m.isl[k], met = (TF.META.meet || []).includes(k);
    return `<div class="mrow" style="--k:${TF.COLOR[k]}"><div class="mh"><i></i><b>${TF.ISL[k]}</b><span>${met ? '만남' : '만나지 않음'}</span></div>
      <div class="mv"><span>남의 글자가 섞인 말</span><b>${pc(r.borrow)}%</b></div>
      <div class="mv"><span>만난 뒤 바뀐 단어</span><b>${r.changed}<small> / ${r.total}</small></b></div>
      <div class="mf">${r.foreign.length ? r.foreign.slice(0, 8).map(c => `<span class="g">${esc(c)}</span>`).join('') : '<em>빌린 글자 없음</em>'}</div></div>`; };
  return `<div class="meetx"><div class="mchart"><div class="mbig"><span>두 섬 사이 대화가 통한 비율</span><b>${pc(m.first)}% <i>→</i> ${pc(m.recent)}%</b><small>만난 날 → 최근 세 세대 평균</small></div>${TF.crossChart({w: 560, h: 210})}</div>
    <div class="mrows">${TF.ORDER.map(card).join('')}<p class="mnote">글자 섬과 비교 섬은 조건이 같아요. 둘의 차이만큼이 만남이 바꾼 거예요.</p></div></div>`;
};

/* 말이 나뉘어요: 처음 한 그림의 긴 말이 다른 그림으로 옮겨 간 경우 (예: 물 9칸 → 1칸, 바다가 9칸을 이어받음) */
TF.split = function(k = 'grid'){
  const F = TF.GENS[0], runs = s => { const out = []; for (const x of TF.lineage(k, s)) { if (!x.w) continue; if (!out.length || out[out.length - 1].w !== x.w) out.push({w: x.w, a: x.gen, b: x.gen}); else out[out.length - 1].b = x.gen; } return out; };
  for (const a of TF.SIDS) {
    const w0 = TF.word(k, a, F), wn = TF.word(k, a); if (!w0 || !wn || TF.nCells(wn) >= TF.nCells(w0)) continue;
    const b = TF.SIDS.find(s => s !== a && TF.word(k, s) === w0); if (!b) continue;
    const ra = runs(a), rb = runs(b);
    return {a, b, ra, rb, from: TF.nCells(w0), to: TF.nCells(wn), took: rb[rb.length - 1].a, shrank: ra[ra.length - 1].a};
  }
  return null;
};
TF.splitHTML = function(k = 'grid', q = 18){
  const sp = TF.split(k); if (!sp) return '';
  const N = TF.NAME, lane = (s, rs) => { const pick = rs.length > 2 ? [rs[0], rs[rs.length - 1]] : rs, more = rs.length - pick.length;
    return `<div class="lane"><div class="lp"><img src="img/${s}.png" alt="">${N[s]}</div>${pick.map((r, i) => `${i ? `<span class="la">${more ? `→ <small>${more}번 더 바뀜</small> →` : '→'}</span>` : ''}<div class="lc">${TF.wordHTML(r.w, k, q)}<b>${r.a === r.b ? r.a + '세대' : r.b === TF.NOW ? r.a + '세대~' : r.a + '–' + r.b + '세대'}</b></div>`).join('')}</div>`; };
  return `<div class="split">${lane(sp.a, sp.ra)}${lane(sp.b, sp.rb)}</div>`;
};

/* 한 단어의 일생: 세대마다 그 그림을 부른 말 (바뀐 세대만 진하게) */
TF.lineage = function(k, s){
  let prev; return TF.GENS.map(g => { const w = TF.word(k, s, g); const ch = w !== prev; prev = w; return {gen: g.gen, w, changed: ch, ok: g.islands[k].ok}; });
};
})();
