/* ====================================================
   TaskFlow — Main JS
   ==================================================== */
'use strict';

// ── CSRF ──────────────────────────────────────────────
function getCsrfToken() {
  return document.cookie.split(';')
    .find(c => c.trim().startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

// ── Toast ──────────────────────────────────────────────
function showToast(message, type = 'success', duration = 2200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      ${type === 'success'
        ? '<polyline points="20 6 9 17 4 12"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
    </svg>
    <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.cssText = 'opacity:0;transform:translateX(16px);transition:all .25s';
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

// ── Panel Save Status ──────────────────────────────────
function setPanelSaveStatus(status) {
  const bar = document.getElementById('panel-save-status');
  if (!bar) return;
  const map = {
    saving: { text: '儲存中...', color: '#aaa' },
    saved:  { text: '✓ 已儲存',  color: '#22c55e' },
    error:  { text: '⚠ 儲存失敗', color: '#ef4444' },
    '':     { text: '', color: '' },
  };
  const s = map[status] || map[''];
  bar.textContent = s.text;
  bar.style.color = s.color;
  if (status === 'saved') {
    setTimeout(() => { if (bar.textContent === '✓ 已儲存') bar.textContent = ''; }, 2500);
  }
}

// ── HTMX events ───────────────────────────────────────
document.addEventListener('htmx:afterRequest', (e) => {
  const trigger = e.detail.xhr?.getResponseHeader?.('HX-Trigger');
  if (trigger === 'taskSaved') {
    showToast('已自動儲存', 'success', 1600);
    setPanelSaveStatus('saved');

    // Check if group-by field was changed → move row to new group
    const groupBy = window.TASK_GROUP_BY;
    if (groupBy) {
      const elt = e.detail.elt;
      if (elt?.name === groupBy) {
        const row = elt.closest('.task-row');
        if (row) moveTaskToGroup(row, String(elt.value || 'none'));
      }
    }
  }
  if (trigger === 'taskDeleted') {
    showToast('任務已刪除', 'success');
    if (_pendingDeleteGroup) {
      _updateGroupCount(_pendingDeleteGroup);
      _pendingDeleteGroup = null;
    }
  }
  if (trigger === 'projectDeleted') showToast('專案已刪除', 'success');
});

document.addEventListener('htmx:beforeRequest', (e) => {
  if (e.detail.requestConfig?.verb === 'post') setPanelSaveStatus('saving');
});

// Capture the task-group BEFORE the row is removed from DOM (htmx:beforeSwap fires before swap).
let _pendingDeleteGroup = null;
document.addEventListener('htmx:beforeSwap', (e) => {
  if (e.detail.xhr?.getResponseHeader?.('HX-Trigger') === 'taskDeleted') {
    _pendingDeleteGroup = e.detail.target?.closest?.('.task-group') ?? null;
  }
});

document.addEventListener('htmx:responseError', () => {
  showToast('操作失敗，請重試', 'error');
  setPanelSaveStatus('error');
});

// ── Group Move ─────────────────────────────────────────
function moveTaskToGroup(row, newKey) {
  const oldGroup = row.closest('.task-group');
  if (!oldGroup || oldGroup.id === 'group-' + newKey) return;

  let targetGroup = document.getElementById('group-' + newKey);
  if (!targetGroup) {
    targetGroup = _createGroupElement(newKey);
    if (!targetGroup) return;
    document.getElementById('task-groups')?.appendChild(targetGroup);
  }

  const targetBody = document.getElementById('group-body-' + newKey);
  if (!targetBody) return;

  // Animate out
  row.style.cssText = 'transition:opacity .2s,transform .2s;opacity:0;transform:translateX(10px)';

  setTimeout(() => {
    targetBody.querySelector('.empty-group')?.remove();
    row.removeAttribute('style');
    targetBody.appendChild(row);

    // Animate in
    row.style.cssText = 'opacity:0;transform:translateX(-10px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      row.style.cssText = 'transition:opacity .22s,transform .22s;opacity:1;transform:none';
      setTimeout(() => row.removeAttribute('style'), 250);
    }));

    // Old group: show empty state if needed
    const oldBody = document.getElementById('group-body-' + oldGroup.id.replace('group-', ''));
    if (oldBody && !oldBody.querySelector('.task-row')) {
      oldBody.insertAdjacentHTML('beforeend', '<div class="empty-group"><span>此群組暫無任務</span></div>');
    }

    _updateGroupCount(oldGroup);
    _updateGroupCount(targetGroup);
  }, 220);
}

function _updateGroupCount(groupEl) {
  if (!groupEl) return;
  const count     = groupEl.querySelectorAll('.task-row').length;
  const badge     = groupEl.querySelector('.group-count');
  const body      = groupEl.querySelector('.group-body');
  const toggleBtn = groupEl.querySelector('.group-toggle');

  if (badge) badge.textContent = count;

  const wasEmpty = groupEl.dataset.wasEmpty === '1';
  const isEmpty  = count === 0;

  if (isEmpty && !wasEmpty) {
    // Just became empty → collapse
    if (body)      body.style.display = 'none';
    if (toggleBtn) toggleBtn.classList.add('collapsed');
    groupEl.dataset.wasEmpty = '1';
  } else if (!isEmpty && wasEmpty) {
    // Just received a task → expand
    if (body)      body.style.display = '';
    if (toggleBtn) toggleBtn.classList.remove('collapsed');
    groupEl.dataset.wasEmpty = '0';
  }
}

function _createGroupElement(key) {
  const label = (window.TASK_GROUP_LABELS || {})[key] || key;
  const groupBy = window.TASK_GROUP_BY || '';
  const currentSort = window.TASK_CURRENT_SORT || 'order';
  const sortOpts = (window.TASK_SORT_OPTIONS || [])
    .map(o => `<option value="${o.value}"${o.value === currentSort ? ' selected' : ''}>${o.label}</option>`)
    .join('');

  const tableHeader = `<div class="task-table-header">
    <div class="col-task">任務</div><div class="col-project">專案</div>
    <div class="col-module">模組</div><div class="col-status">狀態</div>
    <div class="col-priority">優先度</div><div class="col-assign">Assign</div>
    <div class="col-support">Support</div><div class="col-pm">PM</div>
    <div class="col-date">日期</div><div class="col-hours">工時</div>
    <div class="col-actions"></div></div>`;

  const el = document.createElement('div');
  el.className = 'task-group';
  el.id = 'group-' + key;
  if (groupBy === 'status')   el.dataset.status   = key;
  if (groupBy === 'priority') el.dataset.priority = key;

  el.innerHTML = `
    <div class="group-header">
      <div class="group-header-left">
        <button class="group-toggle" onclick="toggleGroup('${key}')">
          <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <span class="group-label">${label}</span>
        <span class="group-count">0</span>
      </div>
      <div class="group-header-right">
        <select class="sort-select" onchange="applyGroupSort('${key}',this.value)">${sortOpts}</select>
        <button class="btn-add-task-group" onclick="openNewTaskModal('${key}','${groupBy}')" title="新增任務到此群組">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
    <div class="group-body" id="group-body-${key}">${tableHeader}</div>`;

  el.style.cssText = 'opacity:0;transform:translateY(8px)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.cssText = 'transition:opacity .25s,transform .25s;opacity:1;transform:none';
    setTimeout(() => el.removeAttribute('style'), 300);
  }));
  return el;
}


// ── Detail Slide-over Panel ────────────────────────────
function openDetailPanel(taskId) {
  const panel   = document.getElementById('detail-panel');
  const overlay = document.getElementById('detail-overlay');
  const content = document.getElementById('detail-panel-content');

  overlay.style.display = 'block';
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:220px;color:#aaa;gap:8px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           style="animation:spin .8s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      載入中...
    </div>`;

  fetch(`/tasks/${taskId}/detail/`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(html => {
      content.innerHTML = html;
      htmx.process(content);

      const editorEl = content.querySelector(`#tiptap-editor-${taskId}`);
      const savedContent = editorEl?.dataset.content || '';
      initEditor({
        containerId: `tiptap-editor-${taskId}`,
        content: savedContent,
        saveUrl: `/tasks/${taskId}/update-description/`,
        saveField: 'description',
        uploadUrl: `/tasks/image-upload/`,
        onStatus: setPanelSaveStatus,
      });
    })
    .catch(() => showToast('載入詳情失敗', 'error'));
}

function _closeDetailPanel() {
  // Destroy TipTap instance so it doesn't leak or auto-save after close
  const content = document.getElementById('detail-panel-content');
  const editorEl = content?.querySelector('[id^="tiptap-editor-"]');
  if (editorEl) destroyEditor(editorEl.id);

  document.getElementById('detail-panel')?.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    const overlay = document.getElementById('detail-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 260);
}

function closeDetailPanel(event) {
  // Called from overlay click — only close if clicking the overlay itself
  if (event && event.target !== document.getElementById('detail-overlay')) return;
  _closeDetailPanel();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') _closeDetailPanel();
});

// ── Filters ────────────────────────────────────────────
function applyFilter(key, value) {
  const url = new URL(window.location);
  value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
  url.searchParams.delete('page');
  window.location = url;
}

function clearFilters() {
  const url = new URL(window.location);
  ['project', 'module', 'status', 'priority', 'assign', 'pm'].forEach(k => url.searchParams.delete(k));
  window.location = url;
}

function applyGroupSort(_, sortVal) {
  applyFilter('sort_by', sortVal);
}

// ── Group Toggle ───────────────────────────────────────
function toggleGroup(groupKey) {
  const body = document.getElementById('group-body-' + groupKey);
  const btn  = document.querySelector(`#group-${groupKey} .group-toggle`);
  if (!body) return;
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  btn?.classList.toggle('collapsed', !collapsed);
}

// ── New Task Modal ─────────────────────────────────────
function openNewTaskModal(groupVal, groupField) {
  const modal = document.getElementById('new-task-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  if (groupVal && groupField) {
    document.getElementById('new-task-group-val').value = groupVal;
    document.getElementById('new-task-group-field').value = groupField;
    const fieldMap = { status: 'new-task-status', priority: 'new-task-priority' };
    const el = document.getElementById(fieldMap[groupField]);
    if (el) el.value = groupVal;
  }

  setTimeout(() => modal.querySelector('textarea')?.focus(), 80);
}

function _closeNewTaskModal() {
  const modal = document.getElementById('new-task-modal');
  if (modal) modal.style.display = 'none';
}

function closeNewTaskModal(event) {
  if (event && event.target !== document.getElementById('new-task-modal')) return;
  _closeNewTaskModal();
}

function onTaskCreated(event) {
  // Guard: only handle the form's own POST submission.
  // The project <select> fires hx-get (verb='get') which also bubbles here —
  // without this check that GET's 200 response would close the modal.
  if (event.detail.requestConfig?.verb !== 'post') return;
  if ([200, 201].includes(event.detail.xhr.status)) {
    _closeNewTaskModal();
    showToast('任務已建立', 'success');
    setTimeout(() => window.location.reload(), 500);
  }
}

// ── Dynamic Module Loading ─────────────────────────────
function handleProjectChange(selectEl, taskId) {
  const pid = selectEl.value;
  const mod = document.getElementById('module-select-' + taskId);
  if (!mod) return;
  mod.innerHTML = '<option value="">—</option>';
  if (!pid) return;
  fetch(`/tasks/module-options/?project_id=${pid}`)
    .then(r => r.text())
    .then(html => { mod.innerHTML = html; });
}

function loadPanelModules(projectSelect, taskId) {
  const pid = projectSelect.value;
  const mod = document.getElementById('panel-module-' + taskId);
  if (!mod) return;
  mod.innerHTML = '<option value="">—</option>';
  if (!pid) return;
  fetch(`/tasks/module-options/?project_id=${pid}`)
    .then(r => r.text())
    .then(html => { mod.innerHTML = html; });
}

// ── Preload TipTap on first task hover ────────────────
document.addEventListener('mouseover', () => {
  if (typeof preloadEditor === 'function') preloadEditor();
}, { once: true });

// ── Spin animation ─────────────────────────────────────
document.head.insertAdjacentHTML('beforeend',
  '<style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>');

// ── Detail Panel Resize ────────────────────────────────
// Panel now uses transform:translateX(100%) for open/close,
// so width changes NEVER affect the hidden/shown state.
;(function initPanelResize() {
  const STORAGE_KEY = 'tf-panel-width';
  const MIN_W = 340;
  const MAX_RATIO = 0.9;

  const panel  = document.getElementById('detail-panel');
  const handle = panel?.querySelector('.panel-resize-handle');
  if (!panel || !handle) return;

  // Restore saved width
  const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (saved >= MIN_W) panel.style.width = saved + 'px';

  // ResizeObserver: apply responsive layout classes
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        entry.target.classList.toggle('panel-wide',   w >= 720);
        entry.target.classList.toggle('panel-narrow', w <  440);
      }
    }).observe(panel);
  }

  let dragging = false, startX = 0, startW = 0;

  handle.addEventListener('mousedown', e => {
    if (!panel.classList.contains('open')) return;
    dragging = true;
    startX   = e.clientX;
    startW   = panel.offsetWidth;
    panel.classList.add('resizing');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const maxW = Math.floor(window.innerWidth * MAX_RATIO);
    // Handle sits on left edge; dragging left (↓ clientX) = wider
    const newW = Math.max(MIN_W, Math.min(maxW, startW + (startX - e.clientX)));
    panel.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('resizing');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
    localStorage.setItem(STORAGE_KEY, panel.offsetWidth);
  });
})();

// ── Task Clone ─────────────────────────────────────────
function cloneTask(taskId, btn) {
  const row    = btn.closest('.task-row');
  const groupBy = document.getElementById('task-groups')?.dataset.groupBy || 'status';

  btn.disabled = true;
  btn.style.opacity = '.4';

  fetch(`/tasks/${taskId}/clone/`, {
    method: 'POST',
    headers: {
      'X-CSRFToken': getCsrfToken(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `group_by=${encodeURIComponent(groupBy)}`,
  })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const groupKey = r.headers.get('X-Clone-Group-Key') || '';
      return r.text().then(html => ({ html, groupKey }));
    })
    .then(({ html, groupKey }) => {
      // Parse new row
      const tmp = document.createElement('div');
      tmp.innerHTML = html.trim();
      const newRow = tmp.firstElementChild;
      if (!newRow) return;

      // Find insert position: same group → after original; else end of target group
      const sameGroup  = row.closest('.task-group');
      const targetBody = groupKey
        ? (document.getElementById('group-body-' + groupKey) || sameGroup?.querySelector('.group-body'))
        : sameGroup?.querySelector('.group-body');

      if (!targetBody) return;
      targetBody.querySelector('.empty-group')?.remove();

      if (targetBody === sameGroup?.querySelector('.group-body')) {
        row.insertAdjacentElement('afterend', newRow);
      } else {
        targetBody.appendChild(newRow);
      }

      // Activate HTMX on new row
      if (typeof htmx !== 'undefined') htmx.process(newRow);

      // Animate in
      newRow.style.cssText = 'opacity:0;transform:translateX(-8px)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        newRow.style.cssText = 'transition:opacity .25s,transform .25s;opacity:1;transform:none';
        setTimeout(() => newRow.removeAttribute('style'), 280);
      }));

      // Update group count
      const targetGroup = targetBody.closest('.task-group');
      if (targetGroup) _updateGroupCount(targetGroup);

      showToast('任務已複製', 'success');
    })
    .catch(() => showToast('複製失敗，請重試', 'error'))
    .finally(() => {
      btn.disabled = false;
      btn.style.opacity = '';
    });
}
