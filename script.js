// Reading list with distinct loading, error, empty and list states.
// Data is kept in localStorage behind an async store, shaped like a
// network API, so swapping in a real backend only means rewriting `store`.
(function () {
  'use strict';

  const STORAGE_KEY = 'reading-list:v1';

  const SAMPLE_BOOKS = [
    { title: 'The Pragmatic Programmer', author: 'David Thomas and Andrew Hunt' },
    { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann' },
    { title: 'Inclusive Design Patterns', author: 'Heydon Pickering' },
  ];

  /* ---------- Demo settings, read from the address bar ---------- */

  const params = new URLSearchParams(window.location.search);
  const demo = {
    delay: params.has('delay') ? clamp(Number(params.get('delay')) || 0, 0, 10000) : 400,
    failLoad: params.get('fail') === 'load',
    failSave: params.get('fail') === 'save',
    reset: params.has('reset'),
    seed: params.has('seed'),
  };

  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- Store ---------- */

  class StoreError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind; // 'network' | 'blocked' | 'corrupt' | 'full'
    }
  }

  function getStorage() {
    try {
      return window.localStorage;
    } catch {
      throw new StoreError('blocked');
    }
  }

  const isBook = (b) => b && typeof b.id === 'string' && typeof b.title === 'string';

  let loadAttempts = 0;

  const store = {
    async load() {
      loadAttempts += 1;
      await wait(demo.delay);
      if (demo.failLoad && loadAttempts === 1) throw new StoreError('network');

      let raw;
      try {
        raw = getStorage().getItem(STORAGE_KEY);
      } catch (err) {
        throw err instanceof StoreError ? err : new StoreError('blocked');
      }
      if (raw === null) return [];

      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error('not a list');
        return data.filter(isBook);
      } catch {
        throw new StoreError('corrupt');
      }
    },

    async save(books) {
      await wait(Math.min(demo.delay, 800));
      if (demo.failSave) throw new StoreError('network');
      try {
        getStorage().setItem(STORAGE_KEY, JSON.stringify(books));
      } catch (err) {
        if (err instanceof StoreError) throw err;
        throw new StoreError(err && err.name === 'QuotaExceededError' ? 'full' : 'blocked');
      }
    },

    clear() {
      try { getStorage().removeItem(STORAGE_KEY); } catch { /* reported on next load */ }
    },
  };

  /* ---------- Messages: what failed, and what to do ---------- */

  const LOAD_ERRORS = {
    network: {
      title: 'Couldn’t load your reading list',
      body: 'The request for your saved books didn’t finish. Check your internet connection, then try again.',
    },
    blocked: {
      title: 'Your reading list can’t be opened',
      body: 'Your browser is blocking site storage for this page, so saved books can’t be read. Allow cookies and site data for this site in your browser settings, then try again.',
    },
    corrupt: {
      title: 'Your saved list couldn’t be read',
      body: 'The saved data is damaged and can’t be opened. Clear it to start a new, empty list. Books that were on it can’t be recovered.',
      offerClear: true,
    },
  };

  const SAVE_FIXES = {
    network: 'Check your internet connection, then try again.',
    blocked: 'Your browser is blocking site storage. Allow cookies and site data for this site, then try again.',
    full: 'Your browser’s storage for this site is full. Remove some books, then try again.',
  };

  function saveErrorMessage(err, action, title) {
    const what = action === 'add'
      ? `Couldn’t add “${title}”. Your list hasn’t changed.`
      : `Couldn’t remove “${title}”. It’s still on your list.`;
    return `${what} ${SAVE_FIXES[err.kind] || 'Please try again.'}`;
  }

  /* ---------- Elements ---------- */

  const $ = (id) => document.getElementById(id);
  const form = $('add-form');
  const fieldset = $('add-fieldset');
  const titleInput = $('title');
  const authorInput = $('author');
  const addButton = $('add-button');
  const titleError = $('title-error');
  const formError = $('form-error');
  const listSection = $('list-section');
  const listHeading = $('list-heading');
  const countEl = $('count');
  const listError = $('list-error');
  const view = $('view');
  const statusEl = $('status');
  const banner = $('demo-banner');
  const bannerText = $('demo-banner-text');

  /* ---------- State ---------- */

  const state = { status: 'loading', books: [], error: null };
  let busy = false; // one save at a time, so saves can't overwrite each other

  /* ---------- Helpers ---------- */

  // Builds elements; strings become text nodes, so user input is never parsed as HTML.
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    }
    node.append(...children);
    return node;
  }

  function makeId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  function bookCount(n) { return `${n} ${n === 1 ? 'book' : 'books'}`; }

  function announce(message) {
    statusEl.textContent = '';
    window.setTimeout(() => { statusEl.textContent = message; }, 50);
  }

  function focusStateHeading() {
    (view.querySelector('.state-title') || listHeading).focus();
  }

  /* ---------- Views ---------- */

  const BOOK_ICON =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  function loadingView() {
    return el('div', { class: 'state state-loading' },
      el('p', { class: 'loading-text' },
        el('span', { class: 'spinner', 'aria-hidden': 'true' }),
        'Loading your reading list…'),
      el('ul', { class: 'skeleton', 'aria-hidden': 'true' }, el('li'), el('li'), el('li')));
  }

  function errorView() {
    const info = LOAD_ERRORS[state.error.kind] || LOAD_ERRORS.network;
    const actions = el('div', { class: 'state-actions' },
      el('button', { type: 'button', class: 'btn btn-primary', onclick: () => loadList({ moveFocus: true }) }, 'Try again'));
    if (info.offerClear) {
      actions.append(el('button', {
        type: 'button',
        class: 'btn btn-secondary',
        onclick: () => { store.clear(); loadList({ moveFocus: true }); },
      }, 'Clear saved list'));
    }
    return el('div', { class: 'state state-error' },
      el('div', { class: 'state-icon', 'aria-hidden': 'true' }, '!'),
      el('h3', { class: 'state-title', tabindex: '-1' }, info.title),
      el('p', { class: 'state-body' }, info.body),
      actions);
  }

  function emptyView() {
    const icon = el('div', { class: 'state-icon' });
    icon.innerHTML = BOOK_ICON; // static markup, no user data
    return el('div', { class: 'state state-empty' },
      icon,
      el('h3', { class: 'state-title', tabindex: '-1' }, 'Your reading list is empty'),
      el('p', { class: 'state-body' },
        'Save books you want to read so you don’t lose track of them: a friend’s recommendation, a title from a talk, the next book in a series. ' +
        'Your list stays in this browser, so it’s here when you come back.'),
      el('div', { class: 'state-actions' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => titleInput.focus() }, 'Add your first book')));
  }

  function bookItem(book) {
    const meta = [
      book.author ? `by ${book.author}` : null,
      book.addedAt ? `Added ${dateFormat.format(new Date(book.addedAt))}` : null,
    ].filter(Boolean).join(' · ');

    return el('li', { class: 'book' },
      el('div', { class: 'book-text' },
        el('p', { class: 'book-title' }, book.title),
        meta ? el('p', { class: 'book-meta' }, meta) : ''),
      el('button', {
        type: 'button',
        class: 'btn btn-remove',
        'data-id': book.id,
        onclick: (event) => removeBook(book.id, event.currentTarget),
      }, 'Remove', el('span', { class: 'visually-hidden' }, ` “${book.title}”`)));
  }

  function listView() {
    return el('ul', { class: 'books' }, ...state.books.map(bookItem));
  }

  function render() {
    const { status, books } = state;
    listSection.setAttribute('aria-busy', String(status === 'loading'));
    fieldset.disabled = status !== 'ready';
    countEl.textContent = status === 'ready' && books.length ? bookCount(books.length) : '';

    let node;
    if (status === 'loading') node = loadingView();
    else if (status === 'error') node = errorView();
    else if (books.length === 0) node = emptyView();
    else node = listView();
    view.replaceChildren(node);
  }

  /* ---------- Actions ---------- */

  async function loadList({ moveFocus = false } = {}) {
    state.status = 'loading';
    state.error = null;
    listError.textContent = '';
    render();
    announce('Loading your reading list…');
    if (moveFocus) listHeading.focus(); // the Try again button has just gone

    try {
      state.books = await store.load();
      state.status = 'ready';
    } catch (err) {
      state.status = 'error';
      state.error = err instanceof StoreError ? err : new StoreError('network');
    }

    render();
    if (state.status === 'error') {
      const info = LOAD_ERRORS[state.error.kind] || LOAD_ERRORS.network;
      announce(`Error: ${info.title}.`);
    } else {
      announce(state.books.length ? `Reading list loaded: ${bookCount(state.books.length)}.` : 'Your reading list is empty.');
    }
    if (moveFocus) focusStateHeading();
  }

  function showTitleError(message) {
    titleError.textContent = message;
    titleError.hidden = false;
    titleInput.setAttribute('aria-invalid', 'true');
  }

  function clearTitleError() {
    titleError.textContent = '';
    titleError.hidden = true;
    titleInput.removeAttribute('aria-invalid');
  }

  titleInput.addEventListener('input', () => {
    if (titleInput.hasAttribute('aria-invalid') && titleInput.value.trim()) clearTitleError();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || state.status !== 'ready') return;

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    formError.textContent = '';
    listError.textContent = '';

    if (!title) {
      showTitleError('Enter a title to add a book.');
      titleInput.focus();
      return;
    }
    clearTitleError();

    const book = { id: makeId(), title, author, addedAt: new Date().toISOString() };
    const next = [book, ...state.books];

    busy = true;
    addButton.setAttribute('aria-disabled', 'true');
    addButton.textContent = 'Adding…';

    try {
      await store.save(next);
      state.books = next;
      form.reset();
      render();
      announce(`Added “${title}” to your reading list.`);
      titleInput.focus();
    } catch (err) {
      formError.textContent = saveErrorMessage(err, 'add', title);
    } finally {
      busy = false;
      addButton.removeAttribute('aria-disabled');
      addButton.textContent = 'Add to list';
    }
  });

  async function removeBook(id, button) {
    if (busy) return;
    const index = state.books.findIndex((b) => b.id === id);
    if (index === -1) return;
    const book = state.books[index];
    const next = state.books.filter((b) => b.id !== id);

    formError.textContent = '';
    listError.textContent = '';
    busy = true;
    button.setAttribute('aria-disabled', 'true');
    button.firstChild.nodeValue = 'Removing…';

    try {
      await store.save(next);
      state.books = next;
      render();
      announce(`Removed “${book.title}”.`);
      // Keep focus nearby: the next book, else the previous one, else the empty state.
      const target = state.books[index] || state.books[index - 1];
      if (target) view.querySelector(`button[data-id="${target.id}"]`).focus();
      else focusStateHeading();
    } catch (err) {
      listError.textContent = saveErrorMessage(err, 'remove', book.title);
      button.removeAttribute('aria-disabled');
      button.firstChild.nodeValue = 'Remove';
    } finally {
      busy = false;
    }
  }

  /* ---------- Demo setup ---------- */

  function applyDemoSettings() {
    const notes = [];

    if (demo.reset) {
      store.clear();
      notes.push('your saved list was cleared');
    }

    if (demo.seed) {
      try {
        const ls = window.localStorage;
        const existing = ls.getItem(STORAGE_KEY);
        if (!existing || existing === '[]') {
          const now = Date.now();
          ls.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_BOOKS.map((b, i) => ({
            id: makeId(),
            title: b.title,
            author: b.author,
            addedAt: new Date(now - i * 86400000).toISOString(),
          }))));
          notes.push('three sample books were added');
        }
      } catch { /* storage blocked: the load reports it */ }
    }

    if (params.has('delay')) notes.push(`loading takes ${demo.delay / 1000} s`);
    if (demo.failLoad) notes.push('the first load fails (simulated)');
    if (demo.failSave) notes.push('adding and removing fail (simulated)');

    // One-off settings are removed from the address so a reload doesn't repeat them.
    if (demo.reset || demo.seed) {
      params.delete('reset');
      params.delete('seed');
      const query = params.toString();
      try {
        history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
      } catch { /* some file:// setups disallow this; harmless */ }
    }

    if (notes.length) {
      const text = notes.join('; ');
      bannerText.textContent = `Demo mode: ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
      banner.hidden = false;
    }
  }

  /* ---------- Start ---------- */

  applyDemoSettings();
  loadList();
})();