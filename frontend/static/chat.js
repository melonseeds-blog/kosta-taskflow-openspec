/**
 * TaskFlow 채팅 폴링 로직
 * window.chat 노출
 */
(function () {
  'use strict';

  let _teamId = null;
  let _currentUser = null;
  let _pollInterval = null;
  let _lastTimestamp = null;
  let _retryCount = 0;
  const MAX_RETRY = 5;
  const BASE_INTERVAL = 5000;
  const FOCUS_INTERVAL = 2000;

  /* ─────────────── 초기화 ─────────────── */
  async function init(teamId, currentUser) {
    _teamId = teamId;
    _currentUser = currentUser;
    _retryCount = 0;
    _lastTimestamp = null;

    _bindInput();
    _bindMobileViewport();
    await loadMessages();
    startPolling();
  }

  /* ─────────────── 메시지 로드 ─────────────── */
  async function loadMessages() {
    try {
      const messages = await api.get(`/teams/${_teamId}/messages`);
      const list = Array.isArray(messages) ? messages : (messages.messages || []);
      _lastTimestamp = _extractLastTimestamp(list);
      renderMessages(list, true);
      _retryCount = 0;
      _updateNetworkStatus(true);
    } catch (err) {
      _handlePollError(err);
    }
  }

  /* ─────────────── 폴링 ─────────────── */
  function startPolling() {
    stopPolling();
    const interval = document.hasFocus() ? FOCUS_INTERVAL : BASE_INTERVAL;
    _pollInterval = setInterval(_poll, interval);
  }

  function stopPolling() {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
  }

  async function _poll() {
    // 채팅 섹션이 안 보이면 폴링 건너뜀
    const section = document.getElementById('chat-section');
    if (!section || section.classList.contains('hidden')) return;

    try {
      const url = _lastTimestamp
        ? `/teams/${_teamId}/messages?since=${encodeURIComponent(_lastTimestamp)}`
        : `/teams/${_teamId}/messages`;
      const messages = await api.get(url);
      const list = Array.isArray(messages) ? messages : (messages.messages || []);
      if (list.length > 0) {
        const ts = _extractLastTimestamp(list);
        if (ts) _lastTimestamp = ts;
        renderMessages(list, false);
      }
      _retryCount = 0;
      _updateNetworkStatus(true);
    } catch (err) {
      _handlePollError(err);
    }
  }

  function _handlePollError(err) {
    _updateNetworkStatus(false);
    if (_retryCount < MAX_RETRY) {
      _retryCount++;
      const backoff = Math.min(BASE_INTERVAL * Math.pow(2, _retryCount - 1), 60000);
      stopPolling();
      setTimeout(() => {
        startPolling();
      }, backoff);
    }
  }

  function _extractLastTimestamp(messages) {
    if (!messages || messages.length === 0) return _lastTimestamp;
    const last = messages[messages.length - 1];
    return last.created_at || _lastTimestamp;
  }

  /* ─────────────── 전송 ─────────────── */
  async function sendMessage(content) {
    if (!content || !content.trim()) return;
    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      showToast('메시지는 1000자 이하로 입력하세요.', 'warning');
      return;
    }
    try {
      const msg = await api.post(`/teams/${_teamId}/messages`, { content: trimmed });
      _lastTimestamp = msg.created_at || _lastTimestamp;
      renderMessages([msg], false);
    } catch (err) {
      showToast('메시지 전송 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  /* ─────────────── 삭제 ─────────────── */
  async function deleteMessage(messageId) {
    try {
      await api.delete(`/messages/${messageId}`);
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) el.remove();
      _checkEmptyState();
    } catch (err) {
      showToast('메시지 삭제 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    }
  }

  /* ─────────────── 렌더링 ─────────────── */
  function renderMessages(messages, replace) {
    const listEl = document.getElementById('chat-messages');
    if (!listEl) return;

    if (replace) {
      listEl.innerHTML = '';
    }

    if (replace && messages.length === 0) {
      listEl.innerHTML = `
        <div id="chat-empty" class="flex flex-col items-center justify-center h-full py-16 text-center">
          <p class="text-gray-400 text-sm">아직 대화가 없습니다</p>
          <p class="text-gray-300 text-xs mt-1">첫 메시지를 남겨보세요!</p>
        </div>`;
      return;
    }

    // 빈 상태 제거
    const empty = document.getElementById('chat-empty');
    if (empty) empty.remove();

    const atBottom = _isScrolledToBottom(listEl);

    messages.forEach(msg => {
      if (document.querySelector(`[data-message-id="${msg.id}"]`)) return;
      const isMine = msg.sender_id === _currentUser.id || msg.user_id === _currentUser.id;
      listEl.appendChild(_createMessageEl(msg, isMine));
    });

    if (atBottom || replace) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  }

  function _createMessageEl(msg, isMine) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-message-id', msg.id);
    wrapper.className = `flex ${isMine ? 'justify-end' : 'justify-start'} group mb-2`;

    const senderEmail = msg.sender_email || msg.email || '';
    const senderName = senderEmail ? senderEmail.split('@')[0] : '알 수 없음';
    const timeStr = msg.created_at ? _formatTime(msg.created_at) : '';

    const bubble = document.createElement('div');
    bubble.className = `relative max-w-[75%] ${
      isMine
        ? 'bg-teal-600 text-white rounded-2xl rounded-tr-sm'
        : 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
    } px-4 py-2.5 shadow-sm`;

    if (!isMine) {
      const nameEl = document.createElement('p');
      nameEl.className = 'text-xs font-semibold text-teal-700 mb-0.5';
      nameEl.textContent = senderName;
      bubble.appendChild(nameEl);
    }

    const contentEl = document.createElement('p');
    contentEl.className = 'text-sm leading-relaxed whitespace-pre-wrap break-words';
    contentEl.textContent = msg.content;
    bubble.appendChild(contentEl);

    const metaEl = document.createElement('p');
    metaEl.className = `text-xs mt-1 ${isMine ? 'text-teal-100' : 'text-gray-400'} text-right`;
    metaEl.textContent = timeStr;
    bubble.appendChild(metaEl);

    if (isMine) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = `absolute -top-2 -left-8 w-6 h-6 flex items-center justify-center
                             rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600
                             opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow`;
      deleteBtn.title = '메시지 삭제';
      deleteBtn.textContent = '🗑';
      deleteBtn.onclick = e => {
        e.stopPropagation();
        deleteMessage(msg.id);
      };
      bubble.appendChild(deleteBtn);
    }

    wrapper.appendChild(bubble);
    return wrapper;
  }

  /* ─────────────── 입력창 바인딩 ─────────────── */
  function _bindInput() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const counter = document.getElementById('chat-char-count');

    if (!input) return;

    input.addEventListener('input', () => {
      const len = input.value.length;
      if (counter) {
        counter.textContent = `${len}/1000`;
        counter.classList.toggle('text-red-500', len > 1000);
        counter.classList.toggle('text-gray-400', len <= 1000);
      }
      if (sendBtn) {
        sendBtn.disabled = len === 0 || len > 1000;
        sendBtn.classList.toggle('opacity-50', sendBtn.disabled);
        sendBtn.classList.toggle('cursor-not-allowed', sendBtn.disabled);
      }
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _doSend();
      }
    });

    input.addEventListener('focus', () => {
      // 포커스 시 폴링 2초로 단축
      stopPolling();
      _pollInterval = setInterval(_poll, FOCUS_INTERVAL);
    });

    input.addEventListener('blur', () => {
      // 포커스 해제 시 일반 폴링
      startPolling();
    });

    if (sendBtn) {
      sendBtn.addEventListener('click', _doSend);
    }
  }

  async function _doSend() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const content = input.value;
    input.value = '';
    const counter = document.getElementById('chat-char-count');
    if (counter) counter.textContent = '0/1000';
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add('opacity-50');
    }
    await sendMessage(content);
  }

  /* ─────────────── 모바일 키보드 대응 ─────────────── */
  function _bindMobileViewport() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', () => {
      const chatFooter = document.getElementById('chat-footer');
      if (!chatFooter) return;
      const offset = window.innerHeight - window.visualViewport.height;
      chatFooter.style.transform = `translateY(-${offset}px)`;
    });
  }

  /* ─────────────── 네트워크 상태 표시 ─────────────── */
  function _updateNetworkStatus(online) {
    const statusEl = document.getElementById('chat-network-status');
    if (!statusEl) return;
    if (online) {
      statusEl.className = 'w-2 h-2 rounded-full bg-green-400';
      statusEl.title = '연결됨 · 5초마다 새로고침';
    } else {
      statusEl.className = 'w-2 h-2 rounded-full bg-red-400 animate-pulse';
      statusEl.title = '연결 끊김 · 재연결 시도 중';
    }
  }

  /* ─────────────── 유틸 ─────────────── */
  function _isScrolledToBottom(el) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function _formatTime(isoStr) {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function _checkEmptyState() {
    const listEl = document.getElementById('chat-messages');
    if (!listEl) return;
    if (listEl.children.length === 0) {
      listEl.innerHTML = `
        <div id="chat-empty" class="flex flex-col items-center justify-center h-full py-16 text-center">
          <p class="text-gray-400 text-sm">아직 대화가 없습니다</p>
          <p class="text-gray-300 text-xs mt-1">첫 메시지를 남겨보세요!</p>
        </div>`;
    }
  }

  /* ─────────────── window 노출 ─────────────── */
  window.chat = {
    init,
    loadMessages,
    startPolling,
    stopPolling,
    sendMessage,
    deleteMessage,
    renderMessages,
  };

})();
