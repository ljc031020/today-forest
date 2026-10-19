"""오늘의 숲 — 비교 실험: 메모(기억)를 지운 AI끼리 같은 퀴즈를 하면 얼마나 통할까?

실험 기록(state.json, 세대 기록)은 건드리지 않는다. 결과만 docs/data/control.json에 남긴다.
섬마다 대화 N번(기본 32). 대화마다 말하는 AI와 듣는 AI가 둘 다 빈 메모로 시작한다.
그림 고르는 비율(3:2:1), 쓸 수 있는 글자, 규칙은 본 실험과 똑같다.

  python engine/control.py          # 실제 API
  DRY=1 python engine/control.py    # 흐름만 시험
"""
import datetime, json, os, random, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run  # noqa: E402

OUT = os.path.join(run.DATA, 'control.json')
N = int(os.environ.get('N', str(run.TALKS)))


def main():
    st = run.load_json(run.STATE, None) or run.new_state()
    out = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
           'model': 'dry' if run.DRY else run.MODEL, 'gen': st.get('gen'), 'talks': N, 'islands': {}}
    for k in run.ISLANDS:
        rnd = random.Random(f'control-{k}-{st.get("gen")}')
        isl = {'borrowed': []}  # 손님 글자 없이, 원래 글자만
        recs = []
        for t in range(N):
            sp = {'id': 1, 'born': 0, 'memory': []}
            li = {'id': 2, 'born': 0, 'memory': []}
            rec, _ = run.talk(k, isl, sp, k, isl, li, rnd)
            recs.append({x: rec.get(x) for x in ('scene', 'msg', 'cands', 'guess', 'ok')})
        ok = sum(1 for r in recs if r.get('ok'))
        real = (run.load_json(run.SUMMARY, {'gens': []})['gens'] or [{}])[-1].get('islands', {}).get(k, {}).get('ok')
        out['islands'][k] = {'ok': ok, 'talks': N, 'real_ok': real, 'samples': recs}
        print(f"{run.ISLANDS[k]['ko']}: 메모 없이 {ok}/{N} 통함 (같은 시점 본 실험 {real}/32)", flush=True)
    run.save_json(OUT, out, indent=1)


if __name__ == '__main__':
    main()
