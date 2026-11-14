/**
 * WIRELESS MOBILE KEYBOARD & MOUSE - CLIENT APPLICATION
 * Version 1.0
 */

(function () {
  'use strict';

  // State & Settings
  const state = {
    ws: null,
    isConnected: false,
    reconnectInterval: null,
    sensitivity: parseFloat(localStorage.getItem('airmouse_sens') || '1.3'),
    scrollSpeed: parseFloat(localStorage.getItem('airmouse_scroll') || '1.0'),
    invertScroll: localStorage.getItem('airmouse_invert') === 'true',
    haptics: localStorage.getItem('airmouse_haptics') !== 'false',
    acceleration: localStorage.getItem('airmouse_accel') !== 'false',
    isKeyboardHidden: false,
    activeModifiers: new Set(), // 'ctrl', 'alt', 'shift'
    lastTapTime: 0,
    tapTimeout: null
  };

  // DOM Elements
  const els = {
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.getElementById('statusText'),
    touchpad: document.getElementById('touchpad'),
    rippleLayer: document.getElementById('rippleLayer'),
    btnLeftClick: document.getElementById('btnLeftClick'),
    btnMiddleClick: document.getElementById('btnMiddleClick'),
    btnRightClick: document.getElementById('btnRightClick'),
    btnToggleKb: document.getElementById('btnToggleKb'),
    btnFullscreen: document.getElementById('btnFullscreen'),
    btnShowQr: document.getElementById('btnShowQr'),
    btnSettings: document.getElementById('btnSettings'),
    keyboardSection: document.getElementById('keyboardSection'),
    touchpadSection: document.getElementById('touchpadSection'),
    mobileInput: document.getElementById('mobileInput'),
    btnClearInput: document.getElementById('btnClearInput'),
    btnSendText: document.getElementById('btnSendText'),
    desktopBanner: document.getElementById('desktopBanner'),
    btnCloseDesktopBanner: document.getElementById('btnCloseDesktopBanner'),
    bannerQrImg: document.getElementById('bannerQrImg'),
    bannerServerUrl: document.getElementById('bannerServerUrl'),
    btnCopyUrl: document.getElementById('btnCopyUrl'),
    qrModal: document.getElementById('qrModal'),
    modalQrImg: document.getElementById('modalQrImg'),
    modalServerUrl: document.getElementById('modalServerUrl'),
    btnCloseQrModal: document.getElementById('btnCloseQrModal'),
    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
    rangeSensitivity: document.getElementById('rangeSensitivity'),
    valSensitivity: document.getElementById('valSensitivity'),
    rangeScroll: document.getElementById('rangeScroll'),
    valScroll: document.getElementById('valScroll'),
    checkInvertScroll: document.getElementById('checkInvertScroll'),
    checkHaptics: document.getElementById('checkHaptics'),
    checkAcceleration: document.getElementById('checkAcceleration')
  };

  // ==========================================================================
  // WEBSOCKET COMMUNICATION
  // ==========================================================================

  function getWsUrl() {
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}`;
  }

  function connectWebSocket() {
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    updateStatus(false, 'Connecting...');

    try {
      state.ws = new WebSocket(getWsUrl());

      state.ws.onopen = () => {
        updateStatus(true, 'Connected');
        if (state.reconnectInterval) {
          clearInterval(state.reconnectInterval);
          state.reconnectInterval = null;
        }
      };

      state.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            updateStatus(true, 'Connected');
          }
        } catch (e) {}
      };

      state.ws.onclose = () => {
        updateStatus(false, 'Disconnected');
        triggerAutoReconnect();
      };

      state.ws.onerror = () => {
        updateStatus(false, 'Error');
        state.ws.close();
      };
    } catch (e) {
      updateStatus(false, 'Failed');
      triggerAutoReconnect();
    }
  }

  function triggerAutoReconnect() {
    if (!state.reconnectInterval) {
      state.reconnectInterval = setInterval(() => {
        connectWebSocket();
      }, 2000);
    }
  }

  function updateStatus(connected, text) {
    state.isConnected = connected;
    els.statusText.textContent = text;
    if (connected) {
      els.statusBadge.classList.add('connected');
      els.statusBadge.classList.remove('disconnected');
    } else {
      els.statusBadge.classList.remove('connected');
      els.statusBadge.classList.add('disconnected');
    }
  }

  function send(data) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  function vibrate(ms = 20) {
    if (state.haptics && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  }

  // ==========================================================================
  // TOUCHPAD LOGIC & GESTURES
  // ==========================================================================

  let touchTracker = {
    activeTouches: new Map(), // id -> { startX, startY, lastX, lastY, startTime }
    isMoving: false,
    twoFingerMoving: false,
    touchCount: 0,
    twoFingerStartTime: 0
  };

  function spawnRipple(x, y) {
    const rect = els.touchpad.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;

    const rip = document.createElement('div');
    rip.className = 'touch-ripple';
    rip.style.left = `${relX}px`;
    rip.style.top = `${relY}px`;
    els.rippleLayer.appendChild(rip);

    setTimeout(() => {
      rip.remove();
    }, 400);
  }

  els.touchpad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touches = e.touches;
    touchTracker.touchCount = touches.length;

    const now = Date.now();

    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      touchTracker.activeTouches.set(t.identifier, {
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        startTime: now
      });
    }

    if (touches.length === 1) {
      touchTracker.isMoving = false;
      spawnRipple(touches[0].clientX, touches[0].clientY);
    } else if (touches.length === 2) {
      touchTracker.twoFingerMoving = false;
      touchTracker.twoFingerStartTime = now;
    }
  }, { passive: false });

  els.touchpad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1) {
      // 1 FINGER = CURSOR MOVEMENT
      const t = touches[0];
      const prev = touchTracker.activeTouches.get(t.identifier);

      if (prev) {
        let dx = t.clientX - prev.lastX;
        let dy = t.clientY - prev.lastY;

        const totalDist = Math.hypot(t.clientX - prev.startX, t.clientY - prev.startY);
        if (totalDist > 5) {
          touchTracker.isMoving = true;
        }

        if (touchTracker.isMoving) {
          // Trackpad velocity acceleration
          if (state.acceleration) {
            const speed = Math.hypot(dx, dy);
            const accel = 1 + Math.min(speed / 8, 2.2);
            dx *= accel * state.sensitivity;
            dy *= accel * state.sensitivity;
          } else {
            dx *= state.sensitivity;
            dy *= state.sensitivity;
          }

          send({ type: 'mouse_move', dx, dy });
        }

        prev.lastX = t.clientX;
        prev.lastY = t.clientY;
      }
    } else if (touches.length === 2) {
      // 2 FINGERS = SMOOTH SCROLLING
      const t1 = touches[0];
      const t2 = touches[1];
      const prev1 = touchTracker.activeTouches.get(t1.identifier);
      const prev2 = touchTracker.activeTouches.get(t2.identifier);

      if (prev1 && prev2) {
        const dy1 = t1.clientY - prev1.lastX !== undefined ? (t1.clientY - prev1.lastY) : 0;
        const dy2 = t2.clientY - prev2.lastY !== undefined ? (t2.clientY - prev2.lastY) : 0;
        const avgDy = (dy1 + dy2) / 2;

        if (Math.abs(avgDy) > 1.5) {
          touchTracker.twoFingerMoving = true;
          // Windows WHEEL_DELTA is usually 120 per click
          let scrollAmount = avgDy * 12 * state.scrollSpeed;
          if (state.invertScroll) {
            scrollAmount = -scrollAmount;
          }

          send({ type: 'mouse_scroll', amount: scrollAmount });
        }

        prev1.lastX = t1.clientX;
        prev1.lastY = t1.clientY;
        prev2.lastX = t2.clientX;
        prev2.lastY = t2.clientY;
      }
    }
  }, { passive: false });

  els.touchpad.addEventListener('touchend', (e) => {
    e.preventDefault();
    const now = Date.now();

    // Check 2-finger tap (Right Click)
    if (touchTracker.touchCount === 2 && !touchTracker.twoFingerMoving) {
      const elapsed = now - touchTracker.twoFingerStartTime;
      if (elapsed < 350) {
        vibrate(35);
        send({ type: 'mouse_click', button: 'right' });
        touchTracker.activeTouches.clear();
        return;
      }
    }

    // Check 1-finger tap (Left Click / Double Click)
    if (touchTracker.touchCount === 1 && !touchTracker.isMoving) {
      const remainingTouches = e.touches.length;
      if (remainingTouches === 0) {
        const timeSinceLast = now - state.lastTapTime;

        if (timeSinceLast < 280) {
          // Double Tap = Double Click
          if (state.tapTimeout) {
            clearTimeout(state.tapTimeout);
            state.tapTimeout = null;
          }
          vibrate(40);
          send({ type: 'mouse_dblclick', button: 'left' });
          state.lastTapTime = 0;
        } else {
          // Single Tap = Left Click
          state.lastTapTime = now;
          state.tapTimeout = setTimeout(() => {
            vibrate(20);
            send({ type: 'mouse_click', button: 'left' });
            state.tapTimeout = null;
          }, 240);
        }
      }
    }

    // Remove ended touches from active map
    for (let i = 0; i < e.changedTouches.length; i++) {
      touchTracker.activeTouches.delete(e.changedTouches[i].identifier);
    }

    if (e.touches.length === 0) {
      touchTracker.touchCount = 0;
      touchTracker.isMoving = false;
      touchTracker.twoFingerMoving = false;
    }
  }, { passive: false });

  // Mouse emulation for desktop testing
  let isMouseTesting = false;
  let mouseStartPos = { x: 0, y: 0 };

  els.touchpad.addEventListener('mousedown', (e) => {
    if ('ontouchstart' in window) return; // Ignore on touch devices
    isMouseTesting = true;
    mouseStartPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseTesting) return;
    const dx = (e.clientX - mouseStartPos.x) * state.sensitivity;
    const dy = (e.clientY - mouseStartPos.y) * state.sensitivity;
    send({ type: 'mouse_move', dx, dy });
    mouseStartPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    isMouseTesting = false;
  });

  // ==========================================================================
  // PHYSICAL LEFT / MIDDLE / RIGHT CLICK BUTTONS
  // ==========================================================================

  function bindMouseButton(el, buttonName) {
    const handleDown = (e) => {
      e.preventDefault();
      vibrate(25);
      el.classList.add('active-press');
      send({ type: 'mouse_down', button: buttonName });
    };

    const handleUp = (e) => {
      e.preventDefault();
      el.classList.remove('active-press');
      send({ type: 'mouse_up', button: buttonName });
    };

    el.addEventListener('touchstart', handleDown, { passive: false });
    el.addEventListener('touchend', handleUp, { passive: false });
    el.addEventListener('mousedown', handleDown);
    el.addEventListener('mouseup', handleUp);
  }

  bindMouseButton(els.btnLeftClick, 'left');
  bindMouseButton(els.btnMiddleClick, 'middle');
  bindMouseButton(els.btnRightClick, 'right');

  // ==========================================================================
  // MOBILE NATIVE KEYBOARD TYPING
  // ==========================================================================

  let prevInputValue = '';

  els.mobileInput.addEventListener('input', (e) => {
    const current = els.mobileInput.value;

    if (current.length > prevInputValue.length) {
      // New characters added
      const added = current.slice(prevInputValue.length);
      send({ type: 'type_text', text: added });
      vibrate(15);
    } else if (current.length < prevInputValue.length) {
      // Characters deleted
      const diff = prevInputValue.length - current.length;
      for (let i = 0; i < diff; i++) {
        send({ type: 'key_press', key: 'backspace' });
      }
      vibrate(15);
    }

    prevInputValue = current;
  });

  els.mobileInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send({ type: 'key_press', key: 'enter' });
      vibrate(25);
      els.mobileInput.value = '';
      prevInputValue = '';
    }
  });

  els.btnClearInput.addEventListener('click', () => {
    els.mobileInput.value = '';
    prevInputValue = '';
    els.mobileInput.focus();
  });

  els.btnSendText.addEventListener('click', () => {
    send({ type: 'key_press', key: 'enter' });
    vibrate(25);
    els.mobileInput.value = '';
    prevInputValue = '';
  });

  // ==========================================================================
  // COMPUTER KEYS, MODIFIERS & SHORTCUTS
  // ==========================================================================

  // Regular single keys (data-key)
  document.querySelectorAll('[data-key]').forEach(btn => {
    const key = btn.getAttribute('data-key');

    const handlePress = (e) => {
      e.preventDefault();
      vibrate(20);
      btn.classList.add('pressed');

      send({ type: 'key_press', key });

      // If modifiers were active, release them after action
      releaseActiveModifiers();

      setTimeout(() => {
        btn.classList.remove('pressed');
      }, 150);
    };

    btn.addEventListener('touchstart', handlePress, { passive: false });
    btn.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) handlePress(e);
    });
  });

  // Shortcut combo buttons (data-shortcut)
  document.querySelectorAll('[data-shortcut]').forEach(btn => {
    const combo = btn.getAttribute('data-shortcut');

    const handlePress = (e) => {
      e.preventDefault();
      vibrate(30);
      btn.classList.add('pressed');

      send({ type: 'shortcut', combo });

      setTimeout(() => {
        btn.classList.remove('pressed');
      }, 150);
    };

    btn.addEventListener('touchstart', handlePress, { passive: false });
    btn.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) handlePress(e);
    });
  });

  // Latchable Modifier Keys (Ctrl, Alt, Shift)
  const modifierKeys = ['ctrl', 'alt', 'shift'];

  modifierKeys.forEach(mod => {
    const btn = document.getElementById(`key${mod.charAt(0).toUpperCase() + mod.slice(1)}`);
    if (!btn) return;

    const toggleModifier = (e) => {
      e.preventDefault();
      vibrate(25);

      if (state.activeModifiers.has(mod)) {
        state.activeModifiers.delete(mod);
        btn.classList.remove('active-latch');
        send({ type: 'key_up', key: mod });
      } else {
        state.activeModifiers.add(mod);
        btn.classList.add('active-latch');
        send({ type: 'key_down', key: mod });
      }
    };

    btn.addEventListener('touchstart', toggleModifier, { passive: false });
    btn.addEventListener('click', (e) => {
      if (!('ontouchstart' in window)) toggleModifier(e);
    });
  });

  function releaseActiveModifiers() {
    if (state.activeModifiers.size === 0) return;

    state.activeModifiers.forEach(mod => {
      send({ type: 'key_up', key: mod });
      const btn = document.getElementById(`key${mod.charAt(0).toUpperCase() + mod.slice(1)}`);
      if (btn) btn.classList.remove('active-latch');
    });

    state.activeModifiers.clear();
  }

  // ==========================================================================
  // TOP BAR CONTROLS (Fullscreen, Keyboard Toggle, Settings, QR)
  // ==========================================================================

  // Toggle Keyboard visibility
  els.btnToggleKb.addEventListener('click', () => {
    state.isKeyboardHidden = !state.isKeyboardHidden;
    document.body.classList.toggle('keyboard-hidden', state.isKeyboardHidden);
    els.btnToggleKb.classList.toggle('active', state.isKeyboardHidden);
    vibrate(20);
  });

  // Toggle Fullscreen
  els.btnFullscreen.addEventListener('click', () => {
    vibrate(20);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  });

  // QR Code Modals
  els.btnShowQr.addEventListener('click', () => {
    vibrate(20);
    els.qrModal.classList.add('open');
  });

  els.btnCloseQrModal.addEventListener('click', () => {
    els.qrModal.classList.remove('open');
  });

  // Settings Modal
  els.btnSettings.addEventListener('click', () => {
    vibrate(20);
    els.settingsModal.classList.add('open');
  });

  els.btnCloseSettingsModal.addEventListener('click', () => {
    els.settingsModal.classList.remove('open');
  });

  // Close modals on clicking background
  window.addEventListener('click', (e) => {
    if (e.target === els.qrModal) els.qrModal.classList.remove('open');
    if (e.target === els.settingsModal) els.settingsModal.classList.remove('open');
  });

  // Settings adjustments
  els.rangeSensitivity.value = state.sensitivity;
  els.valSensitivity.textContent = `${state.sensitivity.toFixed(1)}x`;
  els.rangeSensitivity.addEventListener('input', (e) => {
    state.sensitivity = parseFloat(e.target.value);
    els.valSensitivity.textContent = `${state.sensitivity.toFixed(1)}x`;
    localStorage.setItem('airmouse_sens', state.sensitivity);
  });

  els.rangeScroll.value = state.scrollSpeed;
  els.valScroll.textContent = `${state.scrollSpeed.toFixed(1)}x`;
  els.rangeScroll.addEventListener('input', (e) => {
    state.scrollSpeed = parseFloat(e.target.value);
    els.valScroll.textContent = `${state.scrollSpeed.toFixed(1)}x`;
    localStorage.setItem('airmouse_scroll', state.scrollSpeed);
  });

  els.checkInvertScroll.checked = state.invertScroll;
  els.checkInvertScroll.addEventListener('change', (e) => {
    state.invertScroll = e.target.checked;
    localStorage.setItem('airmouse_invert', state.invertScroll);
  });

  els.checkHaptics.checked = state.haptics;
  els.checkHaptics.addEventListener('change', (e) => {
    state.haptics = e.target.checked;
    localStorage.setItem('airmouse_haptics', state.haptics);
  });

  els.checkAcceleration.checked = state.acceleration;
  els.checkAcceleration.addEventListener('change', (e) => {
    state.acceleration = e.target.checked;
    localStorage.setItem('airmouse_accel', state.acceleration);
  });

  // Desktop Banner Controls
  els.btnCloseDesktopBanner.addEventListener('click', () => {
    els.desktopBanner.style.display = 'none';
  });

  els.btnCopyUrl.addEventListener('click', () => {
    const url = els.bannerServerUrl.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        els.btnCopyUrl.textContent = 'Copied!';
        setTimeout(() => { els.btnCopyUrl.textContent = 'Copy'; }, 2000);
      });
    }
  });

  // Fetch Server Info & QR Code
  async function fetchServerInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const info = await res.json();
        els.bannerQrImg.src = info.qrCode;
        els.bannerServerUrl.textContent = info.url;
        els.modalQrImg.src = info.qrCode;
        els.modalServerUrl.textContent = info.url;
      }
    } catch (e) {
      console.warn('Could not fetch server info:', e);
    }
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  connectWebSocket();
  fetchServerInfo();

})();
