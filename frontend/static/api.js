/**
 * TaskFlow API 유틸리티
 * window.api, window.showToast 노출
 */
(function () {
  'use strict';

  const BASE = '/api';

  /* ─────────────── 토스트 ─────────────── */
  function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
      document.body.appendChild(container);
    }

    const colors = {
      error:   'bg-red-600 text-white',
      success: 'bg-teal-600 text-white',
      info:    'bg-blue-600 text-white',
      warning: 'bg-yellow-500 text-white',
    };
    const colorClass = colors[type] || colors.error;

    const toast = document.createElement('div');
    toast.className =
      `${colorClass} px-4 py-3 rounded-lg shadow-lg text-sm font-medium
       flex items-center gap-2 min-w-[240px] max-w-xs
       transition-all duration-300 translate-x-0 opacity-100`;
    toast.textContent = message;

    container.appendChild(toast);

    // 3초 후 페이드아웃 + 제거
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ─────────────── 핵심 request ─────────────── */
  async function request(method, path, body) {
    const token = localStorage.getItem('token');

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body !== undefined && body !== null) {
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${BASE}${path}`, options);
    } catch (networkError) {
      throw { code: 'NETWORK_ERROR', message: '네트워크 오류가 발생했습니다.' };
    }

    // 204 No Content
    if (response.status === 204) return null;

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // 401: 인증 만료
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showToast('인증이 만료되었습니다.', 'error');
      setTimeout(() => { window.location.href = '/login'; }, 1500);
      throw { code: 'UNAUTHORIZED', message: '인증이 만료되었습니다.' };
    }

    // 4xx / 5xx 에러
    if (!response.ok) {
      const errMessage =
        (data && (data.detail || data.message)) ||
        `오류가 발생했습니다. (${response.status})`;
      throw { code: `HTTP_${response.status}`, message: errMessage, status: response.status };
    }

    return data;
  }

  /* ─────────────── 단축 메서드 ─────────────── */
  const api = {
    request,
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    patch:  (path, body)  => request('PATCH',  path, body),
    put:    (path, body)  => request('PUT',    path, body),
    delete: (path)        => request('DELETE', path),
  };

  /* ─────────────── window 노출 ─────────────── */
  window.api = api;
  window.showToast = showToast;
})();
