/* 선과 점 섬 화면. 데이터: data/dots/ (summary.json, likeness.json). ?d=다른/경로/ 로 바꿀 수 있음 */
(async function(){
const $ = s => document.querySelector(s);
const D = new URLSearchParams(location.search).get('d') || 'data/dots/';
const get = u => fetch(D + u, {cache: 'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
const [S, L] = await Promise.all([get('summary.json'), get('likeness.json')]);
if (!S || !S.gens.length) { $('#heroP').insertAdjacentHTML('afterend', '<p class="note">아직 실행 결과가 없어요. 첫 시험 실행이 끝나면 여기에 나타나요.</p>'); return; }
const G = S.gens, NOW = G[G.length - 1].gen, K = Object.keys(S.meta.islands), NM = S.meta.islands;
const SC = S.meta.scenes, NAME = {}; for (const [en, id] of Object.entries(SC)) NAME[id] = GL.KO[en] || en;
const SIDS = Object.values(SC), COL = {d1: 'var(--d1)', d2: 'var(--d2)', d3: 'var(--d3)'};
const pct = v => Math.round(v * 100), esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const LK = L ? Object.fromEntries(L.gens.map(g => [g.gen, g.islands])) : {};
const lkOf = (gen, k, sid) => (((LK[gen] || {})[k] || {}).words || {})[sid] || [];

$('#st').textContent = `점 섬 ${NOW}세대 · ${new Date(G[G.length - 1].at).toLocaleDateString('ko-KR', {month: 'numeric', day: 'numeric'})}`;
$('#ruleSvg').innerHTML = `<span style="display:inline-grid;grid-template-columns:repeat(3,26px);gap:10px;font:600 13px var(--mono);color:var(--t3);text-align:center">${'123456789'.split('').map(d => `<span>${d}</span>`).join('')}</span>` + GL.mark('15.59', 96, {color: 'var(--ink)'}) + GL.mark('13.37.79', 96, {color: 'var(--ink)'});
$('#model').textContent = `모델 ${S.meta.model || ''} · 섬마다 AI 4명 · 세대마다 32판`;

/* 섬별 성공률 */
$('#isls').innerHTML = K.map(k => {
  const v = G.map(g => g.islands[k].ok / g.islands[k].talks), W = 320, H = 90, x = i => 6 + i / Math.max(1, v.length - 1) * (W - 12), y = p => H - 8 - p * (H - 16);
  const path = v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('');
  return `<div class="cd" style="--c:${COL[k]}"><div class="ih"><i></i>${NM[k]}<span>${pct(v[v.length - 1])}%</span></div><p class="cap">1세대 ${pct(v[0])}% → ${NOW}세대 ${pct(v[v.length - 1])}%</p><svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="6" x2="${W - 6}" y1="${y(.25)}" y2="${y(.25)}" stroke="#D9DED7" stroke-dasharray="3 4"/><path d="${path}" fill="none" stroke="${COL[k]}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>`; }).join('');

/* 그림마다 지금의 글자 */
const last = G[G.length - 1];
$('#words').innerHTML = `<tr><th>그림</th>${K.map(k => `<th style="color:${COL[k]}">${NM[k]}</th>`).join('')}</tr>` + SIDS.map(sid => `<tr><td class="sc"><img src="img/${sid}.png" alt="">${NAME[sid]}</td>${K.map(k => { const w = last.islands[k].words[sid], lk = lkOf(NOW, k, sid);
  return `<td>${GL.msg(w, 40, {color: 'var(--ink)'})}${lk.length ? `<span class="lk${lk.some(x => x.sim >= .8) ? ' hi' : ''}">${lk.map(x => `닮은 글자 <b>${esc(x.char)}</b> ${x.sim.toFixed(2)}`).join(' · ')}</span>` : ''}</td>`; }).join('')}</tr>`).join('');

/* 한 그림의 변화 */
let cur = SC.forest || SIDS[0];
function drawLin(){
  $('#pick').innerHTML = SIDS.map(s => `<button aria-pressed="${s === cur}" data-s="${s}"><img src="img/${s}.png" alt="">${NAME[s]}</button>`).join('');
  $('#lin').innerHTML = K.map(k => { let prev = null;
    return `<div class="row" style="--c:${COL[k]}"><b>${NM[k]}</b><div class="cells">${G.map(g => { const w = g.islands[k].words[cur], ch = w && w !== prev; prev = w || prev;
      return `<div class="cell${ch ? ' ch' : ''}">${GL.msg(w, 30, {color: 'var(--ink)'})}<small>${g.gen}</small></div>`; }).join('')}</div></div>`; }).join('');
}
$('#pick').onclick = e => { const b = e.target.closest('button'); if (b) { cur = b.dataset.s; drawLin(); } };
drawLin();

/* 새로운가 */
if (L) {
  const W = 560, H = 240, gens = L.gens.map(g => g.gen), x = g => 40 + (g - gens[0]) / Math.max(1, gens[gens.length - 1] - gens[0]) * (W - 60), y = v => H - 28 - v * (H - 48);
  let h = '';
  for (const v of [0, .5, 1]) h += `<line x1="40" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="#E8EBE5"/><text x="4" y="${y(v) + 4}" font-size="11" fill="#5B6560">${v.toFixed(1)}</text>`;
  const b = L.baseline;
  if (b) h += `<line x1="40" x2="${W - 20}" y1="${y(b.mean)}" y2="${y(b.mean)}" stroke="#6E7671" stroke-dasharray="4 4"/><text x="${W - 20}" y="${y(b.mean) - 6}" font-size="11" fill="#5B6560" text-anchor="end">아무렇게나 그은 글자 ${b.mean.toFixed(2)}</text>`;
  for (const k of K) h += `<path d="${L.gens.map((g, i) => `${i ? 'L' : 'M'}${x(g.gen).toFixed(1)},${y(g.islands[k].mean || 0).toFixed(1)}`).join('')}" fill="none" stroke="${getComputedStyle(document.body).getPropertyValue('--' + k)}" stroke-width="2.5"/>`;
  for (const g of [gens[0], gens[gens.length - 1]]) h += `<text x="${x(g)}" y="${H - 8}" font-size="11" fill="#5B6560" text-anchor="middle">${g}세대</text>`;
  $('#lchart').setAttribute('viewBox', `0 0 ${W} ${H}`); $('#lchart').innerHTML = h;
  $('#lgd').innerHTML = K.map(k => `<span style="--c:${COL[k]}"><i></i>${NM[k]} 평균 닮음</span>`).join('') + '<span style="--c:#6E7671"><i style="background:none;border-top:2px dashed #6E7671;height:0"></i>우연 기준</span>';
  const all = []; const lg = L.gens[L.gens.length - 1];
  for (const k of K) for (const [sid, arr] of Object.entries(lg.islands[k].words)) for (const x2 of arr) all.push({...x2, k, sid});
  const uniq = Object.values(Object.fromEntries(all.filter(a => a.mark.includes('.')).map(a => [a.mark + a.k, a])));  // 획 하나짜리는 원래 기호와 같아서 뺌
  const row = a => `<div class="it">${GL.mark(a.mark, 40, {color: 'var(--ink)'})}<div><b>${NAME[a.sid]}</b> <span>· ${NM[a.k]}</span><br><span>닮은 글자: ${a.script}</span></div><span class="ref" title="${a.script}">${esc(a.char)}</span></div>`;
  $('#top5').innerHTML = [...uniq].sort((a, b) => b.sim - a.sim).slice(0, 4).map(a => row(a).replace('</div><span', ` · ${a.sim.toFixed(2)}</div><span`)).join('');
  $('#low5').innerHTML = [...uniq].sort((a, b) => a.sim - b.sim).slice(0, 4).map(a => row(a).replace('</div><span', ` · ${a.sim.toFixed(2)}</div><span`)).join('');
  $('#method').innerHTML = `<b>재는 법 (시안)</b> — 글자를 그림으로 그린 뒤, 라틴·숫자·그리스·키릴·한글 자모·룬·간단한 한자·기호 ${L.refs}자와 하나씩 겹쳐 본다. 크기와 굵기 차이를 없애려고 둘 다 상자에 맞춰 늘리고 1px 뼈대만 남긴 다음, 뼈대끼리의 평균 거리로 닮음(0–1)을 낸다. 비교 기준: 같은 규칙으로 아무렇게나 그은 글자 ${b ? b.n : 300}개의 평균 닮음 ${b ? b.mean.toFixed(2) : '-'}. 획 하나짜리 글자는 ‘/’ ‘一’ ‘|’ 같은 기호와 원래 똑같아서 높게 나온다.`;
}
})();
