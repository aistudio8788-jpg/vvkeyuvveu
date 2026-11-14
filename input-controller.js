const koffi = require('koffi');

// Load user32.dll
const user32 = koffi.load('user32.dll');

// Bind functions
const mouse_event = user32.func('void __stdcall mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr_t dwExtraInfo)');
const keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');

// Mouse flags
const MOUSEEVENTF_MOVE = 0x0001;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
const MOUSEEVENTF_MIDDLEUP = 0x0040;
const MOUSEEVENTF_WHEEL = 0x0800;

// Keyboard flags
const KEYEVENTF_KEYDOWN = 0x0000;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;

// Virtual key mapping
const VK_MAP = {
  'backspace': 0x08,
  'tab': 0x09,
  'enter': 0x0D,
  'return': 0x0D,
  'shift': 0x10,
  'ctrl': 0x11,
  'control': 0x11,
  'alt': 0x12,
  'escape': 0x1B,
  'esc': 0x1B,
  'space': 0x20,
  'pageup': 0x21,
  'pagedown': 0x22,
  'end': 0x23,
  'home': 0x24,
  'left': 0x25,
  'arrowleft': 0x25,
  'up': 0x26,
  'arrowup': 0x26,
  'right': 0x27,
  'arrowright': 0x27,
  'down': 0x28,
  'arrowdown': 0x28,
  'delete': 0x2E,
  'del': 0x2E,
  'win': 0x5B,
  'meta': 0x5B,
  'f1': 0x70,
  'f2': 0x71,
  'f3': 0x72,
  'f4': 0x73,
  'f5': 0x74,
  'f6': 0x75,
  'f7': 0x76,
  'f8': 0x77,
  'f9': 0x78,
  'f10': 0x79,
  'f11': 0x7A,
  'f12': 0x7B,
  'volume_mute': 0xAD,
  'volume_down': 0xAE,
  'volume_up': 0xAF,
  'media_next': 0xB0,
  'media_prev': 0xB1,
  'media_play_pause': 0xB3
};

// Track active held modifier keys
const activeModifiers = new Set();

const controller = {
  moveMouse(dx, dy) {
    const rx = Math.round(dx);
    const ry = Math.round(dy);
    if (rx !== 0 || ry !== 0) {
      mouse_event(MOUSEEVENTF_MOVE, rx, ry, 0, 0);
    }
  },

  scroll(amount) {
    const rAmount = Math.round(amount);
    if (rAmount !== 0) {
      mouse_event(MOUSEEVENTF_WHEEL, 0, 0, rAmount, 0);
    }
  },

  mouseDown(button = 'left') {
    if (button === 'left') {
      mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
    } else if (button === 'right') {
      mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
    } else if (button === 'middle') {
      mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0);
    }
  },

  mouseUp(button = 'left') {
    if (button === 'left') {
      mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
    } else if (button === 'right') {
      mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
    } else if (button === 'middle') {
      mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0);
    }
  },

  mouseClick(button = 'left') {
    this.mouseDown(button);
    this.mouseUp(button);
  },

  mouseDblClick(button = 'left') {
    this.mouseClick(button);
    this.mouseClick(button);
  },

  keyDown(key) {
    const lower = key.toLowerCase();
    const vk = VK_MAP[lower];
    if (vk) {
      keybd_event(vk, 0, KEYEVENTF_KEYDOWN, 0);
      activeModifiers.add(vk);
    }
  },

  keyUp(key) {
    const lower = key.toLowerCase();
    const vk = VK_MAP[lower];
    if (vk) {
      keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
      activeModifiers.delete(vk);
    }
  },

  keyTap(key) {
    const lower = key.toLowerCase();
    const vk = VK_MAP[lower];
    if (vk) {
      keybd_event(vk, 0, KEYEVENTF_KEYDOWN, 0);
      keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    } else if (key.length === 1) {
      // Single character
      this.typeText(key);
    }
  },

  typeText(text) {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      keybd_event(0, code, KEYEVENTF_UNICODE, 0);
      keybd_event(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0);
    }
  },

  shortcut(combo) {
    // combo e.g. "ctrl+c", "ctrl+alt+delete", "win+d", "alt+tab"
    const parts = combo.toLowerCase().split('+').map(s => s.trim());
    const keysToPress = [];

    for (const part of parts) {
      const vk = VK_MAP[part] || (part.length === 1 ? part.toUpperCase().charCodeAt(0) : null);
      if (vk) keysToPress.push(vk);
    }

    if (keysToPress.length === 0) return;

    // Press down in order
    for (const vk of keysToPress) {
      keybd_event(vk, 0, KEYEVENTF_KEYDOWN, 0);
    }

    // Release in reverse order
    for (let i = keysToPress.length - 1; i >= 0; i--) {
      keybd_event(keysToPress[i], 0, KEYEVENTF_KEYUP, 0);
    }
  },

  releaseAllModifiers() {
    for (const vk of activeModifiers) {
      try {
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
      } catch (e) {}
    }
    activeModifiers.clear();
  }
};

module.exports = controller;
