// Shared two-step contact exchange for both digital cards. The server owns routing.
(function () {
  'use strict';
  var panel = document.getElementById('xhPanel');
  var toggle = document.getElementById('xhToggle');
  var form = document.getElementById('xhForm');
  if (!panel || !toggle || !form) return;

  var details = document.getElementById('xhDetails');
  var verificationFields = document.getElementById('xhVerification');
  var send = document.getElementById('xhSend');
  var verify = document.getElementById('xhVerify');
  var change = document.getElementById('xhChange');
  var status = document.getElementById('xhStatus');
  var code = document.getElementById('xhCode');
  var recipient = document.getElementById('xhRecipient');
  var security = document.getElementById('xhSecurity');
  var securityStatus = document.getElementById('xhSecurityStatus');
  var securityRetry = document.getElementById('xhSecurityRetry');
  var restartHint = document.getElementById('xhRestartHint');
  var config = null;
  var busy = false;
  var configLoading = false;
  var configFailed = false;
  var token = '';
  var widget = null;
  var widgetGeneration = 0;
  var widgetLoading = false;
  var scriptPromise = null;
  var verification = null;
  var cooldownUntil = 0;
  var cooldownTimer = null;
  var completed = false;

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('err', !!isError);
    status.setAttribute('role', isError ? 'alert' : 'status');
  }

  function updateButtons() {
    var remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    send.disabled = busy || !config || !!(config.siteKey && !token) || remaining > 0;
    send.textContent = busy && !verification ? 'Sending verification code…' :
      remaining > 0 ? 'Try again in ' + remaining + 's' : 'Continue to email verification';
    verify.disabled = busy || !/^\d{6}$/.test(code.value);
    verify.textContent = busy && verification ? 'Verifying and sending…' : 'Verify and send to ' + form.dataset.recipient;
    change.disabled = busy;
    details.disabled = busy;
    verificationFields.disabled = busy;
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    restartHint.textContent = 'No code? Check your spam folder. Use “Change details” to correct your address or request a new code' +
      (remaining > 0 ? ' in ' + remaining + ' seconds.' : '.');
    if (!remaining && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }

  function setCooldown(seconds) {
    cooldownUntil = Date.now() + seconds * 1000;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(updateButtons, 1000);
    updateButtons();
  }

  async function request(path, payload) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 90000);
    try {
      var response = await fetch(path, {
        method: payload ? 'POST' : 'GET',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
        cache: 'no-store',
        signal: controller.signal
      });
      var data = await response.json().catch(function () { return null; });
      if (!response.ok) {
        var retryAfter = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(retryAfter) && retryAfter > 0) setCooldown(retryAfter);
        throw new Error(data && data.error || 'The contact service is unavailable. Please try again later.');
      }
      if (!data || typeof data !== 'object') throw new Error('Unexpected response. Please try again.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request timed out. Please try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function loadTurnstile() {
    if (window.turnstile) {
      return new Promise(function (resolve) {
        window.turnstile.ready(function () { resolve(window.turnstile); });
      });
    }
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      function fail() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        script.remove();
        scriptPromise = null;
        reject(new Error('The security check could not load. Check your connection and try again.'));
      }
      var timeout = setTimeout(fail, 15000);
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onerror = fail;
      script.onload = function () {
        if (!window.turnstile) return fail();
        window.turnstile.ready(function () {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(window.turnstile);
        });
      };
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function removeWidget() {
    widgetGeneration += 1;
    widgetLoading = false;
    token = '';
    if (widget !== null && window.turnstile) window.turnstile.remove(widget);
    widget = null;
    security.replaceChildren();
  }

  async function renderSecurity() {
    if (!config || !config.siteKey || verification || completed || busy || widget !== null || widgetLoading || !panel.classList.contains('open')) return;
    var generation = ++widgetGeneration;
    widgetLoading = true;
    securityStatus.textContent = 'Loading security check…';
    securityRetry.hidden = true;
    function invalidate(message) {
      if (generation !== widgetGeneration) return;
      token = '';
      securityStatus.textContent = message;
      securityRetry.hidden = false;
      updateButtons();
    }
    try {
      var api = await loadTurnstile();
      if (generation !== widgetGeneration || verification || completed) return;
      securityStatus.textContent = 'Please complete the security check.';
      widget = api.render(security, {
        sitekey: config.siteKey,
        action: 'contact',
        theme: 'dark',
        size: 'flexible',
        'response-field': false,
        callback: function (value) {
          if (generation !== widgetGeneration) return;
          token = value;
          securityStatus.textContent = 'Security check complete.';
          securityRetry.hidden = true;
          updateButtons();
        },
        'expired-callback': function () { invalidate('The security check expired. Please complete it again.'); },
        'error-callback': function () { invalidate('The security check failed. Please try again.'); },
        'timeout-callback': function () { invalidate('The security check timed out. Please try again.'); }
      });
    } catch (error) {
      invalidate(error.message || 'The security check is unavailable.');
    } finally {
      if (generation === widgetGeneration) widgetLoading = false;
    }
  }

  async function loadConfig() {
    if (configLoading || completed) return;
    configLoading = true;
    configFailed = false;
    securityRetry.hidden = true;
    securityStatus.textContent = 'Loading secure contact form…';
    try {
      var data = await request('/api/contact/config');
      if (data.available !== true || typeof data.siteKey !== 'string') throw new Error('unavailable');
      config = { siteKey: data.siteKey };
      securityStatus.textContent = '';
      await renderSecurity();
    } catch (_) {
      config = null;
      configFailed = true;
      securityStatus.textContent = 'The contact form is temporarily unavailable. Please try again later.';
      securityRetry.hidden = false;
    } finally {
      configLoading = false;
      updateButtons();
    }
  }

  toggle.addEventListener('click', function () {
    var open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && !completed) {
      if (!config) loadConfig();
      else renderSecurity();
    }
  });

  securityRetry.addEventListener('click', function () {
    if (busy) return;
    if (!config || configFailed) loadConfig();
    else {
      removeWidget();
      updateButtons();
      renderSecurity();
    }
  });

  change.addEventListener('click', function () {
    if (busy) return;
    verification = null;
    code.value = '';
    verificationFields.hidden = true;
    details.hidden = false;
    showStatus('');
    removeWidget();
    updateButtons();
    renderSecurity();
    form.elements.name.focus();
  });

  code.addEventListener('input', function () {
    code.value = code.value.replace(/[^0-9]/g, '').slice(0, 6);
    updateButtons();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || completed) return;
    showStatus('');
    if (verification) {
      if (!/^\d{6}$/.test(code.value)) {
        showStatus('Enter the six-digit code from your email.', true);
        code.focus();
        return;
      }
      busy = true;
      updateButtons();
      showStatus('Verifying your email and sending your details…');
      try {
        var result = await request('/api/contact/verify', { verificationId: verification.id, code: code.value });
        if (result.ok !== true || result.sent !== true) throw new Error(result.error || 'Your details have not been sent. Please try again.');
        completed = true;
        document.getElementById('xhStamp').textContent = 'SENT — ' + new Date()
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
        panel.classList.add('sent');
        showStatus('');
        document.getElementById('xhDone').focus();
        if (cooldownTimer) clearInterval(cooldownTimer);
      } catch (error) {
        showStatus(error.message || 'Could not verify your email. Please try again.', true);
      } finally {
        busy = false;
        updateButtons();
      }
      return;
    }
    if (cooldownUntil > Date.now()) return;
    if (!config || (config.siteKey && !token)) {
      showStatus('Please complete the security check before continuing.', true);
      return;
    }
    var fields = form.elements;
    var name = fields.name.value.trim();
    var email = fields.email.value.trim();
    var phone = fields.phone.value.trim();
    var note = fields.note.value.trim();
    if (!name || name.length > 120) {
      showStatus('Your name, please (up to 120 characters).', true);
      fields.name.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      showStatus('Please enter a valid email address.', true);
      fields.email.focus();
      return;
    }
    if (phone.length > 40 || note.length > 500) {
      showStatus('Please shorten your phone number or note.', true);
      return;
    }
    var sentLong = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    var payload = {
      name: name,
      email: email,
      phone: phone,
      message: 'Contact details shared via the Solaria digital card on ' + sentLong + '.' + (note ? '\n\n' + note : ''),
      kind: 'card',
      cardId: form.dataset.cardId,
      website: fields.website.value.trim(),
      turnstileToken: token
    };
    busy = true;
    removeWidget();
    updateButtons();
    showStatus('Sending a verification code to your email…');
    try {
      var data = await request('/api/contact', payload);
      if (data.ok !== true || data.verificationRequired !== true || typeof data.verificationId !== 'string' || !data.verificationId) {
        throw new Error(data.error || 'Email verification could not be started. Please try again.');
      }
      verification = { id: data.verificationId, email: email };
      setCooldown(60);
      recipient.textContent = email;
      code.value = '';
      details.hidden = true;
      verificationFields.hidden = false;
      showStatus('Code sent. Your details have not been sent to ' + form.dataset.recipient + ' yet.');
    } catch (error) {
      showStatus(error.message || 'Could not send a verification code. Please try again.', true);
    } finally {
      busy = false;
      updateButtons();
      if (verification) code.focus();
      else renderSecurity();
    }
  });

  updateButtons();
})();
