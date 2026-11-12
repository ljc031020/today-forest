"""오늘의 숲 — 선과 점 섬 (기말 실험).

기존 문자를 주지 않는다. 3×3 점 격자에서 두 점을 이은 '획'으로 글자 모양부터 AI가 만든다.
규칙(그림 맞히기·메모 30줄·세대 교체·옮겨 적기 실수 5%)은 기존 섬과 같다.
시험 운영(1~10세대)은 같은 조건의 섬 3개(점1·점2·점3)를 따로 돌렸다.
본 운영(11세대~, 11/12 컨펌)은 점 섬 3 하나만 이어서 돌린다. 점 섬 1·2는 10세대 기록으로 남긴다.

점 번호       획 = 두 점 (예: 15 = 1번과 5번을 잇는 선)
 1 2 3       글자 = 획 1~4개 (예: 15.59)
 4 5 6       말   = 글자 1~3개 (예: 15.59 13.37)
 7 8 9

사용법:
  python engine/dots.py --gens 10        # 실제 API (ANTHROPIC_API_KEY 필요)
  python engine/dots.py --auto           # 07시·19시(KST) 차례가 지났으면 한 세대
  python engine/dots.py --islands d1,d2,d3 --gens 1   # 섬 고르기 (기본: 점 섬 3)
  DRY=1 python engine/dots.py --gens 5   # 가짜 응답으로 흐름만 시험
결과: docs/data/dots/ (state.json, summary.json, gens/g001.json …) — 기존 섬 데이터와 섞이지 않는다.
"""
import argparse, collections, concurrent.futures as cf, datetime, itertools, json, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run as R  # 같은 API 호출·그림판·규칙 수치를 쓴다

DATA = os.environ.get('DOTS_DATA') or os.path.join(R.ROOT, 'docs', 'data', 'dots')
STATE = os.path.join(DATA, 'state.json')
SUMMARY = os.path.join(DATA, 'summary.json')
DRY = os.environ.get('DRY') == '1'

ALL_ISLANDS = {'d1': {'ko': '점 섬 1'}, 'd2': {'ko': '점 섬 2'}, 'd3': {'ko': '점 섬 3'}}
ACTIVE = os.environ.get('DOTS_ISLANDS', 'd3')   # 본 운영: 점 섬 3만
ISLANDS = {k: ALL_ISLANDS[k] for k in ACTIVE.split(',')}
TRIAL_GENS = 10      # 시험 운영 세대 (섬 3곳)
MAX_STROKES = 4      # 글자 하나의 획 수
MAX_MARKS = 3        # 말 하나의 글자 수
DOTS = '123456789'
ALL_STROKES = [a + b for a, b in itertools.combinations(DOTS, 2)]  # 36가지


# ── 글자 표기 ────────────────────────────────────────────────
def norm_stroke(s):
    s = re.sub(r'\D', '', str(s))
    if len(s) != 2 or s[0] == s[1] or s[0] not in DOTS or s[1] not in DOTS:
        return None
    return ''.join(sorted(s))


def norm_mark(strokes):
    out = sorted({x for x in (norm_stroke(s) for s in strokes) if x})
    return '.'.join(out)


def check(raw):
    """AI 답을 '15.59 13' 같은 표준 표기로. 규칙 위반이면 (None, 이유)."""
    if not isinstance(raw, dict):
        return None, 'no reply'
    marks = raw.get('marks')
    if isinstance(marks, str):
        marks = [m.split() if ' ' in m.strip() else re.findall(r'\d{2}', m) for m in re.split(r'[|/]', marks)]
    if not isinstance(marks, list) or not 1 <= len(marks) <= MAX_MARKS:
        return None, f'a message has 1 to {MAX_MARKS} marks'
    out = []
    for m in marks:
        if isinstance(m, str):
            m = re.findall(r'\d{2}', m)
        elif isinstance(m, list) and any('.' in str(x) or len(re.sub(r'\D', '', str(x))) > 2 for x in m):
            m = [y for x in m for y in re.findall(r'\d{2}', str(x))]  # ["25.46.57"]처럼 한 칸에 몰아 쓴 경우
        if not isinstance(m, list) or not m:
            return None, 'each mark is a list of strokes'
        bad = [s for s in m if norm_stroke(s) is None]
        if bad:
            return None, f'not a stroke: {bad[0]} (a stroke joins two different dots, like "15")'
        nm = norm_mark(m)
        if not 1 <= nm.count('.') + 1 <= MAX_STROKES:
            return None, f'a mark has 1 to {MAX_STROKES} strokes'
        out.append(nm)
    return ' '.join(out), None


def draw(msg):
    """기억 속 말을 AI가 볼 수 있게 글자마다 작은 점 그림(5×5)으로."""
    pos = {d: ((i % 3) * 2, (i // 3) * 2) for i, d in enumerate(DOTS)}
    pics = []
    for m in msg.split():
        g = [['·' if (x % 2 == 0 and y % 2 == 0) else ' ' for x in range(5)] for y in range(5)]
        for s in m.split('.'):
            (x1, y1), (x2, y2) = pos[s[0]], pos[s[1]]
            n = max(abs(x2 - x1), abs(y2 - y1))
            for t in range(n + 1):
                x = x1 + round((x2 - x1) * t / n); y = y1 + round((y2 - y1) * t / n)
                g[y][x] = '#'
        pics.append([''.join(r) for r in g])
    return '\n'.join('   '.join(p[r] for p in pics) for r in range(5))


# ── 프롬프트 ─────────────────────────────────────────────────
RULES = """You live on an island where people talk only by drawing marks. Nobody here knows any human language or any human writing system.
Never draw letters, digits or symbols of any human script, and never draw pictures of things. A mark means only what your island has made it mean.
The image shows every picture people talk about here, each with a label like #r9. Labels are only for this game; never use them in messages."""

BODY = f"""Your island draws marks on a 3x3 grid of dots, numbered like this:
1 2 3
4 5 6
7 8 9
A stroke is a straight line joining two dots, written as two digits (e.g. "15" joins dot 1 and dot 5). The digits are only positions for drawing; they mean nothing by themselves.
A mark is 1 to {MAX_STROKES} strokes. A message is 1 to {MAX_MARKS} marks."""


def memory_text(mem):
    if not mem:
        return '(none — you remember no conversations yet)'
    return '\n'.join(f"- #{e['scene']}: {e['msg']} → {'understood' if e['ok'] else 'NOT understood'}" for e in mem)


def speak_prompt(mem, scene, error=None):
    t = f"""{RULES}

{BODY}

Conversations you remember (oldest first; marks are separated by spaces, strokes inside a mark by dots):
{memory_text(mem)}

Now you must make your neighbour understand picture #{scene}. Your neighbour sees the same pictures but does not know which one you mean.
Draw the message you would use, in your island's way. Reply with JSON only: {{"marks": [["<stroke>", ...], ...]}}"""
    if error:
        t += f"\nYour last attempt broke a rule ({error}). Try again."
    return t


def listen_prompt(mem, msg, cands):
    return f"""{RULES}

{BODY}

Conversations you remember (oldest first; marks are separated by spaces, strokes inside a mark by dots):
{memory_text(mem)}

Your neighbour drew: {msg}
It looks like this (# = line, · = dot):
{draw(msg)}

Which picture do they mean? Choose one of: {', '.join('#' + c for c in cands)}
Reply with JSON only: {{"guess": "#.."}}"""


# ── 가짜 응답 ────────────────────────────────────────────────
def dry_speak(mem, scene, rnd):
    hits = [e['msg'] for e in mem if e['scene'] == scene and e['ok']]
    if hits and rnd.random() < 0.8:
        return {'marks': [m.split('.') for m in rnd.choice(hits).split()]}
    return {'marks': [rnd.sample(ALL_STROKES, rnd.randint(1, MAX_STROKES)) for _ in range(rnd.randint(1, 2))]}


def dry_listen(mem, msg, cands, rnd):
    for e in reversed(mem):
        if e['msg'] == msg and e['scene'] in cands:
            return {'guess': '#' + e['scene']}
    return {'guess': '#' + rnd.choice(cands)}


# ── 대화 ─────────────────────────────────────────────────────
def talk(sp, li, rnd):
    scene = R.pick_scene(rnd)
    rec = {'sp': sp['id'], 'li': li['id'], 'scene': scene}
    blocked, msg, err, raw_text = [], None, None, None
    for _ in range(2):
        if DRY:
            raw = dry_speak(sp['memory'], scene, rnd)
        else:
            raw_text = R.call(speak_prompt(sp['memory'], scene, err), 300)
            raw = R.parse_json(raw_text)
        msg, err = check(raw)
        if msg:
            break
        blocked.append({'scene': scene, 'raw': raw_text if raw_text is not None else json.dumps(raw), 'why': err})
    if not msg:
        rec.update({'msg': None, 'ok': False, 'blocked': True})
        return rec, blocked
    others = [s for s in R.SCENES.values() if s != scene]
    cands = rnd.sample(others, R.CANDIDATES - 1) + [scene]
    rnd.shuffle(cands)
    rec.update({'msg': msg, 'cands': cands, 'raw_speak': raw_text})
    if DRY:
        g, ltext = dry_listen(li['memory'], msg, cands, rnd), None
    else:
        ltext = R.call(listen_prompt(li['memory'], msg, cands), 60)
        g = R.parse_json(ltext)
    guess = str((g or {}).get('guess', '')).lstrip('#').strip()
    ok = guess == scene
    rec.update({'guess': guess, 'ok': ok, 'raw_listen': ltext})
    for a in (sp, li):
        a['memory'].append({'scene': scene, 'msg': msg, 'ok': ok})
        a['memory'] = a['memory'][-R.MEMORY:]
    return rec, blocked


def run_island(isl, rnd):
    talks, blocked = [], []
    for t in range(R.TALKS):
        sp, li = rnd.sample(isl['agents'], 2)
        rec, b = talk(sp, li, rnd)
        rec['t'] = t
        talks.append(rec); blocked += b
    return talks, blocked


# ── 물려주기: 옮겨 적을 때 획의 한쪽 끝을 가끔 잘못 찍는다 ─────────
def mutate(msg, rnd):
    out, changes = [], []
    for m in msg.split():
        ss = []
        for s in m.split('.'):
            if rnd.random() < R.NOISE:
                a, b = s
                keep, move = (a, b) if rnd.random() < .5 else (b, a)
                n = rnd.choice([d for d in DOTS if d not in (keep, move)])
                ns = ''.join(sorted(keep + n)); changes.append(f'{s}→{ns}'); s = ns
            ss.append(s)
        out.append(norm_mark(ss))
    return ' '.join(out), changes


def inherit(isl, gen, rnd):
    pool = [x for x in isl['recent'] if x.get('msg')]
    isl['agents'].sort(key=lambda a: a['born'])
    log = []
    for i in range(R.REPLACE):
        old = isl['agents'][i]
        mem = []
        for x in rnd.sample(pool, min(R.MEMORY, len(pool))):
            m, ch = mutate(x['msg'], rnd)
            log += ch
            mem.append({'scene': x['scene'], 'msg': m, 'ok': x['ok']})
        isl['next_id'] += 1
        isl['agents'][i] = {'id': isl['next_id'], 'born': gen + 1, 'memory': mem}
        log.append(f'#{old["id"]} 떠남 → #{isl["next_id"]} 태어남')
    return log


def new_state():
    st = {'gen': 0, 'started': None, 'islands': {}}
    for k in ALL_ISLANDS:
        st['islands'][k] = {'agents': [{'id': i + 1, 'born': 0, 'memory': []} for i in range(R.AGENTS)],
                            'next_id': R.AGENTS, 'recent': [], 'words': {}}
    return st


def one_gen(st, summary):
    gen = st['gen'] + 1
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    st['started'] = st['started'] or now
    seed = int(os.environ.get('SEED', '20261104'))

    def work(k):
        return k, run_island(st['islands'][k], random.Random(f'{seed}-{k}-{gen}'))

    with cf.ThreadPoolExecutor(len(ISLANDS)) as ex:
        inner = dict(ex.map(work, ISLANDS))
    log = {'gen': gen, 'at': now, 'model': 'dry' if DRY else R.MODEL, 'islands': {}}
    row = {'gen': gen, 'at': now, 'islands': {}}
    for k in ISLANDS:
        talks, blocked = inner[k]
        isl = st['islands'][k]
        isl['recent'] = (isl['recent'] + [t for t in talks if t.get('msg')])[-R.INHERIT_FROM:]
        isl['words'] = R.words_of(talks, isl['words'])
        changes = inherit(isl, gen, random.Random(f'{seed}-{k}-{gen}-inherit'))
        log['islands'][k] = {'talks': talks, 'blocked': blocked, 'inherit': changes}
        row['islands'][k] = {'ok': sum(1 for t in talks if t.get('ok')), 'talks': len(talks), 'blocked': len(blocked),
                             'words': {s: v['w'] for s, v in isl['words'].items()},
                             'src': {s: v['src'] for s, v in isl['words'].items()}}
    os.makedirs(os.path.join(DATA, 'gens'), exist_ok=True)
    R.save_json(os.path.join(DATA, 'gens', f'g{gen:03d}.json'), log)
    summary['gens'].append(row)
    st['gen'] = gen
    R.save_json(STATE, st)
    write_meta(summary)
    R.save_json(SUMMARY, summary)
    forest = R.SCENES['forest']
    print(f'점 섬 gen {gen}: ' + ', '.join(f"{ISLANDS[k]['ko']} {row['islands'][k]['ok']}/{R.TALKS} 통함, 숲={row['islands'][k]['words'].get(forest, '-')}" for k in ISLANDS), flush=True)


def write_meta(summary):
    """화면이 쓰는 정보. islands = 지금 도는 섬, paused = 멈춘 섬과 마지막 세대."""
    last = {}
    for row in summary['gens']:
        for k in row['islands']:
            last[k] = row['gen']
    summary['meta'] = {'islands': {k: v['ko'] for k, v in ISLANDS.items()},
                       'paused': {k: {'ko': v['ko'], 'last': last[k]} for k, v in ALL_ISLANDS.items() if k not in ISLANDS and k in last},
                       'trial_gens': TRIAL_GENS, 'scenes': R.SCENES, 'tier': R.TIER,
                       'talks_per_gen': R.TALKS, 'max_strokes': MAX_STROKES, 'max_marks': MAX_MARKS, 'model': R.MODEL}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gens', type=int, default=1)
    ap.add_argument('--reset', action='store_true')
    ap.add_argument('--auto', action='store_true', help='07시·19시(KST) 차례가 지났는데 아직 안 돌았으면 한 세대만')
    ap.add_argument('--islands', help='돌릴 섬 (쉼표로, 기본 d3)')
    ap.add_argument('--meta', action='store_true', help='세대는 안 돌리고 화면 정보만 다시 씀')
    a = ap.parse_args()
    global ISLANDS
    if a.islands:
        ISLANDS = {k: ALL_ISLANDS[k] for k in a.islands.split(',')}
    os.makedirs(DATA, exist_ok=True)
    st = new_state() if a.reset else R.load_json(STATE, new_state())
    summary = {'gens': []} if a.reset else R.load_json(SUMMARY, {'gens': []})
    if a.meta:
        write_meta(summary); R.save_json(SUMMARY, summary); return
    if a.auto:
        a.gens = 1 if R.slot_due(summary) else 0
        print('점 섬: 차례가 됨, 한 세대 돌림' if a.gens else '점 섬: 아직 차례가 아님', flush=True)
    for _ in range(a.gens):
        one_gen(st, summary)


if __name__ == '__main__':
    main()
