# 발표하는 법

## 그냥 띄우기 (인터넷만 있으면 됨)

브라우저에서 https://ljc031020.github.io/today-forest/story.html 을 열고 F11로 전체 화면, ← → 키로 넘긴다. 마지막 장의 QR은 사이트(오늘의 언어)로 간다.

- `→` `Space` `Page Down`: 다음 장면 / `←` `Page Up`: 이전 장면 (프레젠터 리모컨도 됨)
- `H`: 도움말
- '지금 이 순간' 장면에서 `1` 글자 섬 · `2` 그림 섬 · `3` 비교 섬 · `4` 두 섬 사이 · `R` 처음부터
- 숫자와 글자는 열 때마다 최신 기록으로 계산된다. 이때 '지금 이 순간'은 가장 최근 세대의 대화를 다시 보여준다(기록 재생).

## 진짜 실시간으로 (노트북에서 지금 대화를 만들어 보여주기)

처음 한 번 (PowerShell):

```powershell
git clone https://github.com/ljc031020/today-forest
cd today-forest
```

발표 직전:

```powershell
cd today-forest
git pull
$env:ANTHROPIC_API_KEY = "sk-ant-..."   # 메모해 둔 키
python engine\live.py
```

브라우저가 http://localhost:8000/index.html#/talk 로 열린다. 위쪽에 `● 실시간으로` 버튼이 보이면 누르는 순간부터 AI들이 그 자리에서 새 대화를 만든다.

- 키가 없거나 인터넷이 끊기면 자동으로 기록 재생으로 바뀐다. 발표가 멈추지 않는다.
- 여기서 만든 대화는 실험 기록에 섞이지 않고 `docs/data/live/`에 따로 저장된다.
- 끝낼 때는 PowerShell에서 `Ctrl+C`.

## 발표 전날 할 일

- `docs/data/notes.json`에 하고 싶은 말을 한 줄씩 넣으면 '알게 된 것' 장면 아래에 나온다. 예: `["글자 섬의 숲은 14세대에 나무를 잊었다.", "..."]`
