/* 선과 점 섬 화면. 데이터: data/dots/ (summary.json, likeness.json). ?d=다른/경로/ 로 바꿀 수 있음
   본 운영(11세대~)은 점 섬 3만. meta.islands = 지금 도는 섬, meta.paused = 시험 10세대에서 멈춘 섬 */
(async function(){
const $ = s => document.querySelector(s);
const D = new URLSearchParams(location.search).get('d') || 'data/dots/';
const get = u => fetch(D + u, {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
const [S, L] = await Promise.all([get('summary.json'), get('likeness.json')]);
if (!S || !S.gens.length) { $('#heroP').insertAdjacentHTML('afterend', '<p class="note">아직 실행 결과가 없어요.</p>'); return; }
const G = S.gens, NOW = G[G.length - 1].gen, M = S.meta, TR = M.trial_gens || 10;
const K = Object.keys(M.islands), P = Object.keys(M.paused || {}), NM = {...Object.fromEntries(P.map(k => [k, M.paused[k].ko])), ...M.islands};
const k0 = K[0];
const SC = M.scenes, NAME = {}; for (const [en, id] of Object.entries(SC)) NAME[id] = GL.KO[en] || en;
const SIDS = Object.values(SC), COL = {d1: 'var(--d1)', d2: 'var(--d2)', d3: 'var(--d3)'};
const pct = v => Math.round(v * 100), esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const LK = L ? Object.fromEntries(L.gens.map(g => [g.gen, g.islands])) : {};
const lkOf = (gen, k, sid) => (((LK[gen] || {})[k] || {}).words || {})[sid] || [];
const rows = k => G.filter(g => g.islands[k]);           // 그 섬이 돈 세대들
const lastOf = k => { const r = rows(k); return r[r.length - 1]; };
const live = NOW > TR;

$('#kk').textContent = live ? `기말 실험 · 본 운영 · ${NM[k0]}` : '기말 실험 · 시험 운영';
$('#st').textContent = `${NM[k0]} ${NOW}세대 · ${new Date(G[G.length - 1].at).toLocaleDateString('ko-KR', {month: 'numeric', day: 'numeric'})}`;
$('#ruleSvg').innerHTML = `<span style="display:inline-grid;grid-template-columns:repeat(3,26px);gap:10px;font:600 13px var(--mono);color:var(--t3);text-align:center">${'123456789'.split('').map(d => `<span>${d}</span>`).join('')}</span>` + GL.mark('15.59', 96, {color: 'var(--ink)'}) + GL.mark('13.37.79', 96, {color: 'var(--ink)'});
$('#model').textContent = `모델 ${M.model || ''} · AI 4명 · 세대마다 32판`;

/* 성공률: 본 섬 크게, 멈춘 섬 작게 */
function spark(k, W, H, cls, trialBand){
  const r = rows(k), v = r.map(g => g.islands[k].ok / g.islands[k].talks), n = Math.max(NOW, 2);
  const x = gen => 6 + (gen - 1) / (n - 1) * (W - 12), y = p => H - 8 - p * (H - 16);
  const path = r.map((g, i) => `${i ? 'L' : 'M'}${x(g.gen).toFixed(1)},${y(v[i]).toFixed(1)}`).join('');
  const band = trialBand && live ? `<rect x="${x(1)}" y="0" width="${x(TR) - x(1)}" height="${H}" fill="#E8EBE5" opacity=".6"/>` : '';
  return {v, svg: `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${band}<line x1="6" x2="${W - 6}" y1="${y(.25)}" y2="${y(.25)}" stroke="#D9DED7" stroke-dasharray="3 4"/><path d="${path}" fill="none" stroke="${COL[k]}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`};
}
{ const s = spark(k0, 640, 160, 'big-spark', true), r = rows(k0);
  $('#main').style.setProperty('--c', COL[k0]);
  $('#main').innerHTML = `<div class="ih"><i></i>${NM[k0]}<span>${pct(s.v[s.v.length - 1])}%</span></div><p class="cap">1세대 ${pct(s.v[0])}% → ${live ? `시험 끝 ${TR}세대 ${pct(s.v[TR - 1])}% → ` : ''}${NOW}세대 ${pct(s.v[s.v.length - 1])}% · 본 운영 ${Math.max(0, NOW - TR)}세대째</p>${s.svg}`; }
$('#trial').innerHTML = P.map(k => { const s = spark(k, 320, 70, 'spark', false);
  return `<div class="cd" style="--c:${COL[k]}"><div class="ih"><i></i>${NM[k]}<span>${pct(s.v[s.v.length - 1])}%</span></div><p class="cap">시험 운영 ${M.paused[k].last}세대에서 멈춤 · 1세대 ${pct(s.v[0])}%</p>${s.svg}</div>`; }).join('') || '<p class="cap">멈춘 섬 없음</p>';

/* 문자 한 벌: 지금 쓰는 서로 다른 글자 */
const cur0 = lastOf(k0).islands[k0].words, marks = {};
for (const sid of SIDS) for (const m of (cur0[sid] || '').split(' ').filter(Boolean)) (marks[m] = marks[m] || {m, sids: [], n: 0}).n++, marks[m].sids.includes(sid) || marks[m].sids.push(sid);
const has = (g, m) => Object.values(g.islands[k0].words).some(w => w.split(' ').includes(m));
for (const o of Object.values(marks)) { const r = rows(k0); let i = r.length - 1; while (i > 0 && has(r[i - 1], o.m)) i--; o.born = r[i].gen; }
const SET = Object.values(marks).sort((a, b) => b.sids.length - a.sids.length || a.born - b.born);
$('#set').innerHTML = SET.map(o => `<div class="g">${GL.mark(o.m, 64, {color: 'var(--ink)'})}<b>${o.sids.map(s => NAME[s]).join(' · ')}</b><small>${o.born}세대~${o.n > o.sids.length ? ` · ×${o.n}` : ''}</small></div>`).join('')
  + `<p class="cap" style="grid-column:1/-1">${NOW}세대 기준 ${SET.length}자 · 말 ${SIDS.length}개</p>`;

/* 그림마다 지금의 말 */
const since = (k, sid) => { const r = rows(k), w = lastOf(k).islands[k].words[sid]; let i = r.length - 1; while (i > 0 && r[i - 1].islands[k].words[sid] === w) i--; return r[i].gen; };
$('#words').innerHTML = `<tr><th>그림</th><th style="color:${COL[k0]}">${NM[k0]} · ${NOW}세대</th>${P.map(k => `<th class="old" style="color:${COL[k]}">${NM[k]} · ${M.paused[k].last}세대</th>`).join('')}</tr>`
  + SIDS.map(sid => { const w = lastOf(k0).islands[k0].words[sid], lk = lkOf(lastOf(k0).gen, k0, sid);
    return `<tr><td class="sc"><img src="img/${sid}.png" alt="">${NAME[sid]}</td><td>${GL.msg(w, 40, {color: 'var(--ink)'})}<span class="lk${lk.some(x => x.sim >= .8) ? ' hi' : ''}">${w ? `${since(k0, sid)}세대부터` : ''}${lk.length ? ' · ' + lk.map(x => `닮은 글자 <b>${esc(x.char)}</b> ${x.sim.toFixed(2)}`).join(' · ') : ''}</span></td>`
      + P.map(k => `<td class="old">${GL.msg(lastOf(k).islands[k].words[sid], 32, {color: 'var(--ink)'})}</td>`).join('') + '</tr>'; }).join('');

/* 한 그림의 변화 */
let cur = SC.forest || SIDS[0];
function drawLin(){
  $('#pick').innerHTML = SIDS.map(s => `<button aria-pressed="${s === cur}" data-s="${s}"><img src="img/${s}.png" alt="">${NAME[s]}</button>`).join('');
  $('#lin').innerHTML = [...K, ...P].map(k => { let prev = null;
    return `<div class="row" style="--c:${COL[k]}${P.includes(k) ? ';opacity:.6' : ''}"><b>${NM[k]}</b><div class="cells">${rows(k).map(g => { const w = g.islands[k].words[cur], ch = w && w !== prev; prev = w || prev;
      return `<div class="cell${ch ? ' ch' : ''}">${GL.msg(w, 30, {color: 'var(--ink)'})}<small>${g.gen}</small></div>`; }).join('')}</div></div>`; }).join('');
}
$('#pick').onclick = e => { const b = e.target.closest('button'); if (b) { cur = b.dataset.s; drawLin(); } };
drawLin();

/* 새로운가 */
if (L) {
  const W = 560, H = 240, g1 = L.gens[0].gen, gN = L.gens[L.gens.length - 1].gen, x = g => 40 + (g - g1) / Math.max(1, gN - g1) * (W - 60), y = v => H - 28 - v * (H - 48);
  let h = '';
  if (gN > TR) h += `<rect x="${x(g1)}" y="0" width="${x(TR) - x(g1)}" height="${H - 24}" fill="#F0F2EE"/>`;
  for (const v of [0, .5, 1]) h += `<line x1="40" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="#E8EBE5"/><text x="4" y="${y(v) + 4}" font-size="11" fill="#5B6560">${v.toFixed(1)}</text>`;
  const b = L.baseline;
  if (b) h += `<line x1="40" x2="${W - 20}" y1="${y(b.mean)}" y2="${y(b.mean)}" stroke="#6E7671" stroke-dasharray="4 4"/><text x="${W - 20}" y="${y(b.mean) - 6}" font-size="11" fill="#5B6560" text-anchor="end">아무렇게나 그은 글자 ${b.mean.toFixed(2)}</text>`;
  const css = getComputedStyle(document.body);
  for (const k of [...P, ...K]) { const gs = L.gens.filter(g => g.islands[k] && g.islands[k].mean != null);
    h += `<path d="${gs.map((g, i) => `${i ? 'L' : 'M'}${x(g.gen).toFixed(1)},${y(g.islands[k].mean).toFixed(1)}`).join('')}" fill="none" stroke="${css.getPropertyValue('--' + k)}" stroke-width="${K.includes(k) ? 2.5 : 1.5}" opacity="${K.includes(k) ? 1 : .45}"/>`; }
  for (const g of [...new Set([g1, gN > TR ? TR : null, gN].filter(Boolean))]) h += `<text x="${x(g)}" y="${H - 8}" font-size="11" fill="#5B6560" text-anchor="middle">${g}세대</text>`;
  $('#lchart').setAttribute('viewBox', `0 0 ${W} ${H}`); $('#lchart').innerHTML = h;
  $('#lgd').innerHTML = K.map(k => `<span style="--c:${COL[k]}"><i></i>${NM[k]} 평균 닮음</span>`).join('') + (P.length ? `<span style="--c:#B9C0B7"><i></i>점 섬 1·2 (시험)</span>` : '') + '<span style="--c:#6E7671"><i style="background:none;border-top:2px dashed #6E7671;height:0"></i>우연 기준</span>';
  const lg = L.gens.filter(g => g.islands[k0]).pop(), all = [];
  for (const [sid, arr] of Object.entries(lg.islands[k0].words)) for (const x2 of arr) all.push({...x2, sid});
  const uniq = Object.values(Object.fromEntries(all.filter(a => a.mark.includes('.')).map(a => [a.mark, a])));  // 획 하나짜리는 원래 기호와 같아서 뺌
  const row = a => `<div class="it">${GL.mark(a.mark, 40, {color: 'var(--ink)'})}<div><b>${NAME[a.sid]}</b> <span>· ${a.sim.toFixed(2)}</span><br><span>닮은 글자: ${a.script}</span></div><span class="ref" title="${a.script}">${esc(a.char)}</span></div>`;
  $('#top5').innerHTML = [...uniq].sort((a, b) => b.sim - a.sim).slice(0, 4).map(row).join('');
  $('#low5').innerHTML = [...uniq].sort((a, b) => a.sim - b.sim).slice(0, 4).map(row).join('');
  const m0 = lg.islands[k0].mean;
  $('#method').innerHTML = `<b>${NM[k0]} ${lg.gen}세대 평균 닮음 ${m0 != null ? m0.toFixed(2) : '-'}</b> (우연 기준 ${b ? b.mean.toFixed(2) : '-'}) — 본 운영의 핵심은 이 값이 세대가 지나며 내려가는지다.<br><b>재는 법</b> — 글자를 그림으로 그린 뒤, 라틴·숫자·그리스·키릴·한글 자모·룬·간단한 한자·기호 ${L.refs}자와 하나씩 겹쳐 본다. 크기와 굵기 차이를 없애려고 둘 다 상자에 맞춰 늘리고 1px 뼈대만 남긴 다음, 뼈대끼리의 평균 거리로 닮음(0–1)을 낸다. 비교 기준은 같은 규칙으로 아무렇게나 그은 글자 ${b ? b.n : 300}개. 획 하나짜리 글자는 ‘/’ ‘一’ ‘|’ 같은 기호와 원래 똑같아서 높게 나온다. 세대마다 자동으로 다시 잰다.`;
}
})();
