/**
 * TaskFlow 인증 상태 관리 + 라우팅 가드
 * window.auth 노출
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'token';
  const USER_KEY  = 'user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  }

  function setToken(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * 토큰 없으면 /login으로 이동
   */
  function requireAuth() {
    if (!getToken()) {
      window.location.href = '/login';
    }
  }

  /**
   * 이미 로그인된 경우 team_id 여부에 따라 /team 또는 /app으로 이동
   */
  function requireNoAuth() {
    const token = getToken();
    if (!token) return;
    const user = getUser();
    if (user && user.team_id) {
      window.location.href = '/app';
    } else {
      window.location.href = '/team';
    }
  }

  /**
   * team_id 없으면 /team, 토큰 없으면 /login으로 이동
   */
  function requireTeam() {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const user = getUser();
    if (!user || !user.team_id) {
      window.location.href = '/team';
    }
  }

  /* ─────────────── window 노출 ─────────────── */
  window.auth = {
    getToken,
    setToken,
    getUser,
    clearAuth,
    requireAuth,
    requireNoAuth,
    requireTeam,
  };
})();
