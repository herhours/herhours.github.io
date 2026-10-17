// Screen language follows the phone: Korean phones get Korean, everyone else English (영샘 10-04).
// ?lang=en / ?lang=ko overrides it, for testing on one machine.
(() => {
  const q = new URLSearchParams(location.search).get('lang');
  const lang = q === 'en' || q === 'ko' ? q : (navigator.language || '').toLowerCase().startsWith('ko') ? 'ko' : 'en';
  self.HH_LANG = lang;
  // Dynamic strings keep both languages side by side at the call site: T('한국어', 'English').
  self.T = (ko, en) => (lang === 'ko' ? ko : en);
  document.documentElement.lang = lang;
  if (lang === 'ko') return;

  // Static page text, keyed by the Korean exactly as written in index.html.
  const EN = {
    '정보': 'Info',
    '미리보기': 'Preview',
    '스타일': 'Style',
    '사진': 'Photos',
    '노래': 'Song',
    '글자': 'Text',
    '쇼츠 만들기': 'Make my Short',
    '인스타에 올리기': 'Share to Instagram',
    '저장': 'Save',
    '다시 만들기': 'Make another',
    '옆으로 밀어서 골라요. 고르는 즉시 위 영상이 바뀌어요.': 'Swipe to choose. The video above changes as soon as you pick.',
    '확인': 'Done',
    '사진 · 영상': 'Photos · Videos',
    '사진·영상 고르기': 'Choose photos·videos',
    '예시로': 'Use demo',
    '고르면 바로 위 화면에 나와요.': 'They go straight into the preview above.',
    '영상 소리': 'Video sound',
    '영상이 화면에 나올 때만 노래 밑에 깔려요.': 'Plays under the song only while that video is on screen.',
    'Her Hours · 가사가 박자에 맞춰 켜져요': 'Her Hours · lyrics light up on the beat',
    '내 음악 파일': 'My own song',
    '내 노래 파일을 골라요. 길이와 시작점은 아래에서.': 'Pick a song file. Length and start point below.',
    '길이': 'Length',
    '15초': '15s', '32초': '32s', '60초': '60s', '90초': '90s', '3분': '3 min',
    '어디부터': 'Start at',
    '처음부터': 'From the top',
    '후렴부터': 'From the chorus',
    '글 넣기 · 가사나 한마디': 'Add words · lyrics or a line',
    '붙여넣고 톡톡 눌러 맞춰요': 'Paste, then tap along to time them',
    '글 · 가사나 한마디': 'Words · lyrics or a line',
    '톡 — 지금 이 줄': 'Tap — this line now',
    '한 줄 뒤로': 'Back one line',
    '끝': 'Finish',
    '「눌러서 맞추기」를 누르면 고른 시작점부터 노래가 나와요. 그 줄이 떠야 할 때 큰 버튼을 톡. 컴퓨터에선 스페이스바(한 줄 뒤로는 백스페이스).':
      'Press “Tap to time” and the song plays from your start point. Tap the big button when each line should appear. On a computer: Space (Backspace to go back a line).',
    '눌러서 맞추기': 'Tap to time',
    '이름': 'Name',
    '제목 1': 'Title 1',
    '제목 2': 'Title 2',
    '치는 대로 위 영상에 바로 반영돼요.': 'What you type shows up in the video right away.',
    '기기 정보': 'Device info',
    '닫기': 'Close',
    '불러오는 중…': 'Loading…',
    '사용법': 'How it works',
    '안내 · 개인정보': 'About · Privacy',
    '사진 + 노래 하나 → 쇼츠': 'Your photos + one song → a Short',
    '영상 모양을 골라요': 'Pick the style of the video',
    '내 사진이나 영상을 넣어요': 'Add your own photos or clips',
    '내 노래를 고르고, 후렴부터 시작할 수도 있어요': 'Choose your song — it can start right at the chorus',
    '그다음 「쇼츠 만들기」. 폰 안에서 바로 만들어져요.': 'Then tap “Make my Short”. It’s made right on your phone.',
    '사진과 노래는 이 폰 밖으로 나가지 않아요.': 'Your photos and songs never leave this phone.',
    '시험판이라 사용 기록(기종·단계·오류)을 모아요.': 'Test build: we collect usage logs (device, steps, errors).',
    '시작하기': 'Let’s go',
    '① 스타일': '① Style', '② 사진 · 영상': '② Photos · Videos', '③ 노래': '③ Song', '④ 글자': '④ Text',
    '다음 · 사진': 'Next · Photos', '다음 · 노래': 'Next · Song', '다음 · 글자': 'Next · Text', '다 됐어요': 'All set',
    '내 영상': 'My videos',
    '만들던 게 있어요': 'You were making one',
    '이어서 만들기': 'Pick up where I left off',
    '새로 시작': 'Start fresh',
    '이 폰에만 남아요 · 최근 8개. 영상 파일은 만든 뒤 「저장」해야 폰에 남아요. 「다시 열기」는 그때 고른 스타일·사진·노래로 돌아가요.':
      'Kept on this phone only · the latest 8. The video file itself stays only if you “Save” it. “Open again” brings back the style, photos and song you used.',
    '재생 / 멈춤': 'Play / pause',
    '구간 이동': 'Seek',
    '시작점': 'Start point',
    '한 줄에 한 마디씩 써요\n가사도 좋고, 그날의 한마디도 좋아요\n예) 첫 눈 / 첫 활강 / 오늘은 우리 둘이':
      'One line per phrase\nLyrics, or just a word about the day\ne.g. first snow / first run / just the two of us',
  };
  self.HH_EN = EN;
  const tr = (s) => { const k = s.trim(); return k && EN[k] ? s.replace(k, EN[k]) : s; };
  const run = () => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) n.nodeValue = tr(n.nodeValue);
    document.querySelectorAll('[aria-label],[placeholder]').forEach((el) => {
      for (const a of ['aria-label', 'placeholder']) if (el.hasAttribute(a)) el.setAttribute(a, tr(el.getAttribute(a)));
    });
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
})();
