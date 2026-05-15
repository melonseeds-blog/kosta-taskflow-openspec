/**
 * TaskFlow 칸반 보드 로직
 * window.kanban 노출
 */
(function () {
  'use strict';

  let _teamId = null;
  let _currentUser = null;
  let _teamOwner = null;
  let _tasks = [];
  let _members = [];
  let _filter = 'all'; // 'all' | 'me' | 'unassigned'
  let _dragTaskId = null;

  const STATUSES = ['TODO', 'DOING', 'DONE'];
  const STATUS_LABELS = { TODO: 'TODO', DOING: 'DOING', DONE: 'DONE' };
  const COLUMN_COLORS = {
    TODO:  { bg: 'bg-yellow-50', header: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-200' },
    DOING: { bg: 'bg-blue-50',   header: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800',     border: 'border-blue-200' },
    DONE:  { bg: 'bg-green-50',  header: 'text-green-700',  badge: 'bg-green-100 text-green-800',   border: 'border-green-200' },
  };

  /* ─────────────── 초기화 ─────────────── */
  async function init(teamId, currentUser, teamOwnerInfo) {
    _teamId = teamId;
    _currentUser = currentUser;
    _teamOwner = teamOwnerInfo;

    _renderSkeleton();
    await Promise.all([_loadMembers(), loadTasks('all')]);
    _bindMobileSwipe();
  }

  /* ─────────────── 데이터 로드 ─────────────── */
  async function loadTasks(filter) {
    if (filter !== undefined) _filter = filter;
    try {
      const tasks = await api.get(`/teams/${_teamId}/tasks`);
      _tasks = Array.isArray(tasks) ? tasks : (tasks.tasks || []);
      renderTasks(_tasks);
    } catch (err) {
      showToast('태스크 로드 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  async function _loadMembers() {
    try {
      const data = await api.get(`/teams/${_teamId}/members`);
      _members = Array.isArray(data) ? data : (data.members || []);
    } catch {
      _members = [];
    }
  }

  /* ─────────────── 렌더링 ─────────────── */
  function renderTasks(tasks) {
    const filtered = _applyFilter(tasks);
    const grouped = { TODO: [], DOING: [], DONE: [] };
    filtered.forEach(t => {
      if (grouped[t.status] !== undefined) grouped[t.status].push(t);
    });
    // 최근 생성순 (id 내림차순)
    Object.keys(grouped).forEach(s => grouped[s].sort((a, b) => b.id - a.id));

    STATUSES.forEach(status => {
      const list = document.getElementById(`col-list-${status}`);
      const countEl = document.getElementById(`col-count-${status}`);
      if (!list) return;
      if (countEl) countEl.textContent = grouped[status].length;
      list.innerHTML = '';
      if (grouped[status].length === 0) {
        list.appendChild(_emptyState(status));
      } else {
        grouped[status].forEach(task => list.appendChild(_createCardEl(task)));
      }
    });

    _updateMobileIndicator();
  }

  function _applyFilter(tasks) {
    switch (_filter) {
      case 'me':
        return tasks.filter(t => t.assignee_id === _currentUser.id);
      case 'unassigned':
        return tasks.filter(t => !t.assignee_id);
      default:
        return tasks;
    }
  }

  function _renderSkeleton() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = STATUSES.map(s => _columnHTML(s)).join('');
    _bindColumnDrop();
    _bindFilterButtons();
  }

  function _columnHTML(status) {
    const c = COLUMN_COLORS[status];
    return `
      <div id="col-${status}"
           class="flex-1 min-w-0 rounded-xl ${c.bg} border ${c.border} flex flex-col"
           data-status="${status}"
           ondragover="kanban._onDragOver(event, '${status}')"
           ondragleave="kanban._onDragLeave(event, '${status}')"
           ondrop="kanban._onDrop(event, '${status}')">
        <!-- 컬럼 헤더 -->
        <div class="flex items-center justify-between px-4 py-3 border-b ${c.border}">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-sm ${c.header}">${status}</h3>
            <span id="col-count-${status}"
                  class="text-xs font-medium px-1.5 py-0.5 rounded-full ${c.badge}">0</span>
          </div>
          <button onclick="kanban._openAddForm('${status}')"
                  class="w-6 h-6 flex items-center justify-center rounded-md
                         text-gray-400 hover:text-teal-600 hover:bg-white transition-colors text-lg leading-none"
                  title="태스크 추가">+</button>
        </div>
        <!-- 인라인 추가 폼 (숨김) -->
        <div id="add-form-${status}" class="hidden px-3 pt-3">
          <input id="add-input-${status}" type="text" maxlength="200"
                 placeholder="태스크 제목 입력..."
                 class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2" />
          <select id="add-assignee-${status}"
                  class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-2 bg-white">
            <option value="">담당자 없음</option>
          </select>
          <div class="flex gap-2">
            <button onclick="kanban._submitAdd('${status}')"
                    class="flex-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-1.5 transition-colors">
              저장 (Enter)
            </button>
            <button onclick="kanban._closeAddForm('${status}')"
                    class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-1.5 transition-colors">
              취소 (Esc)
            </button>
          </div>
        </div>
        <!-- 카드 목록 -->
        <div id="col-list-${status}" class="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[80px]"></div>
      </div>`;
  }

  function _createCardEl(task) {
    const assignee = _members.find(m => m.user_id === task.assignee_id);
    const assigneeLabel = assignee
      ? '@' + (assignee.email || '').split('@')[0]
      : (task.assignee_id ? `@uid:${task.assignee_id}` : '미할당');

    const card = document.createElement('div');
    card.className = `bg-white border border-gray-200 rounded-lg px-3 py-2.5 shadow-sm
                      hover:shadow-md cursor-pointer transition-shadow select-none`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-task-id', task.id);
    card.innerHTML = `
      <p class="text-sm text-gray-800 font-medium leading-snug mb-1.5 line-clamp-2">${_escHtml(task.title)}</p>
      <p class="text-xs text-gray-400">#${task.id} · ${_escHtml(assigneeLabel)}</p>`;
    card.addEventListener('click', () => openTaskModal(task));
    card.addEventListener('dragstart', e => _onDragStart(e, task.id));
    card.addEventListener('dragend', _onDragEnd);
    return card;
  }

  function _emptyState(status) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center justify-center py-8 text-center';
    if (status === 'TODO') {
      div.innerHTML = `
        <p class="text-gray-400 text-sm mb-2">카드 없음</p>
        <button onclick="kanban._openAddForm('TODO')"
                class="text-xs text-teal-600 hover:underline">+ 첫 태스크 만들기</button>`;
    } else {
      div.innerHTML = `
        <p class="text-gray-400 text-sm mb-1">카드 없음</p>
        <p class="text-gray-300 text-xs">드래그로 이동</p>`;
    }
    return div;
  }

  /* ─────────────── 인라인 추가 폼 ─────────────── */
  function _openAddForm(status) {
    // 다른 폼들 닫기
    STATUSES.forEach(s => {
      if (s !== status) _closeAddForm(s);
    });
    const form = document.getElementById(`add-form-${status}`);
    const input = document.getElementById(`add-input-${status}`);
    const select = document.getElementById(`add-assignee-${status}`);
    if (!form || !input) return;

    // 멤버 옵션 채우기
    if (select) {
      select.innerHTML = '<option value="">담당자 없음</option>';
      _members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.user_id;
        opt.textContent = m.email + (m.user_id === _currentUser.id ? ' (나)' : '');
        select.appendChild(opt);
      });
    }

    form.classList.remove('hidden');
    input.focus();

    input.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); _submitAdd(status); }
      if (e.key === 'Escape') _closeAddForm(status);
    };
  }

  function _closeAddForm(status) {
    const form = document.getElementById(`add-form-${status}`);
    const input = document.getElementById(`add-input-${status}`);
    if (form) form.classList.add('hidden');
    if (input) input.value = '';
  }

  async function _submitAdd(status) {
    const input = document.getElementById(`add-input-${status}`);
    const select = document.getElementById(`add-assignee-${status}`);
    const title = input ? input.value.trim() : '';
    if (!title) { showToast('제목을 입력하세요.', 'warning'); return; }
    const assigneeId = select && select.value ? parseInt(select.value, 10) : null;
    _closeAddForm(status);
    await createTask(title, assigneeId, status);
  }

  /* ─────────────── CRUD ─────────────── */
  async function createTask(title, assigneeId, status = 'TODO') {
    try {
      const body = { title, status };
      if (assigneeId) body.assignee_id = assigneeId;
      const task = await api.post(`/teams/${_teamId}/tasks`, body);
      _tasks.unshift(task);
      renderTasks(_tasks);
      showToast('태스크가 생성되었습니다.', 'success');
    } catch (err) {
      showToast('태스크 생성 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  async function updateTaskStatus(taskId, status) {
    try {
      const updated = await api.patch(`/tasks/${taskId}/status`, { status });
      const idx = _tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) _tasks[idx] = { ..._tasks[idx], ...updated };
      renderTasks(_tasks);
    } catch (err) {
      showToast('상태 변경 실패: ' + (err.message || '알 수 없는 오류'), 'error');
      await loadTasks();
    }
  }

  async function deleteTask(taskId) {
    try {
      await api.delete(`/tasks/${taskId}`);
      _tasks = _tasks.filter(t => t.id !== taskId);
      renderTasks(_tasks);
      _closeTaskModal();
      showToast('태스크가 삭제되었습니다.', 'success');
    } catch (err) {
      showToast('태스크 삭제 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  /* ─────────────── 카드 상세 모달 ─────────────── */
  function openTaskModal(task) {
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    // 현재 태스크 저장
    modal._task = task;

    // 헤더
    document.getElementById('modal-task-id').textContent = `#${task.id}`;
    document.getElementById('modal-task-title').textContent = task.title;

    // 상태 버튼
    STATUSES.forEach(s => {
      const btn = document.getElementById(`modal-status-${s}`);
      if (!btn) return;
      btn.classList.toggle('bg-teal-600', s === task.status);
      btn.classList.toggle('text-white', s === task.status);
      btn.classList.toggle('border-teal-600', s === task.status);
      btn.classList.toggle('bg-white', s !== task.status);
      btn.classList.toggle('text-gray-700', s !== task.status);
      btn.classList.toggle('border-gray-300', s !== task.status);
    });
    modal._selectedStatus = task.status;

    // 담당자
    const assignee = _members.find(m => m.user_id === task.assignee_id);
    const assigneeEl = document.getElementById('modal-assignee');
    if (assigneeEl) {
      assigneeEl.innerHTML = '';
      const select = document.createElement('select');
      select.id = 'modal-assignee-select';
      select.className = 'text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white';
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = '담당자 없음';
      select.appendChild(noneOpt);
      _members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.user_id;
        opt.textContent = m.email + (m.user_id === _currentUser.id ? ' (나)' : '');
        if (m.user_id === task.assignee_id) opt.selected = true;
        select.appendChild(opt);
      });
      assigneeEl.appendChild(select);
    }

    // 생성자
    const creator = _members.find(m => m.user_id === task.creator_id);
    const creatorEl = document.getElementById('modal-creator');
    if (creatorEl) {
      creatorEl.textContent = creator
        ? '@' + creator.email.split('@')[0]
        : (task.creator_id ? `uid:${task.creator_id}` : '-');
    }

    // 생성 시각
    const createdEl = document.getElementById('modal-created-at');
    if (createdEl && task.created_at) {
      createdEl.textContent = new Date(task.created_at).toLocaleString('ko-KR');
    }

    // 삭제 버튼 권한
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
      const canDelete =
        task.creator_id === _currentUser.id ||
        (_teamOwner && _teamOwner.owner_id === _currentUser.id);
      deleteBtn.classList.toggle('hidden', !canDelete);
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function _closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async function _saveTaskModal() {
    const modal = document.getElementById('task-modal');
    if (!modal || !modal._task) return;
    const task = modal._task;
    const status = modal._selectedStatus || task.status;
    const selectEl = document.getElementById('modal-assignee-select');
    const assigneeId = selectEl && selectEl.value ? parseInt(selectEl.value, 10) : null;

    try {
      const updated = await api.put(`/tasks/${task.id}`, { status, assignee_id: assigneeId });
      const idx = _tasks.findIndex(t => t.id === task.id);
      if (idx !== -1) _tasks[idx] = { ..._tasks[idx], ...updated };
      renderTasks(_tasks);
      _closeTaskModal();
      showToast('태스크가 수정되었습니다.', 'success');
    } catch (err) {
      showToast('수정 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  /* ─────────────── Drag & Drop ─────────────── */
  function _onDragStart(e, taskId) {
    _dragTaskId = taskId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
  }

  function _onDragEnd(e) {
    e.target.classList.remove('opacity-50');
    STATUSES.forEach(s => {
      const col = document.getElementById(`col-${s}`);
      if (col) col.classList.remove('ring-2', 'ring-teal-400');
    });
  }

  function _onDragOver(e, status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = document.getElementById(`col-${status}`);
    if (col) col.classList.add('ring-2', 'ring-teal-400');
  }

  function _onDragLeave(e, status) {
    const col = document.getElementById(`col-${status}`);
    if (col && !col.contains(e.relatedTarget)) {
      col.classList.remove('ring-2', 'ring-teal-400');
    }
  }

  function _onDrop(e, status) {
    e.preventDefault();
    const col = document.getElementById(`col-${status}`);
    if (col) col.classList.remove('ring-2', 'ring-teal-400');
    const taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!taskId) return;
    const task = _tasks.find(t => t.id === taskId);
    if (!task || task.status === status) return;
    updateTaskStatus(taskId, status);
  }

  function _bindColumnDrop() {
    // 이미 HTML 속성으로 바인딩됨
  }

  /* ─────────────── 필터 ─────────────── */
  function _bindFilterButtons() {
    ['all', 'me', 'unassigned'].forEach(f => {
      const btn = document.getElementById(`filter-${f}`);
      if (!btn) return;
      btn.addEventListener('click', () => {
        _filter = f;
        _updateFilterUI();
        renderTasks(_tasks);
      });
    });
  }

  function _updateFilterUI() {
    ['all', 'me', 'unassigned'].forEach(f => {
      const btn = document.getElementById(`filter-${f}`);
      if (!btn) return;
      const active = f === _filter;
      btn.classList.toggle('bg-teal-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('bg-white', !active);
      btn.classList.toggle('text-gray-700', !active);
    });
  }

  /* ─────────────── 모바일 스와이프 ─────────────── */
  let _mobileCol = 0; // 0=TODO, 1=DOING, 2=DONE
  let _touchStartX = 0;

  function _bindMobileSwipe() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.addEventListener('touchstart', e => {
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });
    board.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _touchStartX;
      if (Math.abs(dx) < 50) return;
      if (dx < 0 && _mobileCol < 2) _mobileCol++;
      else if (dx > 0 && _mobileCol > 0) _mobileCol--;
      _showMobileColumn(_mobileCol);
    }, { passive: true });
  }

  function _showMobileColumn(idx) {
    _mobileCol = idx;
    STATUSES.forEach((s, i) => {
      const col = document.getElementById(`col-${s}`);
      if (!col) return;
      if (window.innerWidth < 768) {
        col.style.display = i === idx ? 'flex' : 'none';
      } else {
        col.style.display = 'flex';
      }
    });
    _updateMobileIndicator();
  }

  function _updateMobileIndicator() {
    STATUSES.forEach((s, i) => {
      const tab = document.getElementById(`mobile-tab-${s}`);
      if (!tab) return;
      const active = i === _mobileCol;
      tab.classList.toggle('bg-teal-600', active);
      tab.classList.toggle('text-white', active);
      tab.classList.toggle('bg-white', !active);
      tab.classList.toggle('text-gray-600', !active);
    });
  }

  /* ─────────────── 유틸 ─────────────── */
  function _escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─────────────── window 노출 ─────────────── */
  window.kanban = {
    init,
    loadTasks,
    renderTasks,
    createTask,
    updateTaskStatus,
    openTaskModal,
    deleteTask,
    // 내부 (HTML 이벤트에서 접근)
    _openAddForm,
    _closeAddForm,
    _submitAdd,
    _onDragOver,
    _onDragLeave,
    _onDrop,
    _closeTaskModal,
    _saveTaskModal,
    _showMobileColumn,
    _bindDeleteConfirm(taskId) {
      const task = _tasks.find(t => t.id === taskId);
      if (task) _openDeleteConfirm(task);
    },
    _setModalStatus(status) {
      const modal = document.getElementById('task-modal');
      if (modal) modal._selectedStatus = status;
      STATUSES.forEach(s => {
        const btn = document.getElementById(`modal-status-${s}`);
        if (!btn) return;
        const active = s === status;
        btn.classList.toggle('bg-teal-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('border-teal-600', active);
        btn.classList.toggle('bg-white', !active);
        btn.classList.toggle('text-gray-700', !active);
        btn.classList.toggle('border-gray-300', !active);
      });
    },
  };

  function _openDeleteConfirm(task) {
    const dialog = document.getElementById('delete-dialog');
    if (!dialog) return;
    const msgEl = document.getElementById('delete-dialog-msg');
    if (msgEl) msgEl.textContent = `"${task.title}" 태스크를 삭제하시겠습니까?`;
    dialog._taskId = task.id;
    dialog.classList.remove('hidden');
    dialog.classList.add('flex');
  }

  // 삭제 다이얼로그 전역 바인딩용
  window._kanbanConfirmDelete = async function () {
    const dialog = document.getElementById('delete-dialog');
    if (!dialog || !dialog._taskId) return;
    const taskId = dialog._taskId;
    dialog.classList.add('hidden');
    dialog.classList.remove('flex');
    await deleteTask(taskId);
  };

  window._kanbanCancelDelete = function () {
    const dialog = document.getElementById('delete-dialog');
    if (!dialog) return;
    dialog.classList.add('hidden');
    dialog.classList.remove('flex');
  };

})();
