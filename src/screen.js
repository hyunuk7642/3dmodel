// 폰 화면 안에서 돌아가는 작은 "운영체제". 2D 캔버스에 그리고, 3D 쪽에서 텍스처로 쓴다.
export const W = 540;
export const H = 1170;

const FONT = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",system-ui,sans-serif';
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DARK = 'rgba(0,0,0,.3)';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const approach = (v, target, dt, rate) => v + (target - v) * (1 - Math.exp(-dt * rate));
const pad = (n) => String(n).padStart(2, '0');

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}

// 아이콘 그림: 원점 중심, 대략 -50..50 범위에 흰색으로 그린다.
const GLYPHS = {
  phone(g) {
    g.rotate(-Math.PI / 4);
    rr(g, -9, -32, 18, 64, 9); g.fill();
    rr(g, -9, -36, 28, 22, 9); g.fill();
    rr(g, -9, 14, 28, 22, 9); g.fill();
  },
  msg(g) {
    rr(g, -34, -28, 68, 50, 18); g.fill();
    g.beginPath(); g.moveTo(-20, 16); g.lineTo(-26, 36); g.lineTo(0, 20); g.fill();
  },
  web(g) {
    g.lineWidth = 6;
    circle(g, 0, 0, 30); g.stroke();
    g.beginPath(); g.ellipse(0, 0, 13, 30, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(-30, 0); g.lineTo(30, 0); g.stroke();
  },
  camera(g) {
    rr(g, -36, -22, 72, 50, 12); g.fill();
    rr(g, -14, -32, 28, 16, 5); g.fill();
    g.fillStyle = DARK; circle(g, 0, 3, 15); g.fill();
  },
  clock(g) {
    circle(g, 0, 0, 32); g.fill();
    g.strokeStyle = DARK; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 0); g.lineTo(13, 8); g.stroke();
  },
  cal(g) {
    rr(g, -32, -30, 64, 62, 12); g.fill();
    g.fillStyle = DARK; g.fillRect(-32, -18, 64, 6);
    g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(new Date().getDate()), 0, 12);
  },
  photo(g) {
    circle(g, 16, -16, 10); g.fill();
    g.beginPath(); g.moveTo(-36, 28); g.lineTo(-10, -10); g.lineTo(8, 14); g.lineTo(18, 2); g.lineTo(36, 28); g.fill();
  },
  weather(g) {
    circle(g, 12, -12, 16); g.fill();
    g.globalAlpha = 0.92;
    circle(g, -14, 12, 15); g.fill(); circle(g, 4, 6, 19); g.fill(); circle(g, 22, 14, 13); g.fill();
    g.fillRect(-14, 12, 36, 15);
  },
  map(g) {
    circle(g, 0, -10, 22); g.fill();
    g.beginPath(); g.moveTo(-18, 2); g.lineTo(0, 36); g.lineTo(18, 2); g.fill();
    g.fillStyle = DARK; circle(g, 0, -10, 9); g.fill();
  },
  mail(g) {
    rr(g, -36, -24, 72, 50, 9); g.fill();
    g.strokeStyle = DARK; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-30, -18); g.lineTo(0, 6); g.lineTo(30, -18); g.stroke();
  },
  music(g) {
    circle(g, -16, 22, 11); g.fill(); circle(g, 20, 14, 11); g.fill();
    g.lineWidth = 7; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-8.5, 22); g.lineTo(-8.5, -22); g.lineTo(27.5, -30); g.lineTo(27.5, 14); g.stroke();
  },
  settings(g) {
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); rr(g, -7, -36, 14, 18, 4); g.fill(); }
    circle(g, 0, 0, 25); g.fill();
    g.fillStyle = DARK; circle(g, 0, 0, 10); g.fill();
  },
  game(g) {
    rr(g, -38, -20, 76, 42, 20); g.fill();
    g.fillStyle = DARK;
    g.fillRect(-25, -3, 20, 7); g.fillRect(-18.5, -10, 7, 21);
    circle(g, 14, 5, 5); g.fill(); circle(g, 25, -5, 5); g.fill();
  },
  calc(g) {
    rr(g, -28, -34, 56, 68, 10); g.fill();
    g.fillStyle = DARK; rr(g, -19, -25, 38, 16, 4); g.fill();
    for (let i = 0; i < 6; i++) { rr(g, -19 + (i % 3) * 14, 0 + Math.floor(i / 3) * 14, 10, 10, 3); g.fill(); }
  },
  note(g) {
    rr(g, -28, -34, 56, 68, 8); g.fill();
    g.fillStyle = DARK;
    for (let i = 0; i < 4; i++) g.fillRect(-18, -20 + i * 13, i === 3 ? 22 : 36, 5);
  },
  torch(g) {
    g.beginPath(); g.moveTo(-22, -34); g.lineTo(22, -34); g.lineTo(12, -8); g.lineTo(-12, -8); g.fill();
    rr(g, -12, -4, 24, 40, 6); g.fill();
    g.fillStyle = DARK; circle(g, 0, 10, 5); g.fill();
  },
};

const APPS = {
  phone: { name: '전화', c: ['#5ee27a', '#12a84a'] },
  msg: { name: '메시지', c: ['#6fe38a', '#16b35c'] },
  web: { name: '인터넷', c: ['#6ab7ff', '#2b6df0'] },
  camera: { name: '카메라', c: ['#8a93a6', '#4b5263'] },
  clock: { name: '시계', c: ['#3b3f4d', '#16181f'] },
  cal: { name: '캘린더', c: ['#ff7b6b', '#e2412f'] },
  photo: { name: '사진', c: ['#ffc65a', '#f2793a'] },
  weather: { name: '날씨', c: ['#62c4ff', '#2f7fe8'] },
  map: { name: '지도', c: ['#63d6a6', '#1f9d8b'] },
  mail: { name: '메일', c: ['#72aaff', '#3f5fe6'] },
  music: { name: '음악', c: ['#ff7aa8', '#e23a6c'] },
  settings: { name: '설정', c: ['#aab2c2', '#687083'] },
  game: { name: '게임', c: ['#b08cff', '#6a44e0'] },
  calc: { name: '계산기', c: ['#ffab52', '#ef7a1a'] },
  note: { name: '메모', c: ['#ffd95e', '#f0a81c'] },
  torch: { name: '손전등', c: ['#58607a', '#262b3d'] },
};
const PAGES = [
  ['clock', 'cal', 'photo', 'weather', 'map', 'mail', 'music', 'settings'],
  ['game', 'calc', 'note', 'torch'],
  [],
];
const DOCK = ['phone', 'msg', 'web', 'camera'];
const GRID_TOP = [430, 130, 0];
const ICON = 104;
const DOCK_Y = H - 128;
const MAX_SCROLL = (PAGES.length - 1) * W;

const iconPos = (i, top) => ({ cx: 67.5 + (i % 4) * 135, cy: top + Math.floor(i / 4) * 172 + ICON / 2 });

function makeWallpaper() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2a1b5e'); bg.addColorStop(0.5, '#59308f'); bg.addColorStop(1, '#f0786a');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const blobs = [[90, 250, 330, 'rgba(90,150,255,.55)'], [470, 520, 380, 'rgba(255,120,190,.45)'], [160, 980, 420, 'rgba(255,190,100,.5)']];
  for (const [x, y, r, col] of blobs) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  return c;
}

export function createPhoneOS(hooks = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const wallpaper = makeWallpaper();

  const os = { canvas, power: 'off', asleep: false, locked: true, view: 'home', glow: 0, torch: false };
  let phaseT = 0;      // 부팅/종료 애니메이션 경과 시간
  let fade = 0;        // 화면 밝기 (잠자기/깨우기)
  let lockY = 0, lockTarget = 0;
  let scrollX = 0, scrollTarget = 0;
  let app = null;      // { id, p, closing, from:{cx,cy} }
  let touch = null;
  let clock = 0;
  let blackDrawn = false;

  const setTorch = (on) => { if (os.torch !== on) { os.torch = on; hooks.torch?.(on); } };

  os.interactive = () => os.power === 'on' && !os.asleep;

  os.powerLong = () => {
    if (os.power === 'off') {
      os.power = 'boot'; phaseT = 0;
      return 'boot';
    }
    if (os.power === 'on') {
      os.power = 'shutdown'; phaseT = 0; touch = null;
      setTorch(false);
      return 'shutdown';
    }
    return null;
  };

  os.powerShort = () => {
    if (os.power === 'off') return 'nope';
    if (os.power !== 'on') return null;
    os.asleep = !os.asleep;
    touch = null;
    if (!os.asleep) { os.locked = true; lockY = 0; lockTarget = 0; }
    return os.asleep ? 'sleep' : 'wake';
  };

  // ---------- 터치 ----------
  os.pointerDown = (x, y) => {
    if (!os.interactive()) return;
    touch = { x0: x, y0: y, x, y, vx: 0, vy: 0, lt: performance.now(), mode: os.locked ? 'lock' : null, startScroll: scrollX };
  };

  os.pointerMove = (x, y) => {
    if (!touch) return;
    const now = performance.now();
    const dt = Math.max(1, now - touch.lt) / 1000;
    touch.vx = touch.vx * 0.5 + ((x - touch.x) / dt) * 0.5;
    touch.vy = touch.vy * 0.5 + ((y - touch.y) / dt) * 0.5;
    touch.x = x; touch.y = y; touch.lt = now;
    const dx = x - touch.x0, dy = y - touch.y0;
    if (!touch.mode && Math.hypot(dx, dy) > 14) touch.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (touch.mode === 'lock') {
      lockY = clamp(-dy, 0, H); lockTarget = lockY;
    } else if (touch.mode === 'h' && os.view === 'home') {
      let s = touch.startScroll - dx;
      if (s < 0) s *= 0.4;
      if (s > MAX_SCROLL) s = MAX_SCROLL + (s - MAX_SCROLL) * 0.4;
      scrollX = s; scrollTarget = s;
    }
  };

  os.pointerUp = () => {
    if (!touch) return;
    const tc = touch; touch = null;
    const dy = tc.y - tc.y0;
    if (tc.mode === 'lock') {
      const open = lockY > 240 || (tc.vy < -900 && lockY > 40);
      lockTarget = open ? H : 0;
      if (open) hooks.sound?.('unlock');
    } else if (!tc.mode) {
      tap(tc.x, tc.y);
    } else if (os.view === 'home' && tc.mode === 'h') {
      const startPage = Math.round(tc.startScroll / W);
      let page = Math.round((scrollX - tc.vx * 0.18) / W);
      page = clamp(page, startPage - 1, startPage + 1);
      scrollTarget = clamp(page, 0, PAGES.length - 1) * W;
    } else if (os.view === 'app' && tc.mode === 'v' && tc.y0 > H - 160 && dy < -70) {
      closeApp();
    }
  };

  function openApp(id, from) {
    app = { id, p: 0, closing: false, from };
    os.view = 'app';
    hooks.sound?.('tap');
  }
  function closeApp() {
    if (app && !app.closing) { app.closing = true; hooks.sound?.('tap'); }
  }

  function tap(x, y) {
    if (os.view === 'app') {
      if (y > H - 80) closeApp();
      else if (app.id === 'torch' && Math.hypot(x - W / 2, y - 560) < 140) { setTorch(!os.torch); hooks.sound?.('tap'); }
      return;
    }
    const hit = (p) => Math.abs(x - p.cx) < 62 && Math.abs(y - p.cy - 10) < 72;
    for (let i = 0; i < DOCK.length; i++) {
      const p = iconPos(i, DOCK_Y - ICON / 2);
      if (hit(p)) return openApp(DOCK[i], p);
    }
    const page = clamp(Math.round(scrollX / W), 0, PAGES.length - 1);
    for (let i = 0; i < PAGES[page].length; i++) {
      const p = iconPos(i, GRID_TOP[page]);
      if (hit(p)) return openApp(PAGES[page][i], p);
    }
  }

  // ---------- 그리기 ----------
  function text(str, x, y, size, weight = 500, align = 'center', color = '#fff') {
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = align; g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  function drawIcon(id, cx, cy, size, label) {
    const a = APPS[id];
    const grad = g.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    grad.addColorStop(0, a.c[0]); grad.addColorStop(1, a.c[1]);
    g.fillStyle = grad;
    rr(g, cx - size / 2, cy - size / 2, size, size, size * 0.24); g.fill();
    g.save();
    g.translate(cx, cy); g.scale(size / 104, size / 104);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    GLYPHS[id](g);
    g.restore();
    if (label) text(a.name, cx, cy + size / 2 + 24, 23, 500);
  }

  function card(x, y, w, h) {
    g.fillStyle = 'rgba(255,255,255,.16)';
    rr(g, x, y, w, h, 36); g.fill();
  }

  function drawStatus(now) {
    text(`${pad(now.getHours())}:${pad(now.getMinutes())}`, 48, 42, 25, 700, 'left');
    g.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) g.fillRect(W - 152 + i * 9, 50 - i * 5, 6, 6 + i * 5);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5;
    rr(g, W - 98, 30, 48, 24, 7); g.stroke();
    rr(g, W - 94, 34, 33, 16, 4); g.fill();
    g.fillRect(W - 47, 37, 4, 10);
  }

  function drawHomeBar(alpha = 0.85) {
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    rr(g, W / 2 - 80, H - 26, 160, 8, 4); g.fill();
  }

  function drawPage(i, ox, now) {
    if (ox < -W || ox > W) return;
    g.save();
    g.translate(ox, 0);
    if (i === 0) {
      card(34, 110, W - 68, 270);
      text(`${pad(now.getHours())}:${pad(now.getMinutes())}`, 70, 215, 104, 300, 'left');
      text(`${now.getMonth() + 1}월 ${now.getDate()}일 ${DAYS[now.getDay()]}요일`, 74, 320, 29, 500, 'left', 'rgba(255,255,255,.85)');
      text(pad(now.getSeconds()), W - 70, 320, 29, 600, 'right', 'rgba(255,255,255,.6)');
    } else if (i === 1) {
      card(34, 350, W - 68, 250);
      text('오늘의 한마디', 70, 405, 25, 600, 'left', 'rgba(255,255,255,.7)');
      text('천천히 가도 괜찮아요.', 70, 470, 36, 700, 'left');
      text('멈추지만 않으면 됩니다.', 70, 522, 36, 700, 'left');
    } else {
      g.save();
      rr(g, 34, 110, W - 68, 520, 36); g.clip();
      const sky = g.createLinearGradient(0, 110, 0, 630);
      sky.addColorStop(0, '#ffb36b'); sky.addColorStop(0.6, '#ff7a85'); sky.addColorStop(1, '#5a3d9a');
      g.fillStyle = sky; g.fillRect(34, 110, W - 68, 520);
      g.fillStyle = '#fff3c4'; circle(g, 370, 330, 62); g.fill();
      g.fillStyle = '#4a2f80';
      g.beginPath(); g.moveTo(34, 630); g.lineTo(34, 480); g.lineTo(170, 360); g.lineTo(290, 500); g.lineTo(380, 420); g.lineTo(506, 540); g.lineTo(506, 630); g.fill();
      g.fillStyle = '#2f1d5c';
      g.beginPath(); g.moveTo(34, 630); g.lineTo(34, 560); g.lineTo(150, 500); g.lineTo(300, 580); g.lineTo(420, 520); g.lineTo(506, 590); g.lineTo(506, 630); g.fill();
      g.restore();
      text('옆으로 밀어서 돌아가기', W / 2, 690, 26, 500, 'center', 'rgba(255,255,255,.8)');
    }
    PAGES[i].forEach((id, k) => {
      const p = iconPos(k, GRID_TOP[i]);
      drawIcon(id, p.cx, p.cy, ICON, true);
    });
    g.restore();
  }

  function drawHome(now) {
    g.drawImage(wallpaper, 0, 0);
    g.fillStyle = 'rgba(10,8,30,.18)'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < PAGES.length; i++) drawPage(i, i * W - scrollX, now);
    const page = clamp(scrollX / W, 0, PAGES.length - 1);
    for (let i = 0; i < PAGES.length; i++) {
      g.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * clamp(1 - Math.abs(page - i), 0, 1)})`;
      circle(g, W / 2 + (i - 1) * 26, H - 238, 6); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.2)';
    rr(g, 22, DOCK_Y - 76, W - 44, 152, 48); g.fill();
    DOCK.forEach((id, k) => {
      const p = iconPos(k, DOCK_Y - ICON / 2);
      drawIcon(id, p.cx, p.cy, ICON, false);
    });
    drawStatus(now);
    drawHomeBar(0.6);
  }

  function drawApp(now) {
    const a = APPS[app.id];
    const p = ease(app.p);
    const x = (app.from.cx - ICON / 2) * (1 - p), y = (app.from.cy - ICON / 2) * (1 - p);
    const w = ICON + (W - ICON) * p, h = ICON + (H - ICON) * p;
    g.save();
    g.globalAlpha = clamp(app.p * 4, 0, 1);
    rr(g, x, y, w, h, 26 + 30 * (1 - p)); g.clip();
    g.translate(x, y); g.scale(w / W, h / H);
    const lit = app.id === 'torch' && os.torch;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, lit ? '#fff6c9' : a.c[0]); grad.addColorStop(1, lit ? '#ffc94a' : a.c[1]);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    const ink = lit ? '#3a2a00' : '#fff';
    text(a.name, W / 2, 150, 46, 800, 'center', ink);

    if (app.id === 'torch') {
      g.fillStyle = lit ? '#fff' : 'rgba(255,255,255,.14)';
      circle(g, W / 2, 560, 130); g.fill();
      g.strokeStyle = lit ? '#f0a400' : '#fff'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.arc(W / 2, 566, 48, -Math.PI * 0.3, Math.PI * 1.3); g.stroke();
      g.beginPath(); g.moveTo(W / 2, 498); g.lineTo(W / 2, 556); g.stroke();
      text(lit ? '켜짐 · 뒷면에서 빛이 나요' : '눌러서 켜기', W / 2, 760, 30, 600, 'center', ink);
    } else if (app.id === 'clock') {
      text(`${pad(now.getHours())}:${pad(now.getMinutes())}`, W / 2, 500, 150, 200);
      text(pad(now.getSeconds()), W / 2, 630, 60, 300, 'center', 'rgba(255,255,255,.6)');
    } else if (app.id === 'cal') {
      text(`${now.getMonth() + 1}월`, W / 2, 400, 56, 600);
      text(String(now.getDate()), W / 2, 560, 220, 800);
      text(`${DAYS[now.getDay()]}요일`, W / 2, 720, 44, 600);
    } else {
      g.save();
      g.translate(W / 2, 540); g.scale(3.2, 3.2);
      g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.globalAlpha *= 0.95;
      GLYPHS[app.id](g);
      g.restore();
    }
    text('아래 막대를 위로 밀면 홈으로', W / 2, H - 80, 24, 500, 'center', lit ? 'rgba(58,42,0,.6)' : 'rgba(255,255,255,.65)');
    g.fillStyle = lit ? 'rgba(58,42,0,.7)' : 'rgba(255,255,255,.9)';
    rr(g, W / 2 - 80, H - 26, 160, 8, 4); g.fill();
    g.restore();
  }

  function drawLock(now) {
    const k = lockY / H;
    g.save();
    g.globalAlpha = clamp(1 - k * 1.3, 0, 1);
    g.translate(0, -lockY);
    g.drawImage(wallpaper, 0, 0);
    g.fillStyle = 'rgba(8,6,24,.3)'; g.fillRect(0, 0, W, H);
    text(`${now.getMonth() + 1}월 ${now.getDate()}일 ${DAYS[now.getDay()]}요일`, W / 2, 190, 32, 600);
    text(`${pad(now.getHours())}:${pad(now.getMinutes())}`, W / 2, 310, 150, 300);
    const bob = Math.sin(clock * 2.6) * 6;
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(W / 2 - 18, H - 150 + bob); g.lineTo(W / 2, H - 168 + bob); g.lineTo(W / 2 + 18, H - 150 + bob); g.stroke();
    text('위로 밀어서 잠금 해제', W / 2, H - 100, 27, 500, 'center', 'rgba(255,255,255,.85)');
    drawStatus(now);
    drawHomeBar();
    g.restore();
  }

  function drawBoot() {
    const t = phaseT, cx = W / 2, cy = H / 2 - 40;
    const grad = g.createLinearGradient(cx - 70, cy - 70, cx + 70, cy + 70);
    grad.addColorStop(0, '#7db6ff'); grad.addColorStop(1, '#ff8fb8');
    g.globalAlpha = clamp(t / 0.4, 0, 1);
    g.strokeStyle = grad; g.lineWidth = 14; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease(t / 1.3)); g.stroke();
    g.fillStyle = grad; circle(g, cx, cy, 16 + Math.sin(t * 5) * 2); g.fill();
    g.globalAlpha = clamp((t - 1.1) / 0.5, 0, 1);
    text('안녕하세요', cx, cy + 140, 38, 600);
    g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, cx - 110, H - 220, 220, 6, 3); g.fill();
    g.fillStyle = '#fff'; rr(g, cx - 110, H - 220, 220 * clamp((t - 0.6) / 1.9, 0, 1), 6, 3); g.fill();
    g.globalAlpha = 1;
  }

  function drawShutdown() {
    const t = phaseT, cx = W / 2, cy = H / 2 - 20;
    g.globalAlpha = clamp((1.5 - t) / 0.4, 0, 1);
    g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, 40, t * 7, t * 7 + Math.PI * 1.4); g.stroke();
    text('전원 끄는 중…', cx, cy + 110, 30, 500);
    g.globalAlpha = 1;
  }

  function draw() {
    const now = new Date();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (os.power === 'boot') return drawBoot();
    if (os.power === 'shutdown') return drawShutdown();
    if (os.power !== 'on' || fade <= 0.001) return;

    if (!os.locked || lockY > 0) {
      const s = os.locked ? 0.9 + 0.1 * (lockY / H) : 1;
      g.save();
      g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-W / 2, -H / 2);
      drawHome(now);
      if (app) drawApp(now);
      g.restore();
    }
    if (os.locked) drawLock(now);
    if (fade < 1) { g.fillStyle = `rgba(0,0,0,${1 - fade})`; g.fillRect(0, 0, W, H); }
  }

  // 매 프레임 호출. 캔버스를 다시 그렸으면 true.
  os.update = (dt) => {
    clock += dt;
    if (os.power === 'boot') {
      phaseT += dt;
      os.glow = Math.min(1, phaseT) * 0.45;
      if (phaseT > 2.7) {
        os.power = 'on'; os.asleep = false; os.locked = true;
        os.view = 'home'; app = null; lockY = lockTarget = 0; scrollX = scrollTarget = 0; fade = 1;
      }
    } else if (os.power === 'shutdown') {
      phaseT += dt;
      os.glow = 0.3 * clamp(1 - phaseT / 1.5, 0, 1);
      if (phaseT > 1.5) { os.power = 'off'; fade = 0; }
    } else if (os.power === 'on') {
      const target = os.asleep ? 0 : 1;
      fade = clamp(fade + Math.sign(target - fade) * dt * 6, 0, 1);
      os.glow = fade;
      if (!touch || touch.mode !== 'lock') {
        lockY = approach(lockY, lockTarget, dt, 16);
        if (lockTarget === H && lockY > H - 6) { os.locked = false; lockY = lockTarget = 0; }
        else if (lockTarget === 0 && lockY < 0.5) lockY = 0;
      }
      if (!touch || touch.mode !== 'h') scrollX = approach(scrollX, scrollTarget, dt, 14);
      if (app) {
        app.p = clamp(app.p + (app.closing ? -dt : dt) / 0.3, 0, 1);
        if (app.closing && app.p <= 0) { app = null; os.view = 'home'; }
      }
    } else {
      os.glow = 0;
    }

    const lit = os.power === 'boot' || os.power === 'shutdown' || (os.power === 'on' && fade > 0);
    if (!lit && blackDrawn) return false;
    draw();
    blackDrawn = !lit;
    return true;
  };

  draw();
  return os;
}
