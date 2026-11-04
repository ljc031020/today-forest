/* 선과 점 섬 글자 그리기 — '15.59 13.37' (글자는 공백, 획은 점) → SVG */
window.GL = (function(){
  const KO = {water:'물',fire:'불',tree:'나무',person:'사람',mountain:'산',house:'집',sea:'바다',forest:'숲',village:'마을',volcano:'화산','big fire':'큰 불',crowd:'군중'};
  const P = d => { const i = '123456789'.indexOf(d); return [i % 3, Math.floor(i / 3)]; };
  function mark(m, s = 48, o = {}){
    const col = o.color || 'currentColor', pad = s * (o.pad ?? .2), g = (s - 2 * pad) / 2, w = o.w || Math.max(2, s * .085);
    const xy = d => P(d).map(v => pad + v * g);
    let h = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true">`;
    if (o.bg) h += `<rect width="${s}" height="${s}" rx="${s * .14}" fill="${o.bg}"/>`;
    if (o.dots !== false) for (const d of '123456789') { const [x, y] = xy(d); h += `<circle cx="${x}" cy="${y}" r="${Math.min(Math.max(1.2, s * .028), w * .42)}" fill="${o.dotColor || '#C4CAC2'}"/>`; }
    for (const st of m.split('.')) { const [x1, y1] = xy(st[0]), [x2, y2] = xy(st[1]); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; }
    return h + '</svg>';
  }
  const msg = (w, s, o) => w ? `<span class="gl">${w.split(' ').map(m => mark(m, s, o)).join('')}</span>` : '<span class="cap">—</span>';
  return {KO, mark, msg};
})();
