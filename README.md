# Wireless Mobile Keyboard & Mouse (AirMouse) 📱🖱️⌨️

A fast, lightweight, and modern Single Page Web Application that turns your mobile smartphone into a wireless trackpad, mouse, and keyboard for your computer over local Wi-Fi.

---

## ✨ Features (PRD Specifications)

### 🖱️ Top Section: Mouse Pad (Touchpad)
- **Fluid Mouse Movement**: Smooth cursor movement with velocity acceleration curve.
- **Single Tap**: Left Click.
- **Double Tap**: Double Click.
- **Two-Finger Tap**: Right Click.
- **Two-Finger Swipe**: Smooth Vertical Scrolling (Up & Down).
- **Physical Touch Buttons**: Dedicated **Left Click** (supports click-and-drag), **Middle Click**, and **Right Click**.
- **Visual & Haptic Feedback**: Subtle ripple animation on touch and vibration on clicks.

### ⌨️ Bottom Section: Keyboard Controls
- **Mobile Native Keyboard Typing**: Tap the input bar to bring up your phone's native virtual keyboard (supports all languages, voice typing, and emojis).
- **Computer Essential Keys**:
  - `Esc`, `Tab`, `Ctrl`, `Alt`, `Shift`, `Windows Key`
  - `Enter`, `Backspace`, `Space`, `Delete`
  - **Arrow Keys**: `⬆️`, `⬇️`, `⬅️`, `➡️`
  - **Quick Shortcuts**: `Undo (Ctrl+Z)`, `Copy (Ctrl+C)`, `Paste (Ctrl+V)`, `Select All (Ctrl+A)`
  - **System & Media**: `Win+D (Desktop)`, `Alt+Tab`, `Mute`, `Vol -`, `Vol +`, `Play/Pause`
- **Latch Mode for Modifiers**: Tap `Ctrl`, `Alt`, or `Shift` to latch them active with visual glow, press any key, and they auto-release.
- **Keyboard Show/Hide Toggle**: Tap the keyboard icon in the header to expand the Touchpad to 100% fullscreen!

### ⚡ Connection & System
- **Real-Time WebSocket**: Sub-millisecond latency.
- **Automatic Wi-Fi Detection**: Server detects your computer's local IP address automatically.
- **QR Code Scanner**: Server prints an ASCII QR code in the terminal and provides a high-resolution QR code on the desktop interface.
- **Zero Configuration**: No database, no accounts, no login or signup needed.

---

## 🚀 How to Run

### Step 1: Start the Computer Server
Open PowerShell or Terminal in this folder and run:
```bash
npm start
```
*(Or simply double-click `start.bat` on Windows!)*

### Step 2: Connect Phone & Computer
1. Make sure your **Mobile Phone** and **Computer** are connected to the **same Wi-Fi network**.
2. Scan the **QR Code** displayed in your computer terminal or on the screen with your phone camera.
3. Or open the shown link in your mobile browser (e.g. `http://192.168.x.x:3000`).

### Step 3: Control Your PC
Once connected, the status badge turns **🟢 Connected**. You can now smoothly control your mouse pointer, click, scroll, and type!

---

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3 (Mobile-First Dark Premium UI), Vanilla JavaScript (No heavy frameworks).
- **Backend**: Node.js, Express, WebSocket (`ws`).
- **Windows Automation**: Direct Win32 `user32.dll` API via `koffi` (ultra-fast in-process execution with zero lag).
- **QR Code**: `qrcode` library.
