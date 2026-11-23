import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import * as CANNON from '../vendor/cannon-es.js';
import { createPhoneOS, W as SCREEN_W, H as SCREEN_H } from './screen.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const hintEl = $('hint');
const ringEl = $('ring');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 치수 ----------
const PW = 1.5, PH = 3.1, PD = 0.16, RADIUS = 0.24;   // 폰 크기
const BEVEL = 0.03;
const SW = PW - 0.13, SH = PH - 0.13;                  // 화면 크기
const HOME_Y = 2.6;                                    // 손에 들고 있을 때 높이
const FOV = 40;
const HOLD_SEC = 0.9;                                  // 전원 길게 누르기 시간
const BACK_Z = -4.5;

// ---------- 소리 ----------
let soundOn = true;
let ac = null;
function audio() {
  if (!soundOn) return null;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  } catch { return null; }
}
function tone(freq, dur, { type = 'sine', vol = 0.12, at = 0, to = freq } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), gn = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const sounds = {
  click: () => tone(1400, 0.04, { type: 'square', vol: 0.04 }),
  tap: () => tone(880, 0.05, { vol: 0.05 }),
  unlock: () => tone(660, 0.12, { vol: 0.07, to: 990 }),
  boot: () => { tone(523, 0.5, { vol: 0.09, at: 1.6 }); tone(659, 0.5, { vol: 0.09, at: 1.78 }); tone(784, 0.8, { vol: 0.1, at: 1.96 }); },
  off: () => { tone(660, 0.3, { vol: 0.08 }); tone(440, 0.5, { vol: 0.08, at: 0.2 }); },
  nope: () => tone(180, 0.09, { type: 'triangle', vol: 0.08 }),
  whoosh: () => tone(240, 0.22, { type: 'triangle', vol: 0.05, to: 90 }),
  thud: (v) => { tone(120, 0.16, { vol: 0.35 * v, to: 45 }); tone(900, 0.04, { type: 'square', vol: 0.05 * v, to: 300 }); },
};
const play = (name, arg) => sounds[name]?.(arg);
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* 지원 안 하는 기기 */ } };

// ---------- 폰 OS ----------
const os = createPhoneOS({
  sound: play,
  torch: (on) => { torchLight.visible = on; flashMat.emissiveIntensity = on ? 6 : 0; },
});

// ---------- 장면 ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  $('fail').style.display = 'grid';
  $('bar').style.display = 'none';
  $('top').style.display = 'none';
  throw new Error('WebGL을 사용할 수 없습니다');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141826);
scene.fog = new THREE.Fog(0x141826, 14, 34);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 80);

scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x1a1c2a, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3.5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 40),
  new THREE.MeshStandardMaterial({ color: 0x2a3150, roughness: 0.85, metalness: 0 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = -6;
floor.receiveShadow = true;
scene.add(floor);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 30),
  new THREE.MeshStandardMaterial({ color: 0x1d2238, roughness: 1 }),
);
wall.position.set(0, 15, BACK_Z);
wall.receiveShadow = true;
scene.add(wall);

// ---------- 폰 모델 ----------
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
  s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2);
  s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

const phone = new THREE.Group();
scene.add(phone);

const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 1, roughness: 0.28 });
const backMat = new THREE.MeshStandardMaterial({ color: 0x5b7fd6, metalness: 0.25, roughness: 0.32 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x05060a, metalness: 0.2, roughness: 0.25 });

const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(PW - 2 * BEVEL, PH - 2 * BEVEL, RADIUS - BEVEL), {
  depth: PD - 2 * BEVEL, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 4, curveSegments: 16,
});
bodyGeo.translate(0, 0, -(PD - 2 * BEVEL) / 2);
const body = new THREE.Mesh(bodyGeo, [backMat, frameMat]);   // [앞뒤 면, 옆면]
body.castShadow = true;
phone.add(body);

const bezel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(PW - 2 * BEVEL, PH - 2 * BEVEL, RADIUS - BEVEL), 16), blackMat);
bezel.position.z = PD / 2 + 0.0015;
phone.add(bezel);

const screenTex = new THREE.CanvasTexture(os.canvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.generateMipmaps = false;
screenTex.minFilter = THREE.LinearFilter;
screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const screenGeo = new THREE.ShapeGeometry(roundedRect(SW, SH, RADIUS - 0.06), 16);
{
  const pos = screenGeo.attributes.position, uv = screenGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / SW + 0.5, pos.getY(i) / SH + 0.5);
}
const screenMesh = new THREE.Mesh(screenGeo, new THREE.MeshStandardMaterial({
  color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, roughness: 0.06, metalness: 0,
  envMap: scene.environment, envMapIntensity: 0.1,   // 유리 반사는 은은하게만 (꺼진 화면이 까맣게 보이도록)
}));
screenMesh.position.z = PD / 2 + 0.003;
phone.add(screenMesh);

// 전원 버튼(오른쪽) + 넉넉한 터치 영역, 볼륨 버튼(왼쪽)
const btnMat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.3, emissive: 0x6fa0ff, emissiveIntensity: 0 });
const powerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.075), btnMat);
const POWER_X = PW / 2 + 0.008;
powerBtn.position.set(POWER_X, 0.55, 0);
phone.add(powerBtn);
const powerHit = new THREE.Mesh(
  new THREE.BoxGeometry(0.34, 0.8, 0.5),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
);
powerHit.position.set(PW / 2 + 0.05, 0.55, 0);
phone.add(powerHit);
for (const y of [0.78, 0.3]) {
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.075), frameMat);
  v.position.set(-POWER_X, y, 0);
  phone.add(v);
}

// 뒷면: 카메라 섬, 렌즈, 플래시, 로고
const bump = new THREE.Mesh(
  new THREE.ExtrudeGeometry(roundedRect(0.62, 0.62, 0.16), { depth: 0.03, bevelEnabled: false, curveSegments: 12 }),
  new THREE.MeshStandardMaterial({ color: 0x4a69b8, metalness: 0.3, roughness: 0.3 }),
);
bump.position.set(0.36, PH / 2 - 0.46, -PD / 2 - 0.03);
phone.add(bump);
const lensRing = new THREE.MeshStandardMaterial({ color: 0x1a1d26, metalness: 0.9, roughness: 0.25 });
const lensGlass = new THREE.MeshStandardMaterial({ color: 0x0a1230, metalness: 1, roughness: 0.05 });
for (const [lx, ly] of [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14]]) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.03, 32), lensRing);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.36 + lx, PH / 2 - 0.46 + ly, -PD / 2 - 0.042);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.034, 32), lensGlass);
  glass.rotation.x = Math.PI / 2;
  glass.position.copy(ring.position);
  phone.add(ring, glass);
}
const flashMat = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 0, roughness: 0.4 });
const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.034, 24), flashMat);
flash.rotation.x = Math.PI / 2;
flash.position.set(0.5, PH / 2 - 0.6, -PD / 2 - 0.03);
phone.add(flash);
const torchLight = new THREE.SpotLight(0xfff2cc, 60, 16, 0.6, 0.5, 1.2);
torchLight.position.copy(flash.position);
torchLight.target.position.set(0.5, PH / 2 - 0.6, -6);
torchLight.visible = false;
phone.add(torchLight, torchLight.target);

const logo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 12, 40), frameMat);
logo.position.set(0, 0.1, -PD / 2 - 0.004);
phone.add(logo);

// ---------- 물리 ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
world.defaultContactMaterial.restitution = 0.38;
world.defaultContactMaterial.friction = 0.45;

const phoneBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Box(new CANNON.Vec3(PW / 2, PH / 2, PD / 2)),
  type: CANNON.Body.KINEMATIC,
  linearDamping: 0.03,
  angularDamping: 0.12,
});
world.addBody(phoneBody);

// 보이지 않는 벽들. 옆·위·아래 벽은 카메라 시야(절두체)를 따라 비스듬히 세워서
// 폰이 어느 깊이에 있든 화면 밖으로 나가지 않게 한다. (아래쪽 벽은 방 안으로 미끄러지는 경사면 역할)
function addPlane() {
  const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  world.addBody(b);
  return b;
}
const walls = { floor: addPlane(), back: addPlane(), front: addPlane(), left: addPlane(), right: addPlane(), top: addPlane(), ramp: addPlane() };
const PLANE_Z = new THREE.Vector3(0, 0, 1);
function setWall(body, normal, point) {      // normal: 방 안쪽을 향하는 방향
  tmpQ.setFromUnitVectors(PLANE_Z, normal);
  body.quaternion.set(tmpQ.x, tmpQ.y, tmpQ.z, tmpQ.w);
  body.position.set(point.x, point.y, point.z);
}

// 던져진 폰이 카메라 코앞(아래 버튼 뒤)에 눕지 않도록, 앞쪽에 있을 땐 방 안쪽으로 살짝 밀어 준다
world.addEventListener('preStep', () => {
  const z = phoneBody.position.z;
  if (phoneBody.type === CANNON.Body.DYNAMIC && z > 0.5) phoneBody.force.z -= 16 + 6 * (z - 0.5);
});

let shake = 0;
phoneBody.addEventListener('collide', (e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (v < 2) return;
  const k = clamp(v / 22, 0.1, 1);
  play('thud', k);
  buzz(10 + 30 * k);
  shake = Math.max(shake, k * 0.12);
});

// ---------- 화면 크기에 맞추기 ----------
const camBase = new THREE.Vector3();
const homePos = new THREE.Vector3(0, HOME_Y, 0);   // 손에 들고 있을 때 자리(카메라 가까이)
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const dist = Math.max(9.5, 1.95 / (tan * camera.aspect));   // 세로 화면에서도 폰이 잘리지 않게
  camBase.set(0, HOME_Y + 0.6, dist);
  camera.position.copy(camBase);
  camera.lookAt(0, HOME_Y, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  // 들고 있을 땐 폰이 화면 너비의 60%, 높이의 60%를 넘지 않는 선에서 최대한 크게 보이도록 당겨 든다
  const holdDist = Math.max((PW / 2) / (0.6 * tan * camera.aspect), (PH / 2) / (0.6 * tan));
  camera.getWorldDirection(tmpV);
  homePos.copy(camBase).addScaledVector(tmpV, Math.min(holdDist, dist));

  const a = Math.atan(tan * camera.aspect), b = THREE.MathUtils.degToRad(FOV / 2);
  const side = (nx, ny, nz) => tmpV2.set(nx, ny, nz).applyQuaternion(camera.quaternion);
  setWall(walls.left, side(Math.cos(a), 0, -Math.sin(a)), camBase);
  setWall(walls.right, side(-Math.cos(a), 0, -Math.sin(a)), camBase);
  setWall(walls.top, side(0, -Math.cos(b), -Math.sin(b)), camBase);
  const r = b * 0.7;                          // 아래 경사면은 조금 높여서 폰이 아래 버튼들 뒤로 숨지 않게
  setWall(walls.ramp, side(0, Math.cos(r), -Math.sin(r)), camBase);
  setWall(walls.floor, tmpV2.set(0, 1, 0), tmpV.set(0, 0, 0));
  setWall(walls.back, tmpV2.set(0, 0, 1), tmpV.set(0, 0, BACK_Z));
  setWall(walls.front, tmpV2.set(0, 0, -1), tmpV.set(0, 0, homePos.z + 1));
}
window.addEventListener('resize', resize);
resize();

// ---------- 폰의 상태 ----------
// hand: 공중에 들고 있음(돌릴 수 있음) / grab: 손가락으로 잡고 끄는 중 / free: 던져져서 물리에 맡김
let mode = 'hand';
const pos = homePos.clone();
const quat = new THREE.Quaternion();
const vel = new THREE.Vector3();
const spin = new THREE.Vector3();          // 각속도(월드 기준, rad/s)
const rotAccum = new THREE.Vector2();      // 이번 프레임에 드래그로 돌린 양
const grabTarget = new THREE.Vector3();
const grabArm = new THREE.Vector3();       // 폰 중심 → 잡은 지점
let grabTrail = [];                        // 최근 손가락 위치 기록 [{ t, p }] — 놓는 순간의 속도 계산용
let forcedFace = 0, forcedT = 0;           // 뒤집기 버튼이 정한 면(1 앞, -1 뒤)
let restT = 0;

const Q_FRONT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0));
const Q_BACK = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, Math.PI, 0));
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function setMode(next) {
  if (mode === next) return;
  if (next === 'free') {
    phoneBody.type = CANNON.Body.DYNAMIC;
    phoneBody.position.set(pos.x, pos.y, pos.z);
    phoneBody.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    phoneBody.velocity.set(vel.x, vel.y, vel.z);
    phoneBody.angularVelocity.set(spin.x, spin.y, spin.z);
    phoneBody.wakeUp();
    restT = 0;
  } else {
    if (mode === 'free') {
      pos.copy(phoneBody.position);
      quat.copy(phoneBody.quaternion);
    }
    phoneBody.type = CANNON.Body.KINEMATIC;
    phoneBody.velocity.setZero();
    phoneBody.angularVelocity.setZero();
    vel.set(0, 0, 0);
    spin.set(0, 0, 0);
  }
  mode = next;
}

function throwPhone(v, w) {
  vel.copy(v).clampLength(0, 30);
  spin.copy(w).clampLength(0, 26);
  setMode('free');
  play('whoosh');
}

function flip() {
  audio();
  if (mode === 'free') {
    phoneBody.wakeUp();
    phoneBody.velocity.y = Math.max(phoneBody.velocity.y, 0) + 11;
    phoneBody.angularVelocity.x += 11;
    restT = 0;
    play('whoosh');
    return;
  }
  if (mode !== 'hand') return;
  const facing = tmpV.set(0, 0, 1).applyQuaternion(quat).z >= 0 ? 1 : -1;
  forcedFace = -facing; forcedT = 1.2;
  spin.set(0, 10.5, 0);
  play('whoosh');
}

function tossRandom() {
  audio();
  const r = () => Math.random() * 2 - 1;
  if (mode === 'free') {
    pos.copy(phoneBody.position); quat.copy(phoneBody.quaternion);
    mode = 'hand';
  } else if (mode === 'grab') return;
  throwPhone(tmpV.set(r() * 5, 10 + Math.random() * 5, -6 - Math.random() * 5), tmpV2.set(r() * 12, r() * 8, r() * 12));
}

function pickUp() {
  forcedFace = 1; forcedT = 1.5;
  setMode('hand');
}

// ---------- 전원 버튼 ----------
let hold = null;   // { t, fired, x, y }
function powerDown(x, y) {
  audio();
  hold = { t: 0, t0: performance.now(), fired: false, x, y };
  play('click');
  buzz(8);
  ringEl.style.left = `${x}px`;
  ringEl.style.top = `${y - 56}px`;
  ringEl.style.setProperty('--p', 0);
  ringEl.classList.add('on');
}
function powerUp(cancel = false) {
  if (!hold) return;
  powerTick();
  const h = hold; hold = null;
  ringEl.classList.remove('on');
  if (h.fired || cancel) return;
  const r = os.powerShort();
  if (r === 'nope') { play('nope'); flashHint('짧게 누르면 안 켜져요. 꾹 눌러 보세요'); }
  else if (r) play('click');
}
function powerTick() {
  if (!hold || hold.fired) return;
  hold.t = (performance.now() - hold.t0) / 1000;   // 프레임 속도와 무관하게 실제 시간으로
  ringEl.style.setProperty('--p', clamp(hold.t / HOLD_SEC, 0, 1));
  if (hold.t < HOLD_SEC) return;
  hold.fired = true;
  ringEl.classList.remove('on');
  const r = os.powerLong();
  if (r === 'boot') { play('boot'); buzz([30, 60, 30]); }
  else if (r === 'shutdown') { play('off'); buzz(40); }
}

// ---------- 포인터 입력 ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const hitTargets = [powerHit, screenMesh, body, bezel, bump];
let drag = null;

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function pick(e) {
  setRay(e);
  return raycaster.intersectObjects(hitTargets, false)[0] || null;
}
// 광선이 화면 평면과 만나는 점을 화면 캔버스 좌표로
function screenPoint() {
  const n = tmpV.set(0, 0, 1).applyQuaternion(phone.quaternion);
  dragPlane.setFromNormalAndCoplanarPoint(n, screenMesh.getWorldPosition(tmpV2));
  const p = raycaster.ray.intersectPlane(dragPlane, tmpV2);
  if (!p) return null;
  screenMesh.worldToLocal(p);
  return [(p.x / SW + 0.5) * SCREEN_W, (0.5 - p.y / SH) * SCREEN_H];
}

canvas.addEventListener('pointerdown', (e) => {
  if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  audio();
  canvas.setPointerCapture(e.pointerId);
  const hit = pick(e);
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: 'none' };
  if (!hit) {
    if (mode === 'hand') { drag.type = 'rotate'; forcedT = 0; }
  } else if (hit.object === powerHit) {
    drag.type = 'power';
    powerDown(e.clientX, e.clientY);
  } else if (hit.object === screenMesh && os.interactive()) {
    drag.type = 'touch';
    const p = screenPoint();
    if (p) os.pointerDown(p[0], p[1]);
  } else {
    drag.type = 'grab-wait';
    camera.getWorldDirection(tmpV);
    dragPlane.setFromNormalAndCoplanarPoint(tmpV, hit.point);
    drag.plane = dragPlane.clone();
    drag.offset = phone.position.clone().sub(hit.point);
  }
  canvas.style.cursor = drag.type === 'power' ? 'pointer' : 'grabbing';
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (e.pointerType === 'mouse') {
      const hit = pick(e);
      canvas.style.cursor = !hit ? (mode === 'hand' ? 'grab' : 'default')
        : hit.object === powerHit || (hit.object === screenMesh && os.interactive()) ? 'pointer' : 'grab';
      btnMat.emissiveIntensity = hit?.object === powerHit ? 0.35 : 0;
    }
    return;
  }
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  setRay(e);
  if (drag.type === 'rotate') {
    rotAccum.x += dy * 0.009;
    rotAccum.y += dx * 0.009;
  } else if (drag.type === 'touch') {
    const p = screenPoint();
    if (p) os.pointerMove(p[0], p[1]);
  } else if (drag.type === 'grab-wait' || drag.type === 'grab') {
    if (drag.type === 'grab-wait' && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.type = 'grab';
      setMode('grab');
      grabArm.copy(drag.offset).negate();
      grabTrail = [];
    }
    if (drag.type === 'grab' && raycaster.ray.intersectPlane(drag.plane, tmpV)) {
      grabTarget.copy(tmpV).add(drag.offset);
      // 속도는 가장자리 제한을 걸기 전의 손가락 움직임으로 잰다 (벽에 붙어 있어도 던질 수 있게)
      const now = e.timeStamp;                  // 이벤트가 생긴 시각(처리 시각이 아님) → 버벅여도 정확
      grabTrail.push({ t: now, p: grabTarget.clone(), x: e.clientX, y: e.clientY });
      while (grabTrail.length > 2 && now - grabTrail[0].t > 150) grabTrail.shift();
      // 잡고 있는 동안에도 화면 안쪽에 머물게: 화면 좌표로 바꿔 가장자리를 자른 뒤 되돌린다
      grabTarget.project(camera);
      grabTarget.x = clamp(grabTarget.x, -0.8, 0.8);
      grabTarget.y = clamp(grabTarget.y, -0.7, 0.8);
      grabTarget.unproject(camera);
      grabTarget.y = Math.max(grabTarget.y, 0.5);
      grabTarget.z = clamp(grabTarget.z, BACK_Z + 1, homePos.z);
    }
  }
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  canvas.style.cursor = 'default';
  if (d.type === 'power') powerUp(e.type === 'pointercancel');
  else if (d.type === 'touch') os.pointerUp();
  else if (d.type === 'grab') {
    // 놓기 직전 0.15초 동안 손가락이 움직인 속도 (멈췄다 놓으면 0)
    const first = grabTrail[0], last = grabTrail[grabTrail.length - 1];
    let flick = 0;                              // 손가락 속도(px/초) — 폰이 가깝든 멀든 같은 기준으로 판정
    vel.set(0, 0, 0);
    if (first && last !== first && last.t > first.t && e.timeStamp - last.t < 160) {
      const sec = (last.t - first.t) / 1000;
      vel.copy(last.p).sub(first.p).divideScalar(sec).multiplyScalar(1.25);
      flick = Math.hypot(last.x - first.x, last.y - first.y) / sec;
    }
    const speed = vel.length();
    if (flick < 0.4 * Math.min(window.innerWidth, window.innerHeight)) { forcedFace = 0; setMode('hand'); }
    else {
      const v = tmpV.copy(vel);
      v.z -= 5 + speed * 0.5;                   // 방 안쪽으로 날아가게
      const w = tmpV2.copy(grabArm).cross(vel).multiplyScalar(-0.9);
      w.x += (Math.random() - 0.5) * 4 - v.y * 0.25;
      w.z += (Math.random() - 0.5) * 4;
      mode = 'hand';                            // grab → free 전환을 setMode가 처리하도록
      throwPhone(v, w);
    }
  }
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 아래 버튼과 키보드 ----------
const btnPower = $('btnPower');
btnPower.addEventListener('pointerdown', (e) => {
  btnPower.setPointerCapture(e.pointerId);
  btnPower.classList.add('held');
  const r = btnPower.getBoundingClientRect();
  powerDown(r.left + r.width / 2, r.top);
});
const btnPowerEnd = (e) => { btnPower.classList.remove('held'); powerUp(e.type === 'pointercancel'); };
btnPower.addEventListener('pointerup', btnPowerEnd);
btnPower.addEventListener('pointercancel', btnPowerEnd);
$('btnFlip').addEventListener('click', flip);
$('btnThrow').addEventListener('click', tossRandom);
$('btnPick').addEventListener('click', pickUp);
$('btnSound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  e.currentTarget.textContent = soundOn ? '소리 켬' : '소리 끔';
  e.currentTarget.setAttribute('aria-pressed', String(soundOn));
});

let keyHold = false;
const isPowerKey = (e) => e.key === 'p' || e.key === 'P' || e.key === 'ㅔ';
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof HTMLButtonElement;
  if (isPowerKey(e) || ((e.key === ' ' || e.key === 'Enter') && e.target === btnPower)) {
    e.preventDefault();
    keyHold = true;
    const r = btnPower.getBoundingClientRect();
    powerDown(r.left + r.width / 2, r.top);
  } else if (e.key === 'f' || e.key === 'F') flip();
  else if (e.key === 't' || e.key === 'T') tossRandom();
  else if (e.key === 'r' || e.key === 'R') pickUp();
  else if (e.key === ' ' && !onButton) { e.preventDefault(); tossRandom(); }
});
window.addEventListener('keyup', (e) => {
  if (keyHold && (isPowerKey(e) || e.key === ' ' || e.key === 'Enter')) { keyHold = false; powerUp(); }
});
window.addEventListener('blur', () => { keyHold = false; powerUp(true); });

// ---------- 안내 문구 ----------
let hintOverride = null, hintOverrideT = 0, lastHint = '';
function flashHint(msg) { hintOverride = msg; hintOverrideT = 2.2; }
function currentHint() {
  if (hintOverride) return hintOverride;
  if (hold && !hold.fired) return os.power === 'off' ? '그대로 꾹… 누르고 계세요' : '계속 누르면 전원이 꺼져요';
  if (mode === 'free') return '잠시 뒤 다시 집어 들어요 · 몸통을 잡아 또 던져도 돼요';
  if (mode === 'grab') return '휙 움직이다가 놓으면 날아가요';
  if (os.power === 'off') return '오른쪽 옆면의 전원 버튼을 꾹 눌러 켜 보세요';
  if (os.power === 'boot') return '켜지는 중…';
  if (os.power === 'shutdown') return '꺼지는 중…';
  if (os.asleep) return '전원 버튼을 짧게 누르면 화면이 켜져요';
  if (os.locked) return '화면을 위로 밀어 잠금을 풀어 보세요';
  if (os.view === 'app') return '화면 아래 막대를 위로 밀면 홈으로 돌아가요';
  return '화면을 옆으로 밀거나, 빈 곳을 끌어 돌리거나, 폰 테두리·뒷면을 잡아 던져 보세요';
}

// ---------- 매 프레임 ----------
function updateHand(dt, t) {
  // 드래그로 돌린 양 적용 + 관성
  if (rotAccum.x || rotAccum.y) {
    tmpQ.setFromEuler(new THREE.Euler(rotAccum.x, rotAccum.y, 0, 'YXZ'));
    quat.premultiply(tmpQ);
    spin.lerp(tmpV.set(rotAccum.x / dt, rotAccum.y / dt, 0), 0.5).clampLength(0, 22);
    rotAccum.set(0, 0);
  } else {
    const rotating = drag?.type === 'rotate';
    const w = spin.length();
    if (!rotating && w > 0.001) {
      tmpQ.setFromAxisAngle(tmpV.copy(spin).divideScalar(w), w * dt);
      quat.premultiply(tmpQ);
    }
    spin.multiplyScalar(Math.exp(-(rotating ? 12 : 2.4) * dt));
    // 느려지면 가까운 면(앞/뒤)으로 반듯하게 돌아온다
    if (!rotating && w < 3.2) {
      forcedT = Math.max(0, forcedT - dt);
      const facing = forcedT > 0 && forcedFace ? forcedFace : (tmpV.set(0, 0, 1).applyQuaternion(quat).z >= 0 ? 1 : -1);
      quat.slerp(facing > 0 ? Q_FRONT : Q_BACK, 1 - Math.exp(-6 * dt));
      spin.multiplyScalar(Math.exp(-8 * dt));
    }
  }
  quat.normalize();
  const bob = reduceMotion ? 0 : Math.sin(t * 1.4) * 0.05;
  tmpV.copy(homePos).y += bob;
  pos.lerp(tmpV, 1 - Math.exp(-7 * dt));
}

function updateGrab(dt) {
  pos.lerp(grabTarget, 1 - Math.exp(-22 * dt));
}

function updateFree(dt) {
  world.step(1 / 120, dt, 12);
  pos.copy(phoneBody.position);
  quat.copy(phoneBody.quaternion);
  const still = phoneBody.velocity.length() < 0.25 && phoneBody.angularVelocity.length() < 0.35;
  restT = still ? restT + dt : 0;
  if (restT > 2.4 || pos.y < -3) pickUp();
}

const timer = new THREE.Timer();
function frame() {
  timer.update();
  const dt = clamp(timer.getDelta(), 0.001, 0.1);
  const t = timer.getElapsed();

  powerTick();
  if (mode === 'hand') updateHand(dt, t);
  else if (mode === 'grab') updateGrab(dt);
  else updateFree(dt);
  if (mode !== 'free') {
    phoneBody.position.set(pos.x, pos.y, pos.z);
    phoneBody.quaternion.set(quat.x, quat.y, quat.z, quat.w);
  }
  phone.position.copy(pos);
  phone.quaternion.copy(quat);

  if (os.update(dt)) screenTex.needsUpdate = true;
  const pressed = hold ? 0.022 : 0;
  powerBtn.position.x += (POWER_X - pressed - powerBtn.position.x) * Math.min(1, dt * 30);
  if (hold) btnMat.emissiveIntensity = 0.3 + 0.9 * clamp(hold.t / HOLD_SEC, 0, 1);
  else if (!drag) btnMat.emissiveIntensity *= Math.exp(-dt * 6);

  shake *= Math.exp(-dt * 9);
  camera.position.set(
    camBase.x + (Math.random() - 0.5) * shake,
    camBase.y + (Math.random() - 0.5) * shake,
    camBase.z,
  );

  if (hintOverride && (hintOverrideT -= dt) <= 0) hintOverride = null;
  const hint = currentHint();
  if (hint !== lastHint) { hintEl.textContent = hint; lastHint = hint; }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(frame);

// 자동 점검/디버깅용 손잡이
window.__phone = {
  os, pos, quat, flip, tossRandom, pickUp,
  get mode() { return mode; },
  // 폰 기준 좌표를 브라우저 화면 좌표로
  toClient(x, y, z) {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(phone.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height];
  },
};
