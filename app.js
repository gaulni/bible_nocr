/* ============================================
   현대어 성경 PWA - 앱 로직
   ============================================ */

const STORAGE_KEYS = {
  settings: 'bible_settings',
  bookmarks: 'bible_bookmarks',
  highlights: 'bible_highlights',
  lastRead: 'bible_last_read',
};

const state = {
  books: [],           // 책 목록 (가벼움)
  currentBook: null,   // 현재 로드된 책 데이터 (무거움)
  currentBookNum: 1,
  currentChapter: 1,
  bookmarks: {},       // {"01-1-1": true}
  highlights: {},      // {"01-1-1": "yellow"}
  bookCache: new Map(),
  allVersesIndex: null, // 검색용 평탄화 인덱스 (lazy)
  selectedVerse: null,
};

// ============================================
// 초기화
// ============================================

async function init() {
  loadSettings();
  loadBookmarksHighlights();
  
  try {
    const res = await fetch('books/index.json');
    state.books = await res.json();
  } catch (e) {
    showToast('책 목록 로딩 실패');
    return;
  }

  // 마지막 읽은 위치 복원
  const last = localStorage.getItem(STORAGE_KEYS.lastRead);
  if (last) {
    const { book, chapter } = JSON.parse(last);
    state.currentBookNum = book;
    state.currentChapter = chapter;
  }

  renderBookList();
  await loadChapter(state.currentBookNum, state.currentChapter);
  bindEvents();
  registerSW();
}

// ============================================
// 설정 관리
// ============================================

function loadSettings() {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
  const theme = s.theme || 'light';
  const font = s.font || 'serif';
  const size = s.size || 'm';
  const lh = s.lh || 'normal';

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.font = font;
  document.documentElement.dataset.size = size;
  document.documentElement.dataset.lh = lh;

  updateSettingButtons();
}

function saveSetting(key, value) {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
  s[key] = value;
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s));
  document.documentElement.dataset[key] = value;
  updateSettingButtons();
}

function updateSettingButtons() {
  const root = document.documentElement.dataset;
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === root.theme));
  document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b.dataset.font === root.font));
  document.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === root.size));
  document.querySelectorAll('[data-lh]').forEach(b => b.classList.toggle('active', b.dataset.lh === root.lh));
}

// ============================================
// 북마크 & 하이라이트
// ============================================

function loadBookmarksHighlights() {
  state.bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.bookmarks) || '{}');
  state.highlights = JSON.parse(localStorage.getItem(STORAGE_KEYS.highlights) || '{}');
}

function verseKey(book, chap, verse) {
  return `${String(book).padStart(2, '0')}-${chap}-${verse}`;
}

function toggleBookmark(book, chap, verse) {
  const k = verseKey(book, chap, verse);
  if (state.bookmarks[k]) {
    delete state.bookmarks[k];
    showToast('북마크 해제');
  } else {
    state.bookmarks[k] = { book, chap, verse, ts: Date.now() };
    showToast('북마크 추가');
  }
  localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(state.bookmarks));
}

function setHighlight(book, chap, verse, color) {
  const k = verseKey(book, chap, verse);
  if (color === null) {
    delete state.highlights[k];
  } else {
    state.highlights[k] = { book, chap, verse, color, ts: Date.now() };
  }
  localStorage.setItem(STORAGE_KEYS.highlights, JSON.stringify(state.highlights));
}

// ============================================
// 본문 로딩 & 렌더링
// ============================================

async function loadBookData(bookNum) {
  const key = String(bookNum).padStart(2, '0');
  if (state.bookCache.has(key)) {
    return state.bookCache.get(key);
  }
  const res = await fetch(`books/${key}.json`);
  const data = await res.json();
  state.bookCache.set(key, data);
  return data;
}

async function loadChapter(bookNum, chapter) {
  const inner = document.getElementById('reader-inner');
  inner.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    const book = await loadBookData(bookNum);
    state.currentBook = book;
    state.currentBookNum = bookNum;
    state.currentChapter = chapter;

    // 마지막 위치 저장
    localStorage.setItem(STORAGE_KEYS.lastRead, JSON.stringify({
      book: bookNum,
      chapter: chapter
    }));

    renderChapter(book, chapter);
    updateTopbar(book, chapter);

    // 스크롤 맨 위
    document.getElementById('reader').scrollTop = 0;
  } catch (e) {
    inner.innerHTML = '<div class="loading">불러오기 실패</div>';
    console.error(e);
  }
}

function renderChapter(book, chapter) {
  const verses = book.chapters[String(chapter)] || [];
  const bookPad = String(book.num).padStart(2, '0');
  
  let html = `
    <div class="chapter-header">
      <div class="book-name">${book.name}</div>
      <div class="chapter-num">${chapter}장</div>
    </div>
    <div class="verses">
  `;

  verses.forEach(v => {
    const k = verseKey(book.num, chapter, v.v);
    const isBookmark = !!state.bookmarks[k];
    const hlColor = state.highlights[k]?.color;
    const classes = ['verse'];
    if (hlColor) classes.push(`hl-${hlColor}`);
    
    html += `<div class="${classes.join(' ')}" data-verse="${v.v}" data-key="${k}">`;
    html += `<span class="verse-num">${v.v}</span>`;
    html += escapeHtml(v.t);
    if (isBookmark) html += '<span class="bookmark-mark"></span>';
    html += '</div>';
  });

  html += '</div>';
  document.getElementById('reader-inner').innerHTML = html;
}

function updateTopbar(book, chapter) {
  document.getElementById('current-ref').textContent = `${book.name} ${chapter}장`;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ============================================
// 목차 & 장 선택
// ============================================

function renderBookList(filter = 'ot') {
  const list = document.getElementById('book-list');
  const books = state.books.filter(b => 
    filter === 'ot' ? b.testament === 'OT' : b.testament === 'NT'
  );
  list.innerHTML = books.map(b => `
    <button class="book-item ${b.num === state.currentBookNum ? 'active' : ''}" data-book="${b.num}">
      <span>${b.name}</span>
      <span class="chap-count">${b.total_chapters}장</span>
    </button>
  `).join('');
}

function openChapterPicker(bookNum) {
  const book = state.books.find(b => b.num === bookNum);
  if (!book) return;
  
  document.getElementById('chapter-book-title').textContent = book.name;
  const grid = document.getElementById('chapter-grid');
  let html = '';
  for (let i = 1; i <= book.total_chapters; i++) {
    const isCurrent = bookNum === state.currentBookNum && i === state.currentChapter;
    html += `<button class="chap-btn ${isCurrent ? 'current' : ''}" data-chap="${i}">${i}</button>`;
  }
  grid.innerHTML = html;
  grid.dataset.bookNum = bookNum;
  
  closeAllSheets();
  openSheet('sheet-chapter');
}

// ============================================
// 검색
// ============================================

// 책 약어 → 번호 매핑
function parseReference(query) {
  // "요 3:16", "요3:16", "요한복음 3:16" 등
  const m = query.trim().match(/^(.+?)\s*(\d+)\s*[:.]\s*(\d+)$/);
  if (!m) return null;
  const [, bookStr, chap, verse] = m;
  const book = state.books.find(b => 
    b.name === bookStr.trim() || b.abbr === bookStr.trim()
  );
  if (!book) return null;
  return { bookNum: book.num, chapter: parseInt(chap), verse: parseInt(verse) };
}

async function buildSearchIndex() {
  if (state.allVersesIndex) return state.allVersesIndex;
  
  // 전체 성경 로드 (검색용)
  const res = await fetch('bible.json');
  const data = await res.json();
  
  const index = [];
  data.books.forEach(book => {
    Object.keys(book.chapters).forEach(ch => {
      book.chapters[ch].forEach(v => {
        index.push({
          bookNum: book.num,
          bookName: book.name,
          bookAbbr: book.abbr,
          chapter: parseInt(ch),
          verse: v.v,
          text: v.t
        });
      });
    });
  });
  
  state.allVersesIndex = index;
  return index;
}

async function search(query) {
  const results = document.getElementById('search-results');
  
  if (query.length < 2) {
    results.innerHTML = '<p class="hint">두 글자 이상 입력하세요.</p>';
    return;
  }

  // 1. 구절 참조 시도 (예: "요 3:16")
  const ref = parseReference(query);
  if (ref) {
    results.innerHTML = `
      <div class="search-meta">구절 이동</div>
      <button class="search-item" data-goto="${ref.bookNum}-${ref.chapter}">
        <div class="ref">${state.books.find(b => b.num === ref.bookNum).name} ${ref.chapter}:${ref.verse}</div>
        <div class="snippet">이 구절로 이동</div>
      </button>
    `;
    return;
  }

  // 2. 텍스트 검색
  results.innerHTML = '<p class="hint">검색 중...</p>';
  const index = await buildSearchIndex();
  
  const q = query.trim();
  const matches = [];
  for (const v of index) {
    if (v.text.includes(q)) {
      matches.push(v);
      if (matches.length >= 200) break;
    }
  }

  if (matches.length === 0) {
    results.innerHTML = '<p class="hint">검색 결과가 없습니다.</p>';
    return;
  }

  const safeQ = escapeHtml(q);
  const regex = new RegExp(safeQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  
  let html = `<div class="search-meta">${matches.length}개 구절${matches.length >= 200 ? ' (200개까지 표시)' : ''}</div>`;
  html += matches.map(m => {
    const highlighted = escapeHtml(m.text).replace(regex, '<mark>$&</mark>');
    return `
      <button class="search-item" data-goto="${m.bookNum}-${m.chapter}" data-verse="${m.verse}">
        <div class="ref">${m.bookName} ${m.chapter}:${m.verse}</div>
        <div class="snippet">${highlighted}</div>
      </button>
    `;
  }).join('');
  
  results.innerHTML = html;
}

// ============================================
// 저장된 항목 (북마크/하이라이트) 표시
// ============================================

async function renderSavedList(type = 'bookmarks') {
  const list = document.getElementById('saved-list');
  const items = type === 'bookmarks' 
    ? Object.values(state.bookmarks)
    : Object.values(state.highlights);
  
  if (items.length === 0) {
    list.innerHTML = `<div class="empty">${type === 'bookmarks' ? '북마크' : '하이라이트'}가 없습니다.</div>`;
    return;
  }

  items.sort((a, b) => b.ts - a.ts);
  
  // 필요한 책만 로드 (전체 성경 안 부름 → X 버튼 먹힘, 빠름)
  const neededBooks = [...new Set(items.map(i => i.book))];
  const loadedBooks = {};
  await Promise.all(neededBooks.map(async (num) => {
    loadedBooks[num] = await loadBookData(num);
  }));
  
  const getVerse = (book, chap, verse) => {
    const b = loadedBooks[book];
    if (!b) return '';
    const chapVerses = b.chapters[String(chap)];
    if (!chapVerses) return '';
    const found = chapVerses.find(v => v.v === verse);
    return found ? found.t : '';
  };
  const getBookName = (num) => {
    const b = state.books.find(bk => bk.num === num);
    return b ? b.name : '';
  };
  
  list.innerHTML = items.map(item => {
    const text = getVerse(item.book, item.chap, item.verse);
    const name = getBookName(item.book);
    const colorDot = type === 'highlights' 
      ? `<div class="hl-dot hl-${item.color}"></div>` 
      : '';
    return `
      <button class="saved-item" data-goto="${item.book}-${item.chap}" data-verse="${item.verse}">
        <div style="flex:1; min-width:0;">
          <div class="ref">${name} ${item.chap}:${item.verse}</div>
          <div class="snippet">${escapeHtml(text)}</div>
        </div>
        ${colorDot}
      </button>
    `;
  }).join('');
}

// ============================================
// 구절 액션 (하이라이트, 북마크, 복사)
// ============================================

function showVerseActions(verseEl) {
  const actions = document.getElementById('verse-actions');
  const rect = verseEl.getBoundingClientRect();
  const actionsWidth = 280; // 추정
  const left = Math.max(10, Math.min(
    rect.left + rect.width / 2 - actionsWidth / 2,
    window.innerWidth - actionsWidth - 10
  ));
  
  let top = rect.top - 50;
  if (top < 70) top = rect.bottom + 8;
  
  actions.style.left = `${left}px`;
  actions.style.top = `${top}px`;
  actions.hidden = false;
  
  state.selectedVerse = {
    verse: parseInt(verseEl.dataset.verse),
    el: verseEl
  };
  verseEl.classList.add('selected');
}

function hideVerseActions() {
  document.getElementById('verse-actions').hidden = true;
  if (state.selectedVerse) {
    state.selectedVerse.el.classList.remove('selected');
    state.selectedVerse = null;
  }
}

function handleVerseAction(action) {
  if (!state.selectedVerse) return;
  const { verse, el } = state.selectedVerse;
  const book = state.currentBookNum;
  const chap = state.currentChapter;
  
  if (action.startsWith('highlight-')) {
    const color = action.replace('highlight-', '');
    if (color === 'clear') {
      setHighlight(book, chap, verse, null);
      el.classList.remove('hl-yellow', 'hl-green', 'hl-blue', 'hl-pink');
    } else {
      setHighlight(book, chap, verse, color);
      el.classList.remove('hl-yellow', 'hl-green', 'hl-blue', 'hl-pink');
      el.classList.add(`hl-${color}`);
    }
  } else if (action === 'bookmark') {
    toggleBookmark(book, chap, verse);
    // 다시 그리기 위해 재렌더
    renderChapter(state.currentBook, chap);
  } else if (action === 'copy') {
    const text = el.textContent.replace(/^\d+/, '').trim();
    const ref = `${state.currentBook.name} ${chap}:${verse}`;
    navigator.clipboard.writeText(`${text}\n— ${ref}`)
      .then(() => showToast('복사됨'))
      .catch(() => showToast('복사 실패'));
  }
  hideVerseActions();
}

// ============================================
// 이전/다음 장 이동
// ============================================

async function navigate(direction) {
  const book = state.currentBook;
  if (!book) return;
  
  let newBook = state.currentBookNum;
  let newChap = state.currentChapter + (direction === 'next' ? 1 : -1);
  
  if (newChap < 1) {
    // 이전 책 마지막 장
    newBook--;
    if (newBook < 1) return;
    const prevBook = state.books.find(b => b.num === newBook);
    newChap = prevBook.total_chapters;
  } else if (newChap > book.total_chapters) {
    // 다음 책 첫 장
    newBook++;
    if (newBook > 66) return;
    newChap = 1;
  }
  
  await loadChapter(newBook, newChap);
}

// ============================================
// 시트 열기/닫기
// ============================================

function openSheet(id) {
  document.getElementById(id).hidden = false;
}

function closeAllSheets() {
  document.querySelectorAll('.sheet').forEach(s => s.hidden = true);
}

// ============================================
// 토스트
// ============================================

let toastTimer = null;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (toast) toast.remove();
  toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2000);
}

// ============================================
// 이벤트 바인딩
// ============================================

function bindEvents() {
  // 상단 바
  document.getElementById('btn-menu').onclick = () => {
    closeAllSheets();
    renderBookList(document.querySelector('.tab.active')?.dataset.tab || 'ot');
    openSheet('sheet-toc');
  };
  document.getElementById('btn-ref').onclick = () => openChapterPicker(state.currentBookNum);
  document.getElementById('btn-search').onclick = () => {
    closeAllSheets();
    openSheet('sheet-search');
    setTimeout(() => document.getElementById('search-input').focus(), 100);
  };

  // 하단 바
  document.getElementById('btn-prev').onclick = () => navigate('prev');
  document.getElementById('btn-next').onclick = () => navigate('next');
  document.getElementById('btn-bookmarks').onclick = () => {
    closeAllSheets();
    // 항상 북마크 탭부터 시작
    document.querySelectorAll('[data-btab]').forEach(t => t.classList.remove('active'));
    const bookmarkTab = document.querySelector('[data-btab="bookmarks"]');
    if (bookmarkTab) bookmarkTab.classList.add('active');
    renderSavedList('bookmarks');
    openSheet('sheet-bookmarks');
  };
  document.getElementById('btn-settings').onclick = () => {
    closeAllSheets();
    openSheet('sheet-settings');
  };

  // 시트 닫기
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) {
      closeAllSheets();
      hideVerseActions();
    }
  });

  // 책 목록 탭
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderBookList(tab.dataset.tab);
    };
  });

  // 북마크/하이라이트 탭
  document.querySelectorAll('[data-btab]').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('[data-btab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSavedList(tab.dataset.btab);
    };
  });

  // 책 선택
  document.getElementById('book-list').onclick = e => {
    const btn = e.target.closest('[data-book]');
    if (!btn) return;
    openChapterPicker(parseInt(btn.dataset.book));
  };

  // 장 선택
  document.getElementById('chapter-grid').onclick = async e => {
    const btn = e.target.closest('[data-chap]');
    if (!btn) return;
    const bookNum = parseInt(e.currentTarget.dataset.bookNum);
    const chap = parseInt(btn.dataset.chap);
    closeAllSheets();
    await loadChapter(bookNum, chap);
  };

  // 검색
  let searchTimer = null;
  document.getElementById('search-input').oninput = e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => search(e.target.value), 250);
  };

  // 검색 결과 클릭
  document.getElementById('search-results').onclick = async e => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    const [book, chap] = btn.dataset.goto.split('-').map(Number);
    const targetVerse = btn.dataset.verse ? parseInt(btn.dataset.verse) : null;
    closeAllSheets();
    await loadChapter(book, chap);
    if (targetVerse) {
      setTimeout(() => {
        const el = document.querySelector(`[data-verse="${targetVerse}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'background 0.3s';
          const original = el.style.background;
          el.style.background = 'var(--accent-soft)';
          setTimeout(() => el.style.background = original, 1500);
        }
      }, 100);
    }
  };

  // 저장 목록 클릭
  document.getElementById('saved-list').onclick = async e => {
    const btn = e.target.closest('[data-goto]');
    if (!btn) return;
    const [book, chap] = btn.dataset.goto.split('-').map(Number);
    const verse = parseInt(btn.dataset.verse);
    closeAllSheets();
    await loadChapter(book, chap);
    setTimeout(() => {
      const el = document.querySelector(`[data-verse="${verse}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // 설정 버튼들
  document.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => saveSetting('theme', b.dataset.theme));
  document.querySelectorAll('[data-font]').forEach(b => b.onclick = () => saveSetting('font', b.dataset.font));
  document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => saveSetting('size', b.dataset.size));
  document.querySelectorAll('[data-lh]').forEach(b => b.onclick = () => saveSetting('lh', b.dataset.lh));

  // 구절 탭/롱프레스
  let pressTimer = null;
  let longPressed = false;
  
  const reader = document.getElementById('reader-inner');
  
  reader.addEventListener('touchstart', e => {
    const verseEl = e.target.closest('.verse');
    if (!verseEl) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      showVerseActions(verseEl);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 400);
  }, { passive: true });
  
  reader.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
  reader.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
  
  // 데스크톱: 더블클릭으로 액션 표시
  reader.addEventListener('dblclick', e => {
    const verseEl = e.target.closest('.verse');
    if (!verseEl) return;
    showVerseActions(verseEl);
  });

  // 액션 팝오버 버튼
  document.getElementById('verse-actions').onclick = e => {
    const btn = e.target.closest('[data-action]');
    if (btn) handleVerseAction(btn.dataset.action);
  };

  // 빈 곳 탭하면 액션 닫기
  document.addEventListener('click', e => {
    if (!e.target.closest('.verse-actions') && !e.target.closest('.verse')) {
      hideVerseActions();
    }
  });

  // 키보드 단축키
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') navigate('prev');
    else if (e.key === 'ArrowRight') navigate('next');
    else if (e.key === 'Escape') { closeAllSheets(); hideVerseActions(); }
    else if (e.key === '/') { e.preventDefault(); document.getElementById('btn-search').click(); }
  });
}

// ============================================
// 서비스 워커
// ============================================

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

// 시작
init();
