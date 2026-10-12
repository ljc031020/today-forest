"""두 섬 사이 대화를 미리 시험한다. 실험 기록은 바꾸지 않는다."""
import copy, json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run

st = copy.deepcopy(run.load_json(run.STATE, None))
rnd = random.Random(7)
ok = 0
for t in range(int(os.environ.get('N', '6'))):
    a, b = run.MEET if t % 2 == 0 else run.MEET[::-1]
    A, B = st['islands'][a], st['islands'][b]
    rec, blocked = run.talk(a, A, rnd.choice(A['agents']), b, B, rnd.choice(B['agents']), rnd)
    ok += bool(rec.get('ok'))
    print(json.dumps({k: rec.get(k) for k in ('from', 'to', 'scene', 'msg', 'guess', 'ok')}, ensure_ascii=False),
          '| blocked:', [x['why'] for x in blocked])
print('통함', ok)
