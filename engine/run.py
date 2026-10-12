"""오늘의 숲 — 세 섬의 하루(한 세대)를 돌린다.

사용법:
  python engine/run.py --gens 1          # 실제 API (ANTHROPIC_API_KEY 필요)
  DRY=1 python engine/run.py --gens 3    # 가짜 응답으로 흐름만 시험
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

# ── 규칙 수치 (기획서 부록과 같음) ─────────────────────────────
AGENTS = 4            # 섬마다 AI 수
TALKS = 32            # 섬마다 하루 대화
MEMORY = 30           # AI 한 명의 기억
REPLACE = 2           # 매일 교체되는 AI 수
INHERIT_FROM = 64     # 새 AI가 고르는 범위: 직전 이틀 대화
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
EMPTY = '.'


def box(island):
    return ASSETS[ISLANDS[island]['palette']]['chars']  # [[char, script], ...]


# ── API ──────────────────────────────────────────────────────
def call(prompt, max_tokens=200):
    if DRY:
        return None
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
    return json.loads(m.group(0)) if m else None


# ── 프롬프트 ─────────────────────────────────────────────────
RULES = """You live on an island where people talk only by writing marks. Nobody here knows any human language.
Never write words, spellings, sounds, abbreviations or numbers of any human language. A mark means only what your island has made it mean.
The image shows every picture people talk about here, each with a label like #r9. Labels are only for this game; never write them in messages."""

BODY = {
    'line': f"Your island writes a message as ONE line of 1 to {MAX_LEN} marks. The same mark may not appear twice in one message.",
    'grid': "Your island writes a message by placing marks in a 3x3 grid (3 rows of 3 cells). Use '.' for an empty cell. Put at least one mark.",
}


def fmt_msg(msg, body):
    return '/'.join(msg[i:i + 3] for i in (0, 3, 6)) if body == 'grid' else msg


def memory_text(mem, body):
    if not mem:
        return '(none — you remember no conversations yet)'
    return '\n'.join(f"- #{e['scene']}: \"{fmt_msg(e['msg'], body)}\" → {'understood' if e['ok'] else 'NOT understood'}" for e in mem)


def speak_prompt(island, mem, scene, error=None):
    body = ISLANDS[island]['body']
    marks = ' '.join(c for c, _ in box(island))
    fmt = '{"message": "<marks>"}' if body == 'line' else '{"grid": ["<3 cells>", "<3 cells>", "<3 cells>"]}'
    t = f"""{RULES}

{BODY[body]}
Marks that exist on your island (use only these): {marks}

Conversations you remember (oldest first):
{memory_text(mem, body)}

Now you must make your neighbour understand picture #{scene}. Your neighbour sees the same pictures but does not know which one you mean.
Write the message you would use. Reply with JSON only: {fmt}"""
    if error:
        t += f"\nYour last attempt broke a rule ({error}). Try again."
    return t


def listen_prompt(island, mem, msg, cands):
    body = ISLANDS[island]['body']
    shown = fmt_msg(msg, body) + ('  (3x3 grid rows separated by /, "." is empty)' if body == 'grid' else '')
    return f"""{RULES}

{BODY[body]}

Conversations you remember (oldest first):
{memory_text(mem, body)}

Your neighbour wrote: "{shown}"
Which picture do they mean? Choose one of: {', '.join('#' + c for c in cands)}
Reply with JSON only: {{"guess": "#.."}}"""


# ── 검열 (규칙) ──────────────────────────────────────────────
def check(island, raw):
    body = ISLANDS[island]['body']
    allowed = {c for c, _ in box(island)}
    if raw is None:
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
def dry_speak(island, mem, scene, rnd):
    body = ISLANDS[island]['body']
    hits = [e['msg'] for e in mem if e['scene'] == scene and e['ok']]
    if hits and rnd.random() < 0.8:
        m = rnd.choice(hits)
    else:
        cs = [c for c, _ in box(island)]
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


# ── 한 섬의 하루 ─────────────────────────────────────────────
def pick_scene(rnd):
    names = list(TIER)
    return SCENES[rnd.choices(names, weights=[TIER[n] for n in names])[0]]


def remember(agent, scene, msg, ok):
    agent['memory'].append({'scene': scene, 'msg': msg, 'ok': ok})
    agent['memory'] = agent['memory'][-MEMORY:]


def run_island(island, st, gen, rnd):
    agents = st['agents']
    talks, blocked = [], []
    for t in range(TALKS):
        sp, li = rnd.sample(range(AGENTS), 2)
        scene = pick_scene(rnd)
        msg, err, raws = None, None, []
        for attempt in range(2):
            if DRY:
                raw = dry_speak(island, agents[sp]['memory'], scene, rnd)
            else:
                text = call(speak_prompt(island, agents[sp]['memory'], scene, err))
                raws.append(text)
                try: raw = parse_json(text)
                except Exception: raw = None
            msg, err = check(island, raw)
            if msg: break
            blocked.append({'scene': scene, 'raw': raws[-1] if raws else raw, 'why': err})
        if not msg:
            talks.append({'t': t, 'sp': agents[sp]['id'], 'li': agents[li]['id'], 'scene': scene, 'msg': None, 'ok': False, 'blocked': True})
            continue
        others = [s for s in SCENES.values() if s != scene]
        cands = rnd.sample(others, CANDIDATES - 1) + [scene]
        rnd.shuffle(cands)
        if DRY:
            g = dry_listen(agents[li]['memory'], msg, cands, rnd)
            ltext = None
        else:
            ltext = call(listen_prompt(island, agents[li]['memory'], msg, cands), 60)
            try: g = parse_json(ltext)
            except Exception: g = None
        guess = str((g or {}).get('guess', '')).lstrip('#').strip()
        ok = guess == scene
        remember(agents[sp], scene, msg, ok)
        remember(agents[li], scene, msg, ok)
        talks.append({'t': t, 'sp': agents[sp]['id'], 'li': agents[li]['id'], 'scene': scene, 'cands': cands,
                      'msg': msg, 'guess': guess, 'ok': ok, 'raw_speak': raws[-1] if raws else None, 'raw_listen': ltext})
    return talks, blocked


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


def inherit(island, st, gen, rnd):
    """가장 오래된 AI 2명을 새 AI로 바꾼다. 새 AI는 직전 이틀 대화 64번 중 30개를 베껴 받는다."""
    pool = [x for x in st['recent'] if x.get('msg')]
    st['agents'].sort(key=lambda a: a['born'])
    noise_log = []
    for i in range(REPLACE):
        old = st['agents'][i]
        mem = []
        for x in rnd.sample(pool, min(MEMORY, len(pool))):
            m, ch = mutate(x['msg'], island, rnd)
            noise_log += ch
            mem.append({'scene': x['scene'], 'msg': m, 'ok': x['ok']})
        st['next_id'] += 1
        st['agents'][i] = {'id': st['next_id'], 'born': gen + 1, 'memory': mem}
        noise_log.append(f'#{old["id"]} 떠남 → #{st["next_id"]} 태어남')
    return noise_log


def words_of(talks, prev_words):
    """그림마다 그날 가장 많이 통한 말 = 대표 단어."""
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


# ── 저장 ─────────────────────────────────────────────────────
def new_state():
    st = {'gen': 0, 'started': None, 'islands': {}}
    for k in ISLANDS:
        st['islands'][k] = {'agents': [{'id': i + 1, 'born': 0, 'memory': []} for i in range(AGENTS)],
                            'next_id': AGENTS, 'recent': [], 'words': {}}
    return st


def load_json(p, default):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default


def save_json(p, obj, indent=None):
    tmp = p + '.tmp'
    json.dump(obj, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=indent)
    os.replace(tmp, p)


def one_gen(st, summary):
    gen = st['gen'] + 1
    now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    st['started'] = st['started'] or now
    seed = int(os.environ.get('SEED', '20261012'))

    def work(k):
        rnd = random.Random(f'{seed}-{k}-{gen}')
        isl = st['islands'][k]
        talks, blocked = run_island(k, isl, gen, rnd)
        isl['recent'] = (isl['recent'] + [t for t in talks if t.get('msg')])[-INHERIT_FROM:]
        words = words_of(talks, isl['words'])
        isl['words'] = words
        changes = inherit(k, isl, gen, rnd)
        return k, talks, blocked, words, changes

    with cf.ThreadPoolExecutor(len(ISLANDS)) as ex:
        results = list(ex.map(work, ISLANDS))

    log = {'gen': gen, 'at': now, 'model': 'dry' if DRY else MODEL, 'islands': {}}
    row = {'gen': gen, 'at': now, 'islands': {}}
    for k, talks, blocked, words, changes in results:
        n_ok = sum(1 for t in talks if t.get('ok'))
        log['islands'][k] = {'talks': talks, 'blocked': blocked, 'inherit': changes}
        row['islands'][k] = {'ok': n_ok, 'talks': len(talks), 'blocked': len(blocked),
                             'words': {s: v['w'] for s, v in words.items()},
                             'src': {s: v['src'] for s, v in words.items()}}
    os.makedirs(os.path.join(DATA, 'gens'), exist_ok=True)
    save_json(os.path.join(DATA, 'gens', f'g{gen:03d}.json'), log)
    summary['gens'].append(row)
    st['gen'] = gen
    save_json(STATE, st)
    save_json(SUMMARY, summary)
    print(f'gen {gen}: ' + ', '.join(f"{ISLANDS[k]['ko']} {row['islands'][k]['ok']}/{TALKS} 통함, 숲={row['islands'][k]['words'].get(SCENES['forest'], {}) or '-'}" for k in ISLANDS), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gens', type=int, default=1)
    ap.add_argument('--reset', action='store_true')
    a = ap.parse_args()
    os.makedirs(DATA, exist_ok=True)
    st = new_state() if a.reset else load_json(STATE, new_state())
    summary = {'gens': []} if a.reset else load_json(SUMMARY, {'gens': []})
    summary['meta'] = {
        'islands': {k: {'ko': v['ko'], 'body': v['body'], 'chars': box(k)} for k, v in ISLANDS.items()},
        'scenes': SCENES, 'tier': TIER, 'talks_per_gen': TALKS,
    }
    for _ in range(a.gens):
        one_gen(st, summary)


if __name__ == '__main__':
    main()
