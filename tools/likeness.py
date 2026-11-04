"""선과 점 섬 — '새로운가' 재기: AI가 만든 글자가 사람의 문자를 얼마나 닮았는지.

방법 (시안)
1. 글자(획 목록)를 그림으로 그린다. 기존 문자 약 250자(라틴·숫자·그리스·키릴·한글 자모·룬·간단한 한자·기호)도 글꼴로 그린다.
2. 둘 다 잉크가 있는 영역만 잘라 같은 크기 상자에 비율을 지켜 넣고, 뼈대(1px 선)만 남긴다. → 굵기·크기 차이를 없앤다.
3. 뼈대끼리 서로 가장 가까운 점까지의 평균 거리(대칭 챔퍼 거리)를 잰다. 닮음 = exp(-거리/τ), 1이면 똑같음.
4. 기존 문자 중 가장 닮은 글자와 그 닮음 값을 기록한다.
사용: python tools/likeness.py <dots 데이터 폴더> [--fonts 폴더]
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt
from skimage.morphology import skeletonize

S = 96          # 비교 상자
PAD = 8
TAU = 6.0       # 픽셀 거리 → 닮음 변환 폭

REF = [
    ('라틴', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    ('숫자', '0123456789'),
    ('그리스', 'ΓΔΘΛΞΠΣΦΨΩ'),
    ('키릴', 'БГДЖЗИЛПФЦЧШЩЭЮЯ'),
    ('한글 자모', 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣㅐㅔ'),
    ('룬', ''.join(chr(c) for c in range(0x16A0, 0x16EB))),
    ('한자', '一二三十人入八工土王山口日中大小上下木川丁七乂文'),
    ('기호', '+−×=<>/\\|^∧∨△▽□◇#※⊥∠'),
]
FONTS = {
    'default': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '한글 자모': ('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 1),
    '한자': ('/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc', 1),
    '룬': None,  # --fonts 폴더의 runic.ttf
}


def normalize(img):
    a = np.array(img) > 127
    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        return None
    crop = Image.fromarray((a[ys.min():ys.max() + 1, xs.min():xs.max() + 1] * 255).astype(np.uint8))
    w, h = crop.size
    side = S - 2 * PAD
    # 가로세로 비율 차이(좁은 L ↔ 네모난 격자 글자)는 무시하고 상자에 꽉 채운다. 단, 한 줄짜리처럼 아주 납작한 건 비율 유지
    if min(w, h) / max(w, h) < 0.2:
        k = side / max(w, h); nw, nh = max(1, round(w * k)), max(1, round(h * k))
    else:
        nw = nh = side
    crop = crop.resize((nw, nh), Image.BILINEAR)
    can = Image.new('L', (S, S), 0)
    can.paste(crop, ((S - crop.size[0]) // 2, (S - crop.size[1]) // 2))
    sk = skeletonize(np.array(can) > 96)
    return sk if sk.any() else (np.array(can) > 96)


def glyph_img(mark, size=300, width=18):
    pos = {d: (50 + (i % 3) * 100, 50 + (i // 3) * 100) for i, d in enumerate('123456789')}
    im = Image.new('L', (size, size), 0); dr = ImageDraw.Draw(im)
    for s in mark.split('.'):
        dr.line([pos[s[0]], pos[s[1]]], fill=255, width=width)
    return im


def char_img(ch, font, size=300):
    im = Image.new('L', (size, size), 0); dr = ImageDraw.Draw(im)
    dr.text((size / 2, size / 2), ch, font=font, fill=255, anchor='mm')
    return im


def chamfer(a, b):
    da, db = distance_transform_edt(~a), distance_transform_edt(~b)
    return (db[a].mean() + da[b].mean()) / 2


def load_refs(font_dir):
    refs = []
    for script, chars in REF:
        spec = FONTS.get(script, FONTS['default'])
        if script == '룬':
            path = os.path.join(font_dir or '', 'runic.ttf')
            if not os.path.exists(path):
                continue
            font = ImageFont.truetype(path, 200)
        elif isinstance(spec, tuple):
            font = ImageFont.truetype(spec[0], 200, index=spec[1])
        else:
            font = ImageFont.truetype(spec, 200)
        for ch in chars:
            n = normalize(char_img(ch, font))
            if n is not None:
                refs.append((ch, script, n))
    return refs


def likeness(mark, refs):
    g = normalize(glyph_img(mark))
    best = min(((chamfer(g, r), ch, sc) for ch, sc, r in refs), key=lambda x: x[0])
    return {'mark': mark, 'char': best[1], 'script': best[2], 'sim': round(math.exp(-best[0] / TAU), 3)}


def main():
    data = sys.argv[1]
    font_dir = sys.argv[sys.argv.index('--fonts') + 1] if '--fonts' in sys.argv else None
    refs = load_refs(font_dir)
    summ = json.load(open(os.path.join(data, 'summary.json'), encoding='utf-8'))
    cache, out = {}, {'method': '뼈대 챔퍼 거리, 닮음=exp(-d/6), 기존 문자 %d자와 비교' % len(refs), 'refs': len(refs), 'gens': []}
    for row in summ['gens']:
        g = {'gen': row['gen'], 'islands': {}}
        for k, isl in row['islands'].items():
            res = {}
            for sid, w in isl['words'].items():
                res[sid] = []
                for m in w.split():
                    if m not in cache:
                        cache[m] = likeness(m, refs)
                    res[sid].append(cache[m])
            sims = [x['sim'] for v in res.values() for x in v]
            g['islands'][k] = {'words': res, 'mean': round(sum(sims) / len(sims), 3) if sims else None}
        out['gens'].append(g)
    # 우연 기준: 같은 규칙(획 1~4개)으로 아무렇게나 그은 글자 300개의 닮음
    import itertools, random, statistics
    strokes = [a + b for a, b in itertools.combinations('123456789', 2)]
    rnd = random.Random(7)
    base = sorted(likeness('.'.join(sorted(set(rnd.sample(strokes, rnd.randint(1, 4))))), refs)['sim'] for _ in range(300))
    out['baseline'] = {'n': 300, 'mean': round(statistics.mean(base), 3), 'median': base[150], 'p10': base[30], 'p90': base[270]}
    json.dump(out, open(os.path.join(data, 'likeness.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('글자', len(cache), '개 측정 · 기준', len(refs), '자')


if __name__ == '__main__':
    if sys.argv[1] == '--test':
        refs = load_refs(sys.argv[2] if len(sys.argv) > 2 else None)
        print('refs', len(refs))
        for name, m in [('L', '17.79'), ('Z', '13.37.79'), ('X', '19.37'), ('T', '13.28'), ('ㄱ', '13.39'), ('ㅁ', '13.17.39.79'), ('V', '18.38'), ('ᛉ(runic-ish)', '28.25.35'), ('random', '16.27.49'), ('random2', '26.48.57'), ('A-ish', '18.38.46'), ('N', '17.19.39')]:
            print(name, likeness(m, refs))
    else:
        main()
