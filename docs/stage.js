/* 오늘의 숲 — 대화 무대. 대화 한 번을 '말하기 → 고르기 → 통했나' 순서로 보여준다.
   기록 재생(replay)과 실시간(live, 노트북에서 engine/live.py 실행 시) 두 가지 원천을 쓴다. */
(function(){
const FS = window.ForestStage = {};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
FS.esc = esc; FS.sleep = sleep;

FS.load = async function(){
  const S = await (await fetch('data/summary.json', {cache:'no-store'})).json();
  const SCRIPT = {};
  for (const k in S.meta.islands) for (const [c, s] of S.meta.islands[k].chars) SCRIPT[c] = s;
  FS.S = S; FS.META = S.meta; FS.SCRIPT = SCRIPT;
  return S;
};
FS.gen = async function(n){
  FS._g = FS._g || {};
  if (!FS._g[n]) FS._g[n] = fetch(`data/gens/g${String(n).padStart(3,'0')}.json`, {cache:'no-store'}).then(r => r.json());
  return FS._g[n];
};
FS.body = k => FS.META.islands[k].body;
FS.ko = k => k === 'cross' ? '두 섬 사이' : FS.META.islands[k].ko;
FS.glyph = c => `<span class="s-${FS.SCRIPT[c] || 'x'}">${esc(c)}</span>`;
FS.glyphs = function(w, body){
  if (w == null) return '<span class="none">—</span>';
  if (body === 'grid') return '<span class="grid3">' + [...w].map(c => c === '.' ? '<i></i>' : `<i class="s-${FS.SCRIPT[c]||'x'}">${esc(c)}</i>`).join('') + '</span>';
  return '<span class="g">' + [...w].map(FS.glyph).join('') + '</span>';
};

/* ── 실시간 연결 확인 ── */
FS.livePing = async function(){
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
  try { const r = await fetch('/api/ping', {cache:'no-store'}); const j = await r.json(); return j.key ? j : null; }
  catch(e) { return null; }
};

/* ── 무대 ── */
FS.Stage = class {
  constructor(el, opt = {}){
    this.el = el; this.speed = opt.speed || 1; this.hist = []; this.token = 0;
    el.classList.add('stg');
    el.innerHTML = `
      <div class="stg-head"><span class="stg-where"></span><span class="stg-mode"></span></div>
      <div class="stg-main">
        <div class="stg-speak"><div class="stg-who"></div><div class="stg-msg"></div></div>
        <div class="stg-arrow" aria-hidden="true">→</div>
        <div class="stg-listen"><div class="stg-who"></div><div class="stg-cands"></div></div>
      </div>
      <div class="stg-foot"><span class="stg-tally"></span><div class="stg-hist"></div></div>`;
    this.q = s => el.querySelector(s);
  }
  setMode(text, live){ const m = this.q('.stg-mode'); m.textContent = text; m.classList.toggle('live', !!live); }
  reset(){ this.hist = []; this.renderHist(); this.q('.stg-msg').innerHTML = ''; this.q('.stg-cands').innerHTML = ''; this.q('.stg-speak .stg-who').textContent=''; this.q('.stg-listen .stg-who').textContent=''; }
  wait(ms){ return sleep(ms / this.speed); }
  thinking(rec){
    this.q('.stg-where').textContent = rec ? `${FS.ko(rec.from)} → ${FS.ko(rec.to)}` : '';
    this.q('.stg-speak .stg-who').innerHTML = '말할 AI가 생각하는 중<span class="dots"><b>.</b><b>.</b><b>.</b></span>';
    this.q('.stg-listen .stg-who').textContent = '';
    this.q('.stg-msg').innerHTML = ''; this.q('.stg-cands').innerHTML = '';
    this.el.classList.remove('is-ok','is-no');
  }
  async speak(rec){
    const tk = this.token;
    const body = FS.body(rec.from);
    this.el.classList.remove('is-ok','is-no');
    this.q('.stg-where').textContent = `${FS.ko(rec.from)}${rec.from !== rec.to ? ' → ' + FS.ko(rec.to) : ''}`;
    this.q('.stg-speak .stg-who').innerHTML = `${rec.from !== rec.to ? `<small>${esc(FS.ko(rec.from))}</small> ` : ''}<b>AI #${rec.sp}</b>가 이 그림을 말한다`;
    const msg = this.q('.stg-msg');
    msg.innerHTML = `<img class="stg-target" src="img/${rec.scene}.png" alt="">` +
      (body === 'grid' ? '<span class="grid3">' + '<i></i>'.repeat(9) + '</span>' : '<span class="g"></span>');
    this.q('.stg-listen .stg-who').textContent = '';
    this.q('.stg-cands').innerHTML = (rec.cands || []).map(c => `<img data-s="${c}" src="img/${c}.png" alt="">`).join('');
    this.q('.stg-cands').classList.add('dim');
    await this.wait(500);
    if (body === 'grid') {
      const cells = msg.querySelectorAll('.grid3 i');
      for (let i = 0; i < 9; i++) { if (tk !== this.token) return; const c = rec.msg[i]; if (c !== '.') { cells[i].className = 's-' + (FS.SCRIPT[c]||'x') + ' pop'; cells[i].textContent = c; await this.wait(170); } }
    } else {
      const g = msg.querySelector('.g');
      for (const c of rec.msg) { if (tk !== this.token) return; g.insertAdjacentHTML('beforeend', `<span class="s-${FS.SCRIPT[c]||'x'} pop">${esc(c)}</span>`); await this.wait(220); }
    }
  }
  listening(rec){
    this.q('.stg-cands').classList.remove('dim');
    this.q('.stg-listen .stg-who').innerHTML = `${rec.from !== rec.to ? `<small>${esc(FS.ko(rec.to))}</small> ` : ''}<b>AI #${rec.li}</b>가 고르는 중<span class="dots"><b>.</b><b>.</b><b>.</b></span>`;
  }
  async result(rec){
    const tk = this.token;
    this.listening(rec);
    const imgs = [...this.q('.stg-cands').querySelectorAll('img')];
    for (let r = 0; r < 2; r++) for (const im of imgs) { if (tk !== this.token) return; im.classList.add('scan'); await this.wait(110); im.classList.remove('scan'); }
    const pick = imgs.find(i => i.dataset.s === rec.guess);
    if (pick) pick.classList.add('pick');
    this.q('.stg-listen .stg-who').innerHTML = `<b>AI #${rec.li}</b>가 골랐다`;
    await this.wait(550);
    imgs.forEach(i => { if (i.dataset.s === rec.scene) i.classList.add('target'); });
    this.el.classList.add(rec.ok ? 'is-ok' : 'is-no');
    this.q('.stg-listen .stg-who').innerHTML = rec.ok ? '<b class="ok">✓ 통했다</b>' : '<b class="no">✗ 안 통했다</b>';
    this.hist.push(rec); this.renderHist();
    await this.wait(1500);
  }
  renderHist(){
    const n = this.hist.length, ok = this.hist.filter(r => r.ok).length;
    this.q('.stg-tally').textContent = n ? `${n}번 중 ${ok}번 통함` : '';
    this.q('.stg-hist').innerHTML = this.hist.slice(-14).map(r =>
      `<span class="chip ${r.ok ? 'ok' : 'no'}" title="${esc(FS.ko(r.from))}"><img src="img/${r.scene}.png" alt="">${r.msg ? FS.glyphs(r.msg, FS.body(r.from)) : '·'}</span>`).join('');
  }
  stop(){ this.token++; }

  /* 기록 재생: 해당 세대의 대화를 차례로 */
  async replay(gen, island, opt = {}){
    const tk = ++this.token; this.reset();
    const G = await FS.gen(gen);
    let talks = island === 'cross' ? ((G.cross || {}).talks || []) : G.islands[island].talks;
    talks = talks.map(t => ({from: island, to: island, ...t})).filter(t => t.msg);
    if (!talks.length) { this.q('.stg-speak .stg-who').textContent = island === 'cross' ? '아직 두 섬이 만나지 않았다.' : '기록이 없다.'; return; }
    this.setMode(`기록 재생 · ${gen}세대`, false);
    let i = opt.start || 0;
    while (tk === this.token) {
      const rec = talks[i % talks.length];
      this.thinking(rec); await this.wait(350); if (tk !== this.token) return;
      await this.speak(rec); if (tk !== this.token) return;
      await this.wait(400); await this.result(rec);
      i++;
      if (i % talks.length === 0) { if (!opt.loop) return; this.hist = []; this.renderHist(); }
    }
  }

  /* 실시간: 노트북의 engine/live.py가 새 대화를 만들면 바로 보여준다 */
  async live(island, n, onFail){
    const tk = ++this.token; this.reset();
    this.setMode('● 실시간 · 지금 만드는 중', true);
    const queue = []; let done = false, failed = null, wake = null;
    const es = new EventSource(`/api/live?island=${island}&n=${n}`);
    es.onmessage = e => { const d = JSON.parse(e.data); if (d.kind === 'done') { done = true; es.close(); } else if (d.kind === 'error') { failed = d.why; es.close(); } else queue.push(d); wake && wake(); };
    es.onerror = () => { if (!done) failed = failed || '연결 끊김'; es.close(); wake && wake(); };
    const next = () => new Promise(r => { if (queue.length || done || failed) r(); else wake = r; });
    this.thinking({from: island === 'cross' ? FS.META.meet[0] : island, to: island === 'cross' ? FS.META.meet[1] : island});
    while (tk === this.token) {
      await next(); wake = null;
      if (tk !== this.token) { es.close(); return; }
      if (!queue.length) { if (failed && onFail) onFail(failed); break; }
      const d = queue.shift();
      if (d.kind === 'speak') { await this.speak(d); }
      else if (d.kind === 'result') {
        if (d.msg) await this.result(d);
        if (!done && !failed) this.thinking(d);
      }
    }
    if (tk === this.token) this.setMode('● 실시간 · 이번 차례 끝', true);
  }
};
})();
