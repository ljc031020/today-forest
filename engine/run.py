"""오늘의 숲 — 세 섬의 하루(한 세대)를 돌린다.

사용법:
  python engine/run.py --gens 1          # 실제 API (ANTHROPIC_API_KEY 필요)
  DRY=1 python engine/run.py --gens 3    # 가짜 응답으로 흐름만 시험
환경 변수:
  MEET_AT   두 섬이 만나기 시작하는 시각 (기본 2026-10-22T00:00:00+09:00)
  MEET_NOW=1  시각과 상관없이 지금부터 만나게 함 (시험용)
"""
import argparse, base64, collections, concurrent.futures as cf, datetime, json, os, random, re, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'docs', 'data')
STATE = os.path.join(DATA, 'state.json')
SUMMARY = os.path.join(DATA, 'summary.json')
ASSETS = json.load(open(os.path.join(ROOT, 'engine', 'assets.json'), encoding='utf-8'))
ATLAS_B64 = base64.b64encode(open(os.path.join(ROOT, 'assets', 'atlas.png'), 'rb').read()).decode()

MODEL = os.environ.get('SPEAK_MODEL', 'claude-haiku-5-5')
DRY = os.environ.get('DRY') == '1'
MEET_AT = datetime.datetime.fromisoformat(os.environ.get('MEET_AT', '2026-10-22T00:00:00+09:00'))

# ── 규칙 수치 (기획서 부록과 같음) ─────────────────────────────
AGENTS = 4            # 섬마다 AI 수
TALKS = 32            # 섬마다 세대당 대화
CROSS_TALKS = 16      # 만난 뒤 두 섬 사이 세대당 대화 (양쪽이 반반씩 말을 건다)
MEMORY = 30           # AI 한 명의 기억
REPLACE = 2           # 세대마다 교체되는 AI 수
INHERIT_FROM = 64     # 새 AI가 고르는 범위: 직전 두 세대 대화
NOISE = 0.05          # 물려줄 때 글자당 베끼기 실수
MAX_LEN = 12          # 글자 섬 메시지 최대 길이
CANDIDATES = 4        # 듣는 AI가 고르는 그림 수

SCENES = ASSETS['scenes']                       # name -> id
NAME = {v: k for k, v in SCENES.items()}        # id -> name
TIER = {  # 자주 : 보통 : 드묾 = 3 : 2 : 1
    'water': 3, 'fire': 3, 'person': 3, 'house': 3,
    'tree': 2, 'mountain': 2, 'sea': 2, 'forest': 2, 'village': 2,
    'volcano': 1, 'big fire': 1, 'crowd': 1,
}
ISLANDS = {
    'line':  {'ko': '글자 섬', 'body': 'line', 'palette': 'P1'},
    'grid':  {'ko': '그림 섬', 'body': 'grid', 'palette': 'P3'},
    'twin':  {'ko': '비교 섬', 'body': 'line', 'palette': 'P1'},
}
MEET = ('line', 'grid')   # 만나는 두 섬. 비교 섬은 끝까지 아무도 만나지 않는다.
EMPTY = '.'


def box(island):
    return ASSETS[ISLANDS[island]['palette']]['chars']  # [[char, script], ...]


def own_marks(island):
    return [c for c, _ in box(island)]


def marks(island, isl):
    """이 섬에서 쓸 수 있는 글자 = 원래 글자 + 손님에게서 본 글자."""
    return own_marks(island) + [c for c in isl.get('borrowed', []) if c not in own_marks(island)]


def other(island):
    return MEET[1] if island == MEET[0] else MEET[0]


# ── API ──────────────────────────────────────────────────────
def call(prompt, max_tokens=200):
    body = json.dumps({
        'model': MODEL, 'max_tokens': max_tokens + 3000,  # 생각하는 토큰도 이 한도에 포함된다
        'output_config': {'effort': os.environ.get('EFFORT', 'low')},
        'messages': [{'role': 'user', 'content': [
            {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': ATLAS_B64}},
            {'type': 'text', 'text': prompt}]}],
    }).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={
        'x-api-key': os.environ['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01',
        'content-type': 'application/json'})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                out = json.loads(r.read())
                text = ''.join(b.get('text', '') for b in out['content'] if b.get('type') == 'text')
                return text or f"[empty: stop_reason={out.get('stop_reason')}]"
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='ignore')[:300]
            if e.code in (429, 500, 502, 503, 529):
                time.sleep(min(60, 4 * 2 ** attempt)); continue
            raise RuntimeError(f'API {e.code}: {msg}')
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))
    raise RuntimeError('API: 재시도 한도 초과')


def parse_json(text):
    m = re.search(r'\{.*\}', text or '', re.S)
    try:
        return json.loads(m.group(0)) if m else None
    except Exception:
        return None


# ── 프롬프트 ─────────────────────────────────────────────────
RULES = """You live on an island where people talk only by writing marks. Nobody here knows any human language.
Never write words, spellings, sounds, abbreviations or numbers of any human language. A mark means only what your island has made it mean.
The image shows every picture people talk about here, each with a label like #r9. Labels are only for this game; never write them in messages."""

BODY = {
    'line': f"Your island writes a message as ONE line of 1 to {MAX_LEN} marks. The same mark may not appear twice in one message.",
    'grid': "Your island writes a message by placing marks in a 3x3 grid (3 rows of 3 cells). Use '.' for an empty cell. Put at least one mark.",
}
FOREIGN_BODY = {
    'line': 'they write one line of marks',
    'grid': "they place marks in a 3x3 grid (rows separated by /, '.' is an empty cell)",
}


def fmt_msg(msg, body):
    return '/'.join(msg[i:i + 3] for i in (0, 3, 6)) if body == 'grid' else msg


def memory_text(mem, island):
    if not mem:
        return '(none — you remember no conversations yet)'
    lines = []
    for e in mem:
        src = e.get('from', island)
        tag = '' if src == island else ' (with a visitor from the other island)'
        lines.append(f"- #{e['scene']}: \"{fmt_msg(e['msg'], ISLANDS[src]['body'])}\" → {'understood' if e['ok'] else 'NOT understood'}{tag}")
    return '\n'.join(lines)


def speak_prompt(island, isl, mem, scene, error=None, audience=None):
    body = ISLANDS[island]['body']
    own = own_marks(island)
    seen = [c for c in marks(island, isl) if c not in own]
    fmt = '{"message": "<marks>"}' if body == 'line' else '{"grid": ["<3 cells>", "<3 cells>", "<3 cells>"]}'
    mark_line = f"Marks that exist on your island (use only these): {' '.join(own)}"
    if seen:
        mark_line += f"\nMarks you have seen visitors use (you may use these too): {' '.join(seen)}"
    who = ("Your neighbour sees the same pictures but does not know which one you mean." if not audience else
           f"This time you are talking to a VISITOR from another island. On their island {FOREIGN_BODY[ISLANDS[audience]['body']]}. "
           "They see the same pictures but do not know your island's ways.")
    t = f"""{RULES}

{BODY[body]}
{mark_line}

Conversations you remember (oldest first):
{memory_text(mem, island)}

Now you must make them understand picture #{scene}. {who}
Write the message you would use, in your island's way of writing. Reply with JSON only: {fmt}"""
    if error:
        t += f"\nYour last attempt broke a rule ({error}). Try again."
    return t


def listen_prompt(island, mem, msg, cands, speaker_island=None):
    src = speaker_island or island
    sb = ISLANDS[src]['body']
    shown = fmt_msg(msg, sb) + ('  (3x3 grid rows separated by /, "." is empty)' if sb == 'grid' else '')
    who = ('Your neighbour wrote' if src == island else
           f"A VISITOR from another island wrote this to you (on their island {FOREIGN_BODY[sb]})")
    return f"""{RULES}

{BODY[ISLANDS[island]['body']]}

Conversations you remember (oldest first):
{memory_text(mem, island)}

{who}: "{shown}"
Which picture do they mean? Choose one of: {', '.join('#' + c for c in cands)}
Reply with JSON only: {{"guess": "#.."}}"""


# ── 검열 (규칙) ──────────────────────────────────────────────
def check(island, raw, allowed):
    body = ISLANDS[island]['body']
    allowed = set(allowed)
    if not isinstance(raw, dict):
        return None, 'no reply'
    if body == 'line':
        m = str(raw.get('message', '')).replace(' ', '')
        if not 1 <= len(m) <= MAX_LEN: return None, f'length {len(m)}'
        bad = [c for c in m if c not in allowed]
        if bad: return None, 'not an island mark: ' + ''.join(bad)
        if len(set(m)) != len(m): return None, 'a mark used twice'
        return m, None
    rows = raw.get('grid')
    if isinstance(rows, str): rows = [rows]
    if isinstance(rows, list) and len(rows) == 1 and '/' in str(rows[0]): rows = str(rows[0]).split('/')
    if not (isinstance(rows, list) and len(rows) == 3): return None, 'grid must have 3 rows'
    cells = ''
    for r in rows:
        r = str(r).replace(' ', '')
        if len(r) != 3: return None, 'each row must have 3 cells'
        cells += r
    bad = [c for c in cells if c != EMPTY and c not in allowed]
    if bad: return None, 'not an island mark: ' + ''.join(bad)
    if cells == EMPTY * 9: return None, 'empty grid'
    return cells, None


# ── 가짜 응답 (DRY) ─────────────────────────────────────────
def dry_speak(island, allowed, mem, scene, rnd):
    body = ISLANDS[island]['body']
    hits = [e['msg'] for e in mem if e['scene'] == scene and e['ok'] and e.get('from', island) == island]
    if hits and rnd.random() < 0.8:
        m = rnd.choice(hits)
    else:
        cs = list(allowed)
        if body == 'line':
            m = ''.join(rnd.sample(cs, rnd.randint(1, 4)))
        else:
            m = ''.join(rnd.choice(cs) if rnd.random() < 0.35 else EMPTY for _ in range(9))
            if m == EMPTY * 9: m = cs[0] + EMPTY * 8
    return {'message': m} if body == 'line' else {'grid': [m[0:3], m[3:6], m[6:9]]}


def dry_listen(mem, msg, cands, rnd):
    for e in reversed(mem):
        if e['msg'] == msg and e['scene'] in cands:
            return {'guess': '#' + e['scene']}
    return {'guess': '#' + rnd.choice(cands)}


# ── 대화 한 번 ───────────────────────────────────────────────
def pick_scene(rnd):
    names = list(TIER)
    return SCENES[rnd.choices(names, weights=[TIER[n] for n in names])[0]]


def remember(agent, scene, msg, ok, src):
    agent['memory'].append({'scene': scene, 'msg': msg, 'ok': ok, 'from': src})
    agent['memory'] = agent['memory'][-MEMORY:]


def talk(sp_island, sp_isl, sp, li_island, li_isl, li, rnd, scene=None, on_event=None, dry=DRY):
    """대화 한 번. sp/li는 AI(dict). 기록 한 줄과 막힌 말 목록을 돌려준다."""
    scene = scene or pick_scene(rnd)
    cross = sp_island != li_island
    allowed = marks(sp_island, sp_isl)
    rec = {'sp': sp['id'], 'li': li['id'], 'scene': scene, 'from': sp_island, 'to': li_island}
    blocked = []
    msg, err, raw_text = None, None, None
    for attempt in range(2):
        if dry:
            raw = dry_speak(sp_island, allowed, sp['memory'], scene, rnd)
        else:
            raw_text = call(speak_prompt(sp_island, sp_isl, sp['memory'], scene, err, li_island if cross else None))
            raw = parse_json(raw_text)
        msg, err = check(sp_island, raw, allowed)
        if msg: break
        blocked.append({'scene': scene, 'raw': raw_text if raw_text is not None else json.dumps(raw, ensure_ascii=False), 'why': err, 'from': sp_island})
    if not msg:
        rec.update({'msg': None, 'ok': False, 'blocked': True})
        if on_event: on_event('result', rec)
        return rec, blocked
    others = [s for s in SCENES.values() if s != scene]
    cands = rnd.sample(others, CANDIDATES - 1) + [scene]
    rnd.shuffle(cands)
    rec.update({'msg': msg, 'cands': cands, 'raw_speak': raw_text})
    if on_event: on_event('speak', rec)
    if dry:
        g, ltext = dry_listen(li['memory'], msg, cands, rnd), None
    else:
        ltext = call(listen_prompt(li_island, li['memory'], msg, cands, sp_island), 60)
        g = parse_json(ltext)
    guess = str((g or {}).get('guess', '')).lstrip('#').strip()
    ok = guess == scene
    rec.update({'guess': guess, 'ok': ok, 'raw_listen': ltext})
    remember(sp, scene, msg, ok, sp_island)
    remember(li, scene, msg, ok, sp_island)
    if cross:  # 들은 쪽 섬은 손님의 낯선 글자를 알게 된다
        own = set(own_marks(li_island))
        for c in msg:
            if c != EMPTY and c not in own and c not in li_isl.setdefault('borrowed', []):
                li_isl['borrowed'].append(c)
    if on_event: on_event('result', rec)
    return rec, blocked


def run_island(island, isl, rnd):
    talks, blocked = [], []
    for t in range(TALKS):
        sp, li = rnd.sample(isl['agents'], 2)
        rec, b = talk(island, isl, sp, island, isl, li, rnd)
        rec['t'] = t
        talks.append(rec); blocked += b
    return talks, blocked


def run_cross(st, rnd):
    a, b = MEET
    A, B = st['islands'][a], st['islands'][b]
    talks, blocked = [], []
    for t in range(CROSS_TALKS):
        if t % 2 == 0: rec, bl = talk(a, A, rnd.choice(A['agents']), b, B, rnd.choice(B['agents']), rnd)
        else:          rec, bl = talk(b, B, rnd.choice(B['agents']), a, A, rnd.choice(A['agents']), rnd)
        rec['t'] = t
        talks.append(rec); blocked += bl
    return talks, blocked


# ── 물려주기 ─────────────────────────────────────────────────
def mutate(msg, island, rnd):
    script = {c: s for c, s in box(island)}
    out, changes = '', []
    for c in msg:
        if c != EMPTY and rnd.random() < NOISE:
            same = [x for x, s in box(island) if s == script.get(c) and x != c]
            if same:
                n = rnd.choice(same); changes.append(f'{c}→{n}'); out += n; continue
        out += c
    return out, changes


def inherit(island, isl, gen, rnd):
    """가장 오래된 AI 2명을 새 AI로 바꾼다. 새 AI는 직전 두 세대 대화 64번 중 30개를 베껴 받는다."""
    pool = [x for x in isl['recent'] if x.get('msg')]
    isl['agents'].sort(key=lambda a: a['born'])
    log = []
    for i in range(REPLACE):
        old = isl['agents'][i]
        mem = []
        for x in rnd.sample(pool, min(MEMORY, len(pool))):
            src = x.get('from', island)
            m, ch = mutate(x['msg'], src, rnd)
            log += ch
            mem.append({'scene': x['scene'], 'msg': m, 'ok': x['ok'], 'from': src})
        isl['next_id'] += 1
        isl['agents'][i] = {'id': isl['next_id'], 'born': gen + 1, 'memory': mem}
        log.append(f'#{old["id"]} 떠남 → #{isl["next_id"]} 태어남')
    return log


# ── 재기 ─────────────────────────────────────────────────────
def words_of(talks, prev_words):
    """그림마다 그 세대에 가장 많이 통한 말 = 대표 단어 (섬 안 대화만)."""
    words = {}
    for sid in SCENES.values():
        ok = collections.Counter(x['msg'] for x in talks if x['scene'] == sid and x.get('ok'))
        anyc = collections.Counter(x['msg'] for x in talks if x['scene'] == sid and x.get('msg'))
        if ok:
            words[sid] = {'w': ok.most_common(1)[0][0], 'src': 'ok'}
        elif anyc:
            words[sid] = {'w': anyc.most_common(1)[0][0], 'src': 'tried'}
        elif prev_words.get(sid):
            words[sid] = {**prev_words[sid], 'src': 'carried'}
    return words


def borrow_ratio(island, talks):
    own = set(own_marks(island)) | {EMPTY}
    ms = [x['msg'] for x in talks if x.get('msg')]
    return round(sum(1 for m in ms if any(c not in own for c in m)) / len(ms), 3) if ms else 0


# ── 저장 ─────────────────────────────────────────────────────
def new_state():
    st = {'gen': 0, 'started': None, 'met_gen': None, 'islands': {}}
    for k in ISLANDS:
        st['islands'][k] = {'agents': [{'id': i + 1, 'born': 0, 'memory': []} for i in range(AGENTS)],
                            'next_id': AGENTS, 'recent': [], 'words': {}, 'borrowed': []}
    return st


def load_json(p, default):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def save_json(p, obj, indent=None):
    tmp = p + '.tmp'
    json.dump(obj, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=indent)
    os.replace(tmp, p)


def meeting_now():
    if os.environ.get('MEET_NOW') == '1':
        return True
    return datetime.datetime.now(datetime.timezone.utc) >= MEET_AT


def one_gen(st, summary):
    gen = st['gen'] + 1
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    st['started'] = st['started'] or now
    seed = int(os.environ.get('SEED', '20261012'))
    meet = meeting_now()
    if meet and not st.get('met_gen'):
        st['met_gen'] = gen

    def work(k):
        rnd = random.Random(f'{seed}-{k}-{gen}')
        return k, run_island(k, st['islands'][k], rnd)

    with cf.ThreadPoolExecutor(len(ISLANDS)) as ex:
        inner = dict(ex.map(work, ISLANDS))

    cross_talks, cross_blocked = ([], [])
    if meet:
        cross_talks, cross_blocked = run_cross(st, random.Random(f'{seed}-cross-{gen}'))

    log = {'gen': gen, 'at': now, 'model': 'dry' if DRY else MODEL, 'met': meet, 'islands': {}}
    row = {'gen': gen, 'at': now, 'met': meet, 'islands': {}}
    for k in ISLANDS:
        talks, blocked = inner[k]
        isl = st['islands'][k]
        mine_cross = [x for x in cross_talks if k in (x['from'], x['to']) and x.get('msg')]
        isl['recent'] = (isl['recent'] + [t for t in talks if t.get('msg')] + mine_cross)[-INHERIT_FROM:]
        words = words_of(talks, isl['words'])
        isl['words'] = words
        changes = inherit(k, isl, gen, random.Random(f'{seed}-{k}-{gen}-inherit'))
        log['islands'][k] = {'talks': talks, 'blocked': blocked, 'inherit': changes}
        row['islands'][k] = {'ok': sum(1 for t in talks if t.get('ok')), 'talks': len(talks), 'blocked': len(blocked),
                             'words': {s: v['w'] for s, v in words.items()},
                             'src': {s: v['src'] for s, v in words.items()},
                             'borrow': borrow_ratio(k, talks), 'borrowed': len(isl.get('borrowed', []))}
    if meet:
        log['cross'] = {'talks': cross_talks, 'blocked': cross_blocked}
        row['cross'] = {'ok': sum(1 for t in cross_talks if t.get('ok')), 'talks': len(cross_talks)}
    os.makedirs(os.path.join(DATA, 'gens'), exist_ok=True)
    save_json(os.path.join(DATA, 'gens', f'g{gen:03d}.json'), log)
    summary['gens'].append(row)
    st['gen'] = gen
    save_json(STATE, st)
    save_json(SUMMARY, summary)
    forest = SCENES['forest']
    print(f'gen {gen}{" [만남]" if meet else ""}: ' + ', '.join(
        f"{ISLANDS[k]['ko']} {row['islands'][k]['ok']}/{TALKS} 통함, 숲={row['islands'][k]['words'].get(forest, '-')}" for k in ISLANDS)
        + (f", 섬 사이 {row['cross']['ok']}/{CROSS_TALKS}" if meet else ''), flush=True)


def write_meta(summary, st):
    summary['meta'] = {
        'islands': {k: {'ko': v['ko'], 'body': v['body'], 'chars': box(k)} for k, v in ISLANDS.items()},
        'scenes': SCENES, 'tier': TIER, 'talks_per_gen': TALKS, 'cross_per_gen': CROSS_TALKS,
        'meet': list(MEET), 'meet_at': MEET_AT.isoformat(), 'met_gen': st.get('met_gen'),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gens', type=int, default=1)
    ap.add_argument('--reset', action='store_true')
    a = ap.parse_args()
    os.makedirs(DATA, exist_ok=True)
    st = new_state() if a.reset else load_json(STATE, new_state())
    summary = {'gens': []} if a.reset else load_json(SUMMARY, {'gens': []})
    for _ in range(a.gens):
        write_meta(summary, st)
        one_gen(st, summary)
        write_meta(summary, st)
        save_json(SUMMARY, summary)


if __name__ == '__main__':
    main()
