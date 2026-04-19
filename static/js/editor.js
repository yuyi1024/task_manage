/* ============================================================
   TaskFlow — TipTap Editor Module (Notion-like)
   Vanilla JS, no React. Loaded via dynamic ESM import.
   ============================================================ */
'use strict';

let _ttPromise = null;

function _loadTipTap() {
  if (_ttPromise) return _ttPromise;
  _ttPromise = Promise.all([
    import('https://esm.sh/@tiptap/core@2.11'),
    import('https://esm.sh/@tiptap/starter-kit@2.11'),
    import('https://esm.sh/@tiptap/extension-image@2.11'),
    import('https://esm.sh/@tiptap/extension-placeholder@2.11'),
    import('https://esm.sh/@tiptap/extension-text-style@2.11'),
    import('https://esm.sh/@tiptap/extension-color@2.11'),
    import('https://esm.sh/@tiptap/extension-underline@2.11'),
    import('https://esm.sh/@tiptap/extension-link@2.11'),
    import('https://esm.sh/@tiptap/extension-bubble-menu@2.11'),
    import('https://esm.sh/@tiptap/extension-task-list@2.11'),
    import('https://esm.sh/@tiptap/extension-task-item@2.11'),
    import('https://esm.sh/@tiptap/suggestion@2.11'),
    import('https://esm.sh/@tiptap/extension-table@2.11'),
    import('https://esm.sh/@tiptap/extension-table-row@2.11'),
    import('https://esm.sh/@tiptap/extension-table-header@2.11'),
    import('https://esm.sh/@tiptap/extension-table-cell@2.11'),
  ]).then(([
    { Editor, Extension },
    { default: StarterKit },
    { default: Image },
    { default: Placeholder },
    { default: TextStyle },
    { default: Color },
    { default: Underline },
    { default: Link },
    { default: BubbleMenu },
    { default: TaskList },
    { default: TaskItem },
    suggMod,
    { default: Table },
    { default: TableRow },
    { default: TableHeader },
    { default: TableCell },
  ]) => {
    const Suggestion = suggMod.Suggestion ?? suggMod.default;
    return {
      Editor, Extension, StarterKit, Image, Placeholder,
      TextStyle, Color, Underline, Link,
      BubbleMenu, TaskList, TaskItem, Suggestion,
      Table, TableRow, TableHeader, TableCell,
    };
  });
  return _ttPromise;
}

const _instances = new Map();

// ── Public: initEditor ────────────────────────────────────────────────────────
async function initEditor({
  containerId,
  content     = '',
  uploadUrl   = '',
  saveUrl     = '',
  saveField   = 'description',
  saveDelay   = 500,
  onStatus    = null,
  showToolbar = false,
}) {
  destroyEditor(containerId);

  const container = document.getElementById(containerId);
  if (!container) return null;
  container.innerHTML = '<div class="tt-loading">載入編輯器...</div>';

  let ext;
  try {
    ext = await _loadTipTap();
  } catch {
    container.innerHTML = '<div class="tt-error">編輯器載入失敗，請重新整理頁面。</div>';
    return null;
  }

  if (!container.isConnected) return null;
  container.innerHTML = '';

  // DOM structure
  const toolbar    = showToolbar ? _buildToolbar() : null;
  const editorWrap = document.createElement('div');
  editorWrap.className = showToolbar ? 'tt-editor-wrap' : 'tt-editor-wrap tt-no-toolbar';
  if (toolbar) container.appendChild(toolbar);
  container.appendChild(editorWrap);

  // Notion-like overlays (body-level; Tippy manages positioning)
  const bubbleEl = _buildBubbleEl();
  document.body.appendChild(bubbleEl);

  // Table action bar (inline, hidden until cursor enters a table)
  const tableBar = _buildTableBar();
  container.insertBefore(tableBar, editorWrap);

  const SlashCommand = _buildSlashExtension(ext, uploadUrl);

  const editor = new ext.Editor({
    element: editorWrap,
    extensions: [
      ext.StarterKit.configure({
        heading:   { levels: [1, 2, 3] },
        code:      false,
        codeBlock: false,
      }),
      ext.Image.configure({ inline: false, allowBase64: false }),
      ext.Placeholder.configure({ placeholder: '輸入「/」選擇區塊，或直接撰寫...' }),
      ext.TextStyle,
      ext.Color,
      ext.Underline,
      ext.Link.configure({ openOnClick: false, autolink: true }),
      ext.TaskList,
      ext.TaskItem.configure({ nested: false }),
      ext.Table.configure({ resizable: false }),
      ext.TableRow,
      ext.TableHeader,
      ext.TableCell,
      ext.BubbleMenu.configure({
        element: bubbleEl,
        tippyOptions: { duration: 100, placement: 'top' },
      }),
      SlashCommand,
    ],
    content,
    editorProps: {
      attributes: { class: 'tt-content', spellcheck: 'false' },
    },
    onTransaction({ editor: ed }) {
      if (toolbar) _syncToolbar(toolbar, ed);
      _syncBubble(bubbleEl, ed);
      _syncTableBar(tableBar, ed);
    },
  });

  if (toolbar) _bindToolbar(toolbar, editor, uploadUrl);
  _bindBubble(bubbleEl, editor);
  _bindTableBar(tableBar, editor);

  // Image paste
  editorWrap.addEventListener('paste', async (e) => {
    const imgItem = [...(e.clipboardData?.items || [])]
      .find(it => it.kind === 'file' && it.type.startsWith('image/'));
    if (!imgItem || !uploadUrl) return;
    e.preventDefault();
    e.stopPropagation();
    await _uploadAndInsert(imgItem.getAsFile(), editor, uploadUrl);
  }, true);

  // Auto-save
  let saveTimer = null;
  function autoSave() {
    if (!saveUrl) return;
    clearTimeout(saveTimer);
    onStatus?.('saving');
    saveTimer = setTimeout(async () => {
      try {
        const r = await fetch(saveUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': typeof getCsrfToken === 'function' ? getCsrfToken() : '',
          },
          body: `${saveField}=${encodeURIComponent(editor.getHTML())}`,
        });
        onStatus?.(r.ok ? 'saved' : 'error');
      } catch {
        onStatus?.('error');
      }
    }, saveDelay);
  }
  editor.on('update', autoSave);

  const instance = {
    editor,
    getHTML: () => editor.getHTML(),
    destroy() {
      clearTimeout(saveTimer);
      editor.off('update', autoSave);
      editor.destroy();
      bubbleEl.remove();
      document.getElementById('tt-slash-popup')?.remove();
      container.innerHTML = '';
      _instances.delete(containerId);
    },
  };
  _instances.set(containerId, instance);
  return instance;
}

function destroyEditor(containerId) {
  _instances.get(containerId)?.destroy();
}

function preloadEditor() {
  _loadTipTap();
}

// ── Bubble Menu ───────────────────────────────────────────────────────────────

function _buildBubbleEl() {
  const el = document.createElement('div');
  el.className = 'tt-bubble-menu';
  el.innerHTML = `
    <button data-cmd="bold"       class="tt-bb-btn" title="粗體">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
    </button>
    <button data-cmd="italic"     class="tt-bb-btn" title="斜體">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
    </button>
    <button data-cmd="underline"  class="tt-bb-btn" title="底線">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
    </button>
    <button data-cmd="strike"     class="tt-bb-btn" title="刪除線">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12" stroke-width="2.5"/><path d="M16 6c-.5-1.5-2-2-4-2-2.5 0-4 1-4 3 0 1 .3 1.8 1 2.4"/><path d="M8 18c.5 1.5 2.2 2.5 4 2.5 2.5 0 4.5-1 4.5-3.5 0-.9-.3-1.7-1-2.4"/></svg>
    </button>
    <div class="tt-sep"></div>
    <label class="tt-bb-color" title="文字顏色">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
      <input data-cmd="color" type="color" class="tt-color-input" value="#000000" />
    </label>
    <button data-cmd="link"       class="tt-bb-btn" title="連結">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>
    <div class="tt-sep"></div>
    <button data-cmd="clearMarks" class="tt-bb-btn" title="清除格式">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L8 10h8l-4-8z"/><line x1="5" y1="20" x2="19" y2="20"/><line x1="17" y1="10" x2="9" y2="20"/></svg>
    </button>`;
  return el;
}

function _bindBubble(el, editor) {
  el.addEventListener('mousedown', e => {
    const btn = e.target.closest('.tt-bb-btn[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    switch (btn.dataset.cmd) {
      case 'bold':       editor.chain().focus().toggleBold().run();      break;
      case 'italic':     editor.chain().focus().toggleItalic().run();    break;
      case 'underline':  editor.chain().focus().toggleUnderline().run(); break;
      case 'strike':     editor.chain().focus().toggleStrike().run();    break;
      case 'clearMarks': editor.chain().focus().unsetAllMarks().run();   break;
      case 'link': {
        if (editor.isActive('link')) {
          editor.chain().focus().unsetLink().run();
        } else {
          const url = prompt('輸入連結 URL：');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }
        break;
      }
    }
  });
  el.querySelector('[data-cmd="color"]')?.addEventListener('input', e => {
    editor.chain().focus().setColor(e.target.value).run();
  });
}

function _syncBubble(el, editor) {
  [['bold','bold'],['italic','italic'],['underline','underline'],
   ['strike','strike'],['link','link']].forEach(([cmd, mark]) => {
    el.querySelector(`[data-cmd="${cmd}"]`)
      ?.classList.toggle('tt-active', editor.isActive(mark));
  });
}

// ── Slash Command ─────────────────────────────────────────────────────────────

function _getSlashItems(uploadUrl) {
  const items = [
    { title: '正文',    subtitle: '普通段落',    icon: '¶',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
    { title: '標題 1',  subtitle: '最大標題',    icon: 'H1',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run() },
    { title: '標題 2',  subtitle: '中等標題',    icon: 'H2',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run() },
    { title: '標題 3',  subtitle: '小標題',      icon: 'H3',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run() },
    { title: '無序清單', subtitle: '項目符號',   icon: '•',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: '有序清單', subtitle: '數字排序',   icon: '1.',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: '待辦事項', subtitle: 'Checkbox',  icon: '☑',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: '引用',    subtitle: '引用區塊',    icon: '"',
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  ];
  items.push({
    title: '表格', subtitle: '插入 3×3 表格', icon: '⊞',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  });
  if (uploadUrl) {
    items.push({
      title: '插入圖片', subtitle: '上傳圖片', icon: '🖼',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        _pickImage(editor, uploadUrl);
      },
    });
  }
  return items;
}

function _buildSlashExtension(ext, uploadUrl) {
  const { Extension, Suggestion } = ext;
  const allItems = _getSlashItems(uploadUrl);

  let popup = null;
  let selectedIndex = 0;
  let currentItems = [];
  let currentProps = null;

  function _ensurePopup() {
    if (popup && document.body.contains(popup)) return popup;
    popup = document.createElement('div');
    popup.id = 'tt-slash-popup';
    popup.className = 'tt-slash-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);
    return popup;
  }

  function _renderList(items) {
    const p = _ensurePopup();
    if (!items.length) { p.style.display = 'none'; return; }
    p.innerHTML = items.map((item, i) => `
      <div class="tt-slash-item${i === selectedIndex ? ' tt-slash-active' : ''}" data-idx="${i}">
        <span class="tt-slash-icon">${item.icon}</span>
        <div>
          <div class="tt-slash-title">${item.title}</div>
          <div class="tt-slash-sub">${item.subtitle}</div>
        </div>
      </div>`).join('');
    p.querySelectorAll('.tt-slash-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        _select(parseInt(el.dataset.idx, 10));
      });
    });
    p.querySelector('.tt-slash-active')?.scrollIntoView({ block: 'nearest' });
  }

  function _position(clientRect) {
    const p = _ensurePopup();
    const rect = typeof clientRect === 'function' ? clientRect() : clientRect;
    if (!rect) return;
    const vh  = window.innerHeight;
    const popH = Math.min(p.scrollHeight || 280, 280);
    const top  = rect.bottom + 4 + popH > vh
      ? Math.max(8, rect.top - popH - 4)
      : rect.bottom + 4;
    p.style.cssText = `display:block;position:fixed;left:${Math.max(8, rect.left)}px;top:${top}px;z-index:9999`;
  }

  function _select(idx) {
    const item = currentItems[idx];
    if (item && currentProps) item.command({ editor: currentProps.editor, range: currentProps.range });
    _hide();
  }

  function _hide() {
    if (popup) popup.style.display = 'none';
    currentItems = [];
    currentProps = null;
    selectedIndex = 0;
  }

  return Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            return allItems.filter(c =>
              c.title.toLowerCase().includes(q) ||
              c.subtitle.toLowerCase().includes(q));
          },
          render: () => ({
            onStart(props) {
              currentProps = props; currentItems = props.items; selectedIndex = 0;
              _renderList(currentItems); _position(props.clientRect);
            },
            onUpdate(props) {
              currentProps = props; currentItems = props.items; selectedIndex = 0;
              _renderList(currentItems); _position(props.clientRect);
            },
            onKeyDown({ event }) {
              if (!currentItems.length) return false;
              if (event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % currentItems.length;
                _renderList(currentItems); return true;
              }
              if (event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                _renderList(currentItems); return true;
              }
              if (event.key === 'Enter') { _select(selectedIndex); return true; }
              if (event.key === 'Escape') { _hide(); return true; }
              return false;
            },
            onExit() { _hide(); },
          }),
        }),
      ];
    },
  });
}

// ── Toolbar (unchanged from previous version) ─────────────────────────────────

function _buildToolbar() {
  const bar = document.createElement('div');
  bar.className = 'tt-toolbar';
  bar.innerHTML = `
    <div class="tt-group">
      <button data-cmd="bold"        class="tt-btn" title="粗體 (Ctrl+B)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
      </button>
      <button data-cmd="italic"      class="tt-btn" title="斜體 (Ctrl+I)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
      </button>
      <button data-cmd="underline"   class="tt-btn" title="底線 (Ctrl+U)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
      </button>
    </div>
    <div class="tt-sep"></div>
    <div class="tt-group">
      <select data-cmd="heading" class="tt-select" title="段落樣式">
        <option value="0">正文</option>
        <option value="1">標題 1</option>
        <option value="2">標題 2</option>
        <option value="3">標題 3</option>
      </select>
    </div>
    <div class="tt-sep"></div>
    <div class="tt-group">
      <button data-cmd="bulletList"  class="tt-btn" title="無序清單">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
      </button>
      <button data-cmd="orderedList" class="tt-btn" title="有序清單">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10H6"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
      </button>
      <button data-cmd="taskList"    class="tt-btn" title="待辦清單">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="16" height="16" rx="2"/><polyline points="7 11 10 14 17 7"/></svg>
      </button>
      <button data-cmd="blockquote"  class="tt-btn" title="引用">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
      </button>
    </div>
    <div class="tt-sep"></div>
    <div class="tt-group">
      <label class="tt-color-wrap" title="文字顏色">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
        <input data-cmd="color" type="color" class="tt-color-input" value="#000000" />
      </label>
      <button data-cmd="image" class="tt-btn" title="插入圖片">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      </button>
      <button data-cmd="table" class="tt-btn" title="插入表格">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      </button>
    </div>`;
  return bar;
}

function _bindToolbar(toolbar, editor, uploadUrl) {
  toolbar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.tt-btn[data-cmd]');
    if (!btn) return;
    e.preventDefault();
    switch (btn.dataset.cmd) {
      case 'bold':        editor.chain().focus().toggleBold().run();        break;
      case 'italic':      editor.chain().focus().toggleItalic().run();      break;
      case 'underline':   editor.chain().focus().toggleUnderline().run();   break;
      case 'bulletList':  editor.chain().focus().toggleBulletList().run();  break;
      case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
      case 'taskList':    editor.chain().focus().toggleTaskList().run();    break;
      case 'blockquote':  editor.chain().focus().toggleBlockquote().run();  break;
      case 'image':       _pickImage(editor, uploadUrl);                    break;
      case 'table':       editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
    }
  });
  toolbar.querySelector('[data-cmd="heading"]')?.addEventListener('change', (e) => {
    const level = parseInt(e.target.value, 10);
    if (level === 0) editor.chain().focus().setParagraph().run();
    else             editor.chain().focus().setHeading({ level }).run();
  });
  toolbar.querySelector('[data-cmd="color"]')?.addEventListener('input', (e) => {
    editor.chain().focus().setColor(e.target.value).run();
  });
}

function _syncToolbar(toolbar, editor) {
  [
    ['bold','bold'], ['italic','italic'], ['underline','underline'],
    ['bulletList','bulletList'], ['orderedList','orderedList'],
    ['taskList','taskList'], ['blockquote','blockquote'],
  ].forEach(([cmd, mark]) => {
    toolbar.querySelector(`[data-cmd="${cmd}"]`)
      ?.classList.toggle('tt-active', editor.isActive(mark));
  });
  const sel = toolbar.querySelector('[data-cmd="heading"]');
  if (sel) {
    let v = '0';
    for (let i = 1; i <= 3; i++) {
      if (editor.isActive('heading', { level: i })) { v = String(i); break; }
    }
    if (sel.value !== v) sel.value = v;
  }
}

// ── Table Action Bar ──────────────────────────────────────────────────────────

function _buildTableBar() {
  const el = document.createElement('div');
  el.className = 'tt-table-bar';
  el.style.display = 'none';
  el.innerHTML = `
    <span class="tt-table-label">表格</span>
    <button data-act="addRowAfter"    class="tt-tb-btn" title="在下方新增列">＋ 列</button>
    <button data-act="deleteRow"      class="tt-tb-btn tt-tb-del" title="刪除目前列">刪列</button>
    <div class="tt-sep"></div>
    <button data-act="addColumnAfter" class="tt-tb-btn" title="在右方新增欄">＋ 欄</button>
    <button data-act="deleteColumn"   class="tt-tb-btn tt-tb-del" title="刪除目前欄">刪欄</button>
    <div class="tt-sep"></div>
    <button data-act="deleteTable"    class="tt-tb-btn tt-tb-del" title="刪除整個表格">刪除表格</button>`;
  return el;
}

function _bindTableBar(el, editor) {
  el.addEventListener('mousedown', e => {
    const btn = e.target.closest('.tt-tb-btn[data-act]');
    if (!btn) return;
    e.preventDefault();
    switch (btn.dataset.act) {
      case 'addRowAfter':    editor.chain().focus().addRowAfter().run();    break;
      case 'deleteRow':      editor.chain().focus().deleteRow().run();      break;
      case 'addColumnAfter': editor.chain().focus().addColumnAfter().run(); break;
      case 'deleteColumn':   editor.chain().focus().deleteColumn().run();   break;
      case 'deleteTable':    editor.chain().focus().deleteTable().run();    break;
    }
  });
}

function _syncTableBar(el, editor) {
  el.style.display = editor.isActive('table') ? '' : 'none';
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function _pickImage(editor, uploadUrl) {
  if (!uploadUrl) return;
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
  input.click();
  input.onchange = () => input.files[0] && _uploadAndInsert(input.files[0], editor, uploadUrl);
}

async function _uploadAndInsert(file, editor, uploadUrl) {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('csrfmiddlewaretoken', typeof getCsrfToken === 'function' ? getCsrfToken() : '');
  try {
    const r    = await fetch(uploadUrl, { method: 'POST', body: fd });
    const data = await r.json();
    if (data.url) editor.chain().focus().setImage({ src: data.url }).run();
  } catch {
    typeof showToast === 'function' && showToast('圖片上傳失敗', 'error');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
window.initEditor    = initEditor;
window.destroyEditor = destroyEditor;
window.preloadEditor = preloadEditor;
