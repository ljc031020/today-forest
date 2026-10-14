"""오늘의 숲 — AI들의 기억을 세대별로 되살려 화면용 기록(docs/data/mem/gNNN.json)을 만든다.

run.py는 대화 기록과 마지막 상태만 저장한다. 그런데 물려받기는 정해진 씨앗(seed)으로 섞기 때문에,
대화 기록을 처음부터 다시 따라가면 세대마다 각 AI가 무엇을 기억하고 있었는지 똑같이 재현할 수 있다.
마지막에 재현한 기억이 state.json과 한 글자도 다르지 않은지 확인한다(다르면 실패로 끝난다).

  python engine/memlog.py
"""
import json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run  # noqa: E402

OUT = os.path.join(run.DATA, 'mem')


def entry(e, island):
    """기억 한 줄을 짧게: [그림, 말, 통함(1/0)] (+ 다른 섬에서 온 말이면 그 섬)"""
    x = [e['scene'], e['msg'], 1 if e['ok'] else 0]
    if e.get('from', island) != island:
        x.append(e['from'])
    return x


def inherit_traced(island, isl, gen, rnd):
    """run.inherit와 똑같이 움직이되, 무엇을 골라 어떻게 베꼈는지 남긴다."""
    pool = [x for x in isl['recent'] if x.get('msg')]
    isl['agents'].sort(key=lambda a: a['born'])
    left, born = [], []
    for i in range(run.REPLACE):
        old = isl['agents'][i]
        idx = rnd.sample(range(len(pool)), min(run.MEMORY, len(pool)))
        mem, mut = [], []
        for pos, j in enumerate(idx):
            x = pool[j]
            src = x.get('from', island)
            m, ch = run.mutate(x['msg'], src, rnd)
            if m != x['msg']:
                mut.append([pos, x['msg'], m])
            mem.append({'scene': x['scene'], 'msg': m, 'ok': x['ok'], 'from': src})
        isl['next_id'] += 1
        isl['agents'][i] = {'id': isl['next_id'], 'born': gen + 1, 'memory': mem}
        left.append(old['id'])
        born.append({'id': isl['next_id'], 'pick': idx, 'mut': mut})
    return {'left': left, 'born': born, 'pool': [entry(x, island) for x in pool]}


def main():
    st = run.new_state()
    seed = int(os.environ.get('SEED', '20261012'))
    os.makedirs(OUT, exist_ok=True)
    gen = 1
    prev_mut = {k: {} for k in run.ISLANDS}
    while True:
        p = os.path.join(run.DATA, 'gens', f'g{gen:03d}.json')
        if not os.path.exists(p):
            break
        G = json.load(open(p, encoding='utf-8'))
        out = {'gen': gen, 'islands': {}}
        for k in run.ISLANDS:
            isl = st['islands'][k]
            out['islands'][k] = {
                'start': {str(a['id']): [entry(e, k) for e in a['memory']] for a in isl['agents']},
                'born': {str(a['id']): a['born'] for a in isl['agents']},
                'mut': prev_mut[k],
            }
        # 섬 안 대화 (섬마다 따로, 순서대로)
        for k in run.ISLANDS:
            ag = {a['id']: a for a in st['islands'][k]['agents']}
            for t in G['islands'][k]['talks']:
                if not t.get('msg'):
                    continue
                run.remember(ag[t['sp']], t['scene'], t['msg'], t['ok'], k)
                run.remember(ag[t['li']], t['scene'], t['msg'], t['ok'], k)
        # 두 섬 사이 대화 (만난 뒤)
        cross = (G.get('cross') or {}).get('talks', [])
        for t in cross:
            if not t.get('msg'):
                continue
            A = {a['id']: a for a in st['islands'][t['from']]['agents']}
            B = {a['id']: a for a in st['islands'][t['to']]['agents']}
            run.remember(A[t['sp']], t['scene'], t['msg'], t['ok'], t['from'])
            run.remember(B[t['li']], t['scene'], t['msg'], t['ok'], t['from'])
            own = set(run.own_marks(t['to']))
            bor = st['islands'][t['to']].setdefault('borrowed', [])
            for c in t['msg']:
                if c != run.EMPTY and c not in own and c not in bor:
                    bor.append(c)
        # 물려주기
        for k in run.ISLANDS:
            isl = st['islands'][k]
            talks = G['islands'][k]['talks']
            mine_cross = [x for x in cross if k in (x['from'], x['to']) and x.get('msg')]
            isl['recent'] = (isl['recent'] + [t for t in talks if t.get('msg')] + mine_cross)[-run.INHERIT_FROM:]
            tr = inherit_traced(k, isl, gen, random.Random(f'{seed}-{k}-{gen}-inherit'))
            out['islands'][k]['end'] = tr
            prev_mut[k] = {str(b['id']): [m[0] for m in b['mut']] for b in tr['born']}
        st['gen'] = gen
        json.dump(out, open(os.path.join(OUT, f'g{gen:03d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        gen += 1

    # 확인: 재현한 기억 = 실제 상태
    real = json.load(open(run.STATE, encoding='utf-8'))
    bad = 0
    for k in run.ISLANDS:
        mine = sorted((a['id'], a['born'], json.dumps(a['memory'], ensure_ascii=False, sort_keys=True)) for a in st['islands'][k]['agents'])
        theirs = sorted((a['id'], a['born'], json.dumps(a['memory'], ensure_ascii=False, sort_keys=True)) for a in real['islands'][k]['agents'])
        if mine != theirs:
            bad += 1
            print(f'[불일치] {k}', file=sys.stderr)
    print(f'기억 재현: {gen - 1}세대, ' + ('state.json과 일치' if not bad else f'{bad}개 섬 불일치'))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
