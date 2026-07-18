(function () {
  function getRuntimeEnv() {
    return window.DREAM_ANATOMY_ENV || {};
  }

  function getDiagnostics() {
    const runtimeEnv = getRuntimeEnv();

    return {
      runtimeConfigExists: Boolean(window.DREAM_ANATOMY_ENV),
      supabaseUrlSet: Boolean(runtimeEnv.SUPABASE_URL),
      supabaseAnonKeySet: Boolean(runtimeEnv.SUPABASE_ANON_KEY),
      windowSupabaseExists: Boolean(window.supabase)
    };
  }

  function getUnavailableMessage() {
    const diagnostics = getDiagnostics();

    if (!diagnostics.supabaseUrlSet || !diagnostics.supabaseAnonKeySet) {
      return "请先配置 Supabase 环境变量。";
    }

    if (!diagnostics.windowSupabaseExists) {
      return "Supabase SDK 暂时没有加载成功，请刷新页面后再试。";
    }

    return "Supabase 暂时无法初始化，请稍后再试。";
  }

  function formatDiagnostics() {
    const diagnostics = getDiagnostics();

    return [
      `runtime config 是否存在：${diagnostics.runtimeConfigExists ? "是" : "否"}`,
      `SUPABASE_URL 是否已设置：${diagnostics.supabaseUrlSet ? "是" : "否"}`,
      `SUPABASE_ANON_KEY 是否已设置：${diagnostics.supabaseAnonKeySet ? "是" : "否"}`,
      `window.supabase 是否存在：${diagnostics.windowSupabaseExists ? "是" : "否"}`
    ].join("\n");
  }

  let supabaseClient = null;
  let recoveryMode = false;

  const authOpenButton = document.querySelector("[data-auth-open]");
  const authSession = document.querySelector("[data-auth-session]");
  const authEmail = document.querySelector("[data-auth-email]");
  const authLogoutButton = document.querySelector("[data-auth-logout]");
  const authModal = document.querySelector("[data-auth-modal]");
  const authStatus = document.querySelector("[data-auth-status]");
  const authModeButtons = Array.from(document.querySelectorAll("[data-auth-mode]"));
  const authPanels = Array.from(document.querySelectorAll("[data-auth-panel]"));
  const closeButtons = Array.from(document.querySelectorAll("[data-auth-close]"));
  const loginForm = document.querySelector("[data-auth-login-form]");
  const registerForm = document.querySelector("[data-auth-register-form]");
  const forgotForm = document.querySelector("[data-auth-forgot-form]");
  const resetForm = document.querySelector("[data-auth-reset-form]");

  function getSupabaseClient() {
    if (supabaseClient) {
      return supabaseClient;
    }

    const env = getRuntimeEnv();

    if (!window.supabase || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      return null;
    }

    supabaseClient = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    return supabaseClient;
  }

  function notifyAuthUser(session, authEvent) {
    window.dispatchEvent(new CustomEvent("dream-anatomy-auth-session", {
      detail: {
        authEvent: authEvent || "",
        user: session && session.user ? session.user : null,
        client: getSupabaseClient()
      }
    }));
  }

  function setStatus(message, tone) {
    if (!authStatus) {
      return;
    }

    authStatus.textContent = message || "";
    authStatus.dataset.tone = tone || "neutral";
  }

  function setFormBusy(form, isBusy) {
    if (!form) {
      return;
    }

    const button = form.querySelector("button[type='submit']");
    if (button) {
      button.disabled = isBusy;
    }
  }

  function hasRegistrationLegalConsent() {
    if (!window.DreamPrivacyData || typeof window.DreamPrivacyData.validateRegistrationConsent !== "function") {
      return true;
    }

    return window.DreamPrivacyData.validateRegistrationConsent();
  }

  function trackProductEvent(eventName, properties) {
    if (!window.DreamProductAnalytics || typeof window.DreamProductAnalytics.trackEvent !== "function") {
      return;
    }

    window.DreamProductAnalytics.trackEvent(eventName, properties);
    if (typeof window.DreamProductAnalytics.flushEvents === "function") {
      Promise.resolve(window.DreamProductAnalytics.flushEvents()).catch(() => {});
    }
  }

  function showAuthPanel(mode) {
    authPanels.forEach((panel) => {
      const isActive = panel.dataset.authPanel === mode;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    authModeButtons.forEach((button) => {
      button.classList.toggle("is-current", button.dataset.authMode === mode);
    });
  }

  function openAuthModal(mode) {
    if (!authModal) {
      return;
    }

    authModal.hidden = false;
    showAuthPanel(mode || "login");
  }

  function closeAuthModal() {
    if (!authModal) {
      return;
    }

    authModal.hidden = true;
  }

  function getFormEmail(form) {
    const emailInput = form.querySelector("input[name='email']");
    return emailInput ? emailInput.value.trim() : "";
  }

  function getFormPassword(form) {
    const passwordInput = form.querySelector("input[name='password']");
    return passwordInput ? passwordInput.value : "";
  }

  function renderSession(session) {
    const email = session && session.user ? session.user.email : "";

    if (authOpenButton) {
      authOpenButton.hidden = Boolean(email);
    }

    if (authSession) {
      authSession.hidden = !email;
    }

    if (authEmail) {
      authEmail.textContent = email || "";
    }
  }

  function isUnverifiedError(error) {
    const message = error && error.message ? error.message.toLowerCase() : "";
    return message.includes("email not confirmed") || message.includes("not confirmed");
  }

  async function handleRegister(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus(`${getUnavailableMessage()}\n${formatDiagnostics()}`, "error");
      return;
    }

    if (!hasRegistrationLegalConsent()) {
      setStatus("请先阅读并勾选同意用户协议、隐私政策和 AI 使用说明。", "error");
      return;
    }

    setFormBusy(registerForm, true);
    const email = getFormEmail(registerForm);
    const password = getFormPassword(registerForm);

    trackProductEvent("signup_started", { entry_point: "auth" });

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (data && data.session) {
      await client.auth.signOut();
      renderSession(null);
      notifyAuthUser(null, "SIGNED_OUT");
    }

    setFormBusy(registerForm, false);

    if (error) {
      setStatus("注册暂时没有完成，请稍后再试。", "error");
      return;
    }

    trackProductEvent("signup_completed", { method: "email" });
    registerForm.reset();
    setStatus("验证邮件已发送，请完成邮箱验证后登录。\n梦境将能够安全保存并跨设备同步。", "success");
    showAuthPanel("login");
  }

  async function handleLogin(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus(`${getUnavailableMessage()}\n${formatDiagnostics()}`, "error");
      return;
    }

    setFormBusy(loginForm, true);
    const email = getFormEmail(loginForm);
    const password = getFormPassword(loginForm);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setFormBusy(loginForm, false);

    if (error) {
      setStatus(isUnverifiedError(error) ? "请先完成邮箱验证。" : "登录失败，请检查邮箱和密码。", "error");
      return;
    }

    if (data && data.user && !data.user.email_confirmed_at && !data.user.confirmed_at) {
      await client.auth.signOut();
      renderSession(null);
      notifyAuthUser(null, "SIGNED_OUT");
      setStatus("请先完成邮箱验证。", "error");
      return;
    }

    renderSession(data ? data.session : null);
    notifyAuthUser(data ? data.session : null, "SIGNED_IN");
    trackProductEvent("login_completed", { method: "email" });
    loginForm.reset();
    setStatus("欢迎回来，继续探索你的梦境。", "success");
  }

  async function handleForgotPassword(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus(`${getUnavailableMessage()}\n${formatDiagnostics()}`, "error");
      return;
    }

    setFormBusy(forgotForm, true);
    const email = getFormEmail(forgotForm);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    setFormBusy(forgotForm, false);

    if (error) {
      setStatus("重置密码邮件暂时没有发送成功，请稍后再试。", "error");
      return;
    }

    forgotForm.reset();
    setStatus("重置密码邮件已发送，请查看邮箱。", "success");
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    const client = getSupabaseClient();
    if (!client) {
      setStatus(`${getUnavailableMessage()}\n${formatDiagnostics()}`, "error");
      return;
    }

    setFormBusy(resetForm, true);
    const password = getFormPassword(resetForm);
    const { error } = await client.auth.updateUser({ password });
    setFormBusy(resetForm, false);

    if (error) {
      setStatus("密码暂时没有更新成功，请重新打开重置邮件再试。", "error");
      return;
    }

    resetForm.reset();
    recoveryMode = false;
    await client.auth.signOut();
    renderSession(null);
    notifyAuthUser(null, "SIGNED_OUT");
    showAuthPanel("login");
    setStatus("密码已更新，请重新登录。", "success");
  }

  async function handleLogout() {
    const client = getSupabaseClient();
    renderSession(null);
    notifyAuthUser(null, "SIGNED_OUT");

    if (!client) {
      return;
    }

    try {
      const { error } = await client.auth.signOut();

      if (error) {
        throw new Error("Logout failed");
      }
    } catch (error) {
      try {
        const { data } = await client.auth.getSession();
        const authoritativeSession = data ? data.session : null;
        renderSession(authoritativeSession);
        notifyAuthUser(authoritativeSession, "SESSION_RESTORED");
      } catch (sessionError) {
        return;
      }
    }
  }

  async function initAuth() {
    const client = getSupabaseClient();

    renderSession(null);

    authModeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        showAuthPanel(button.dataset.authMode);
        setStatus("");
      });
    });

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeAuthModal);
    });

    if (authOpenButton) {
      authOpenButton.addEventListener("click", () => {
        openAuthModal("login");
        if (!client) {
          setStatus(`${getUnavailableMessage()}\n${formatDiagnostics()}`, "error");
        }
      });
    }

    if (authLogoutButton) {
      authLogoutButton.addEventListener("click", handleLogout);
    }

    if (registerForm) {
      registerForm.addEventListener("submit", handleRegister);
    }

    if (loginForm) {
      loginForm.addEventListener("submit", handleLogin);
    }

    if (forgotForm) {
      forgotForm.addEventListener("submit", handleForgotPassword);
    }

    if (resetForm) {
      resetForm.addEventListener("submit", handleResetPassword);
    }

    if (!client) {
      return;
    }

    const { data } = await client.auth.getSession();
    renderSession(data ? data.session : null);
    notifyAuthUser(data ? data.session : null, "INITIAL_SESSION");

    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        recoveryMode = true;
        openAuthModal("reset");
        setStatus("请输入新密码。", "neutral");
        return;
      }

      if (!recoveryMode) {
        renderSession(session);
        notifyAuthUser(session, event);
      }
    });
  }

  window.DreamAnatomyAuth = {
    getClient: getSupabaseClient,
    getDiagnostics
  };

  document.addEventListener("DOMContentLoaded", initAuth);
})();
