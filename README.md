# 현대어 성경 PWA

나만 쓰는 개인 성경 앱. HTML/CSS/JS로 만든 Progressive Web App.

---

## 📁 파일 구조

```
pwa/
├── index.html          # 앱 메인 페이지
├── style.css           # 스타일 (3가지 테마)
├── app.js              # 앱 로직
├── manifest.json       # PWA 설정
├── service-worker.js   # 오프라인 지원
├── icon-192.png        # 앱 아이콘
├── icon-512.png
├── bible.json          # 전체 성경 (검색용)
└── books/              # 책별 분할 파일
    ├── index.json      # 책 목록
    ├── 01.json         # 창세기
    ├── 02.json         # 출애굽기
    └── ... (66권)
```

---

## ✨ 포함된 기능

- **읽기**: 책/장 선택, 이전·다음 장 이동, 마지막 읽은 위치 자동 저장
- **검색**: 
  - 텍스트 검색 (예: "사랑")
  - 구절 참조 검색 (예: "요 3:16", "창세기 1:1")
  - 검색어 하이라이트
- **북마크**: 구절 길게 누르면 북마크 추가/해제
- **하이라이트**: 4가지 색상 (노랑/초록/파랑/분홍)
- **복사**: 구절 + 출처 자동 복사
- **설정**:
  - 테마 3종: 밝게 / 세피아 / 어둡게
  - 글자 크기 4단계
  - 글꼴 3종: 명조 / 고운바탕 / 고딕
  - 줄 간격 3단계
- **오프라인 작동**: Service Worker 캐싱
- **키보드 단축키**: ← → (장 이동), / (검색), ESC (닫기)

---

## 🚀 로컬에서 실행하기

파일:// 프로토콜로는 fetch가 안 되므로 로컬 서버가 필요해요.

### Python (가장 간단)
```bash
cd pwa
python3 -m http.server 8000
```
→ 브라우저에서 http://localhost:8000 열기

### Node.js
```bash
npx serve pwa
```

### VS Code
Live Server 확장 설치 후 `index.html` 우클릭 → "Open with Live Server"

---

## 📱 폰에 "앱"으로 설치하기

### 1단계: 어딘가에 호스팅
무료 옵션들:
- **GitHub Pages** (추천): 깃허브 저장소에 올리면 끝
- **Netlify**: 폴더 드래그하면 끝
- **Cloudflare Pages**: 비슷
- **Vercel**: 비슷

**HTTPS 필수** (PWA 요구사항). 위 서비스들은 다 HTTPS 기본 제공.

### 2단계: 폰에서 접속 후 설치
- **iPhone (Safari)**: 공유 → "홈 화면에 추가"
- **Android (Chrome)**: 주소창 오른쪽 메뉴 → "앱 설치" 또는 "홈 화면에 추가"

설치하면 홈 화면에 아이콘 생기고, 탭하면 주소창 없이 앱처럼 실행됨.

---

## 🔧 커스터마이징 포인트

### 테마 색 바꾸기
`style.css` 상단 `:root` / `[data-theme="sepia"]` / `[data-theme="dark"]` 변수 수정

### 폰트 바꾸기
`index.html`의 Google Fonts `<link>` 수정하고 `style.css`의 `--font-*` 변수 수정

### 아이콘 바꾸기
`icon-192.png`, `icon-512.png` 교체 (PNG, 투명 배경)

### 책 번호·이름 수정
`books/index.json`과 각 `books/XX.json`의 `name`, `abbr` 필드 수정

---

## 💾 데이터 저장 위치

모든 개인 데이터(북마크, 하이라이트, 설정, 마지막 위치)는 **브라우저의 localStorage**에 저장됨.

- 같은 브라우저·같은 도메인이면 유지
- 다른 기기 동기화 안 됨 (개인 앱이니까)
- 브라우저 데이터 지우면 사라짐 → 중요한 북마크는 백업 권장

### 데이터 수동 백업
브라우저 콘솔 열어서:
```js
// 백업
copy(JSON.stringify({
  bookmarks: localStorage.getItem('bible_bookmarks'),
  highlights: localStorage.getItem('bible_highlights'),
  settings: localStorage.getItem('bible_settings'),
}))

// 복원
const data = JSON.parse(/* 붙여넣기 */);
localStorage.setItem('bible_bookmarks', data.bookmarks);
localStorage.setItem('bible_highlights', data.highlights);
localStorage.setItem('bible_settings', data.settings);
```

---

## 📐 기술 스택

- **순수 HTML/CSS/JS** (프레임워크 없음)
- **Service Worker** for 오프라인
- **localStorage** for 개인 데이터
- **Fetch API** for 책별 lazy loading
- Google Fonts: Noto Serif KR, Gowun Batang

프레임워크 안 쓴 이유: 개인용이고, 가볍고, 수정하기 쉽게.

---

## 🐛 알려진 제약

- iOS Safari에서 진동(vibrate) 동작 안 함 (기능상 문제 없음)
- 검색은 전체 성경 로드 후 동작 → 첫 검색 시 약간 지연 (이후 메모리에 유지)
- 3만 개 구절 전체 검색해도 0.1초 이내지만, 매우 흔한 단어(예: "의")는 결과 많아 렌더링 느릴 수 있음 → 상위 200개만 표시

---

## 🔜 확장 아이디어

나중에 추가하면 좋을 것들:

- **여러 역본 비교**: 개역개정 등 추가 JSON 파일 넣고 토글
- **읽기 계획**: 일독 / 맥체인 계획 데이터 + 진도 체크
- **메모**: 하이라이트에 개인 메모 첨부
- **스와이프 제스처**: 좌우 스와이프로 장 이동
- **다크모드 자동 전환**: prefers-color-scheme 감지
- **이어듣기/TTS**: Web Speech API로 성경 낭독

필요하시면 언제든 요청하세요.
