"""발표용 실시간 무대.

노트북에서 실행하면 사이트를 http://localhost:8000 으로 띄우고,
발표 모드의 '지금 이 순간' 장면이 실제로 새 대화를 만들어 그 자리에서 보여준다.

PowerShell:
  $env:ANTHROPIC_API_KEY = "sk-ant-..."
  python engine\\live.py
그다음 브라우저에서 http://localhost:8000/index.html#/talk

키가 없거나 인터넷이 끊기면 발표 모드는 자동으로 '기록 재생'으로 바뀐다.
여기서 나눈 대화는 실험 기록(state)에 섞이지 않고 docs/data/live/ 에 따로 저장된다.
"""
import copy, datetime, http.server, json, os, random, socketserver, sys, threading, urllib.parse, webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run  # noqa: E402

DOCS = os.path.join(run.ROOT, 'docs')
PORT = int(os.environ.get('PORT', '8000'))
LOCK = threading.Lock()


def state():
    return run.load_json(run.STATE, None)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DOCS, **kw)

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/api/ping':
            st = state()
            body = json.dumps({'live': True, 'key': bool(os.environ.get('ANTHROPIC_API_KEY')) or run.DRY,
                               'gen': st['gen'] if st else 0}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(body); return
        if u.path == '/api/live':
            return self.live(urllib.parse.parse_qs(u.query))
        return super().do_GET()

    def live(self, q):
        mode = (q.get('island') or ['line'])[0]
        n = max(1, min(32, int((q.get('n') or ['8'])[0])))
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()

        def send(kind, rec):
            data = json.dumps({'kind': kind, **{k: v for k, v in rec.items() if not k.startswith('raw')}}, ensure_ascii=False)
            self.wfile.write(f'data: {data}\n\n'.encode()); self.wfile.flush()

        st = state()
        if not st:
            send('error', {'why': 'no state'}); return
        world = copy.deepcopy(st)   # 실험 기록은 건드리지 않는다
        rnd = random.Random()
        log = []
        try:
            for t in range(n):
                if mode == 'cross':
                    a, b = run.MEET if t % 2 == 0 else run.MEET[::-1]
                    A, B = world['islands'][a], world['islands'][b]
                    rec, _ = run.talk(a, A, rnd.choice(A['agents']), b, B, rnd.choice(B['agents']), rnd, on_event=send)
                else:
                    I = world['islands'][mode]
                    sp, li = rnd.sample(I['agents'], 2)
                    rec, _ = run.talk(mode, I, sp, mode, I, li, rnd, on_event=send)
                rec['t'] = t
                log.append(rec)
            send('done', {'n': len(log)})
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:  # 키 문제, 인터넷 문제 등
            try: send('error', {'why': str(e)[:200]})
            except Exception: pass
        finally:
            if log:
                os.makedirs(os.path.join(run.DATA, 'live'), exist_ok=True)
                stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
                with LOCK:
                    run.save_json(os.path.join(run.DATA, 'live', f'{stamp}-{mode}.json'),
                                  {'at': stamp, 'mode': mode, 'gen': st['gen'], 'talks': log})


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    if not os.environ.get('ANTHROPIC_API_KEY') and not run.DRY:
        print('! ANTHROPIC_API_KEY가 없습니다. 발표 모드는 기록 재생으로만 동작합니다.')
    url = f'http://localhost:{PORT}/index.html#/talk'
    print(f'오늘의 숲 · 실시간 무대: {url}  (끝내려면 Ctrl+C)')
    try: webbrowser.open(url)
    except Exception: pass
    Server(('127.0.0.1', PORT), Handler).serve_forever()
