// Don't Touch the Wall
// Trace the path with your mouse. Touch the wall and the level restarts.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

// Each level is a path of points. The player has to stay within width/2 of the path.
// The path gets thinner every level. "enemies" move along the path. "dark" turns the lights off.
const LEVELS = [
  { name: "Warm Up", width: 120,
    path: [[60, 280], [840, 280]] },
  { name: "First Turn", width: 95,
    path: [[60, 120], [450, 120], [450, 440], [840, 440]] },
  { name: "Zig Zag", width: 75,
    path: [[60, 90], [820, 90], [820, 280], [80, 280], [80, 470], [840, 470]] },
  { name: "Watch Out", width: 60,
    path: [[60, 470], [60, 90], [300, 90], [300, 470], [560, 470], [560, 90], [840, 90]],
    enemies: [{ speed: 90, offset: 0.5 }] },
  { name: "Squeeze", width: 48,
    path: [[60, 90], [250, 90], [250, 250], [100, 250], [100, 470], [500, 470],
           [500, 180], [680, 180], [680, 400], [840, 400]],
    enemies: [{ speed: 110, offset: 0.3 }, { speed: 110, offset: 0.8 }] },
  { name: "Rush Hour", width: 40,
    path: [[60, 500], [840, 500], [840, 380], [120, 380], [120, 260], [840, 260],
           [840, 140], [60, 140], [60, 60], [840, 60]],
    enemies: [{ speed: 150, offset: 0.25 }, { speed: 150, offset: 0.5 }, { speed: 150, offset: 0.75 }] },
  { name: "Lights Out", width: 40, dark: true,
    path: [[60, 280], [200, 280], [200, 80], [380, 80], [380, 480], [560, 480],
           [560, 80], [740, 80], [740, 280], [840, 280]] },
  { name: "Final Boss", width: 32, dark: true,
    path: [[60, 60], [840, 60], [840, 180], [60, 180], [60, 300], [840, 300],
           [840, 420], [60, 420], [60, 510], [840, 510]],
    enemies: [{ speed: 120, offset: 0.4 }, { speed: 120, offset: 0.8 }] }
];

const ENEMY_RADIUS = 10;
const LIGHT_RADIUS = 85;

// Game state
let levelIndex = 0;
let state = "ready"; // ready, playing, dead, cleared, finished
let mouse = { x: -100, y: -100 };
let last = null;
let deaths = 0;
let flash = 0;
let message = "Click the green dot to start";
let runStart = null;
let runEnd = null;
let levelStartTime = 0;
let lastFrame = performance.now();

// HUD elements
const levelNumEl = document.getElementById("levelNum");
const levelTotalEl = document.getElementById("levelTotal");
const levelNameEl = document.getElementById("levelName");
const deathsEl = document.getElementById("deaths");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
levelTotalEl.textContent = LEVELS.length;

// Best time saved in the browser (wrapped in try/catch in case storage is blocked)
function loadBest() {
  try { return localStorage.getItem("dttw_best"); } catch (e) { return null; }
}
function saveBest(seconds) {
  try {
    const old = parseFloat(loadBest());
    if (isNaN(old) || seconds < old) localStorage.setItem("dttw_best", seconds.toFixed(1));
  } catch (e) { /* ignore */ }
}
function showBest() {
  const b = loadBest();
  bestEl.textContent = b ? b + "s" : "--";
}
showBest();

// ---------- Path math ----------
function level() { return LEVELS[levelIndex]; }

function segmentLengths(path) {
  const lens = [];
  for (let i = 0; i < path.length - 1; i++) {
    lens.push(Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]));
  }
  return lens;
}

function pathLength(path) {
  return segmentLengths(path).reduce((a, b) => a + b, 0);
}

// Get the x,y point that is "d" pixels along the path
function pointAt(path, d) {
  const lens = segmentLengths(path);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]) {
      const t = lens[i] === 0 ? 0 : d / lens[i];
      return {
        x: path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        y: path[i][1] + (path[i + 1][1] - path[i][1]) * t
      };
    }
    d -= lens[i];
  }
  const end = path[path.length - 1];
  return { x: end[0], y: end[1] };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isOnPath(x, y) {
  const p = level().path;
  const half = level().width / 2;
  for (let i = 0; i < p.length - 1; i++) {
    if (distToSegment(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) <= half) return true;
  }
  return false;
}

function startPoint() { const p = level().path[0]; return { x: p[0], y: p[1] }; }
function goalPoint() { const p = level().path; return { x: p[p.length - 1][0], y: p[p.length - 1][1] }; }

// Enemies bounce back and forth along the path
function enemyPositions(timeSec) {
  const lv = level();
  if (!lv.enemies) return [];
  const L = pathLength(lv.path);
  return lv.enemies.map(e => {
    let d = (e.offset * L + e.speed * timeSec) % (2 * L);
    if (d > L) d = 2 * L - d;
    return pointAt(lv.path, d);
  });
}

// ---------- Sound (short beeps, no files needed) ----------
let audioCtx = null;
function beep(freq, duration, type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { /* sound is optional */ }
}

// ---------- Game events ----------
function startLevel() {
  state = "playing";
  last = { x: mouse.x, y: mouse.y };
  levelStartTime = performance.now();
  if (runStart === null) runStart = performance.now();
  message = "";
  canvas.classList.add("playing");
  beep(660, 0.1, "sine");
}

function die(reason) {
  if (state !== "playing") return;
  deaths++;
  deathsEl.textContent = deaths;
  state = "dead";
  flash = 1;
  message = reason + " Try again!";
  canvas.classList.remove("playing");
  beep(120, 0.35, "sawtooth");
  setTimeout(() => {
    if (state === "dead") {
      state = "ready";
      message = "Click the green dot to start";
    }
  }, 800);
}

function clearLevel() {
  state = "cleared";
  canvas.classList.remove("playing");
  beep(880, 0.15, "sine");
  setTimeout(() => beep(1320, 0.2, "sine"), 120);

  if (levelIndex === LEVELS.length - 1) {
    state = "finished";
    runEnd = performance.now();
    const total = (runEnd - runStart) / 1000;
    saveBest(total);
    showBest();
    message = "You beat every level! Time: " + total.toFixed(1) + "s, Deaths: " + deaths + ". Click to play again.";
    return;
  }

  message = "Level cleared!";
  setTimeout(() => {
    levelIndex++;
    updateHud();
    state = "ready";
    message = level().dark
      ? "Lights Out: memorize the path, then click the green dot"
      : "Click the green dot to start";
  }, 900);
}

function resetGame() {
  levelIndex = 0;
  deaths = 0;
  runStart = null;
  runEnd = null;
  deathsEl.textContent = 0;
  state = "ready";
  message = "Click the green dot to start";
  updateHud();
}

function updateHud() {
  levelNumEl.textContent = levelIndex + 1;
  levelNameEl.textContent = level().name;
}
updateHud();

// Check every few pixels between the old and new mouse spot,
// so moving the mouse really fast can't skip over a wall.
function checkMove(from, to) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / 3));
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps);
    const y = from.y + (to.y - from.y) * (i / steps);
    if (!isOnPath(x, y)) { die("You touched the wall!"); return; }
    const g = goalPoint();
    if (Math.hypot(x - g.x, y - g.y) <= level().width / 2) { clearLevel(); return; }
  }
}

// ---------- Input ----------
function toCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height)
  };
}

function handleMove(clientX, clientY) {
  mouse = toCanvas(clientX, clientY);
  if (state === "playing") {
    checkMove(last, mouse);
    last = { x: mouse.x, y: mouse.y };
  }
}

function handlePress(clientX, clientY) {
  mouse = toCanvas(clientX, clientY);
  if (state === "finished") { resetGame(); return; }
  if (state === "ready") {
    const s = startPoint();
    if (Math.hypot(mouse.x - s.x, mouse.y - s.y) <= level().width / 2) startLevel();
  }
}

canvas.addEventListener("mousemove", e => handleMove(e.clientX, e.clientY));
canvas.addEventListener("mousedown", e => handlePress(e.clientX, e.clientY));
canvas.addEventListener("mouseleave", () => die("You left the board!"));

// Touch support so it works on a phone too
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  const t = e.touches[0];
  handlePress(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  const t = e.touches[0];
  handleMove(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener("touchend", () => die("You lifted your finger!"));

// ---------- Drawing ----------
function drawPath() {
  const p = level().path;
  ctx.strokeStyle = "#1e3cff";
  ctx.lineWidth = level().width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.stroke();
}

function drawCircle(x, y, r, color, glow) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow || 0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawText(text, y, size, color) {
  ctx.save();
  ctx.font = "bold " + size + "px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const w = ctx.measureText(text).width;
  ctx.fillRect(W / 2 - w / 2 - 14, y - size, w + 28, size * 1.5);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

function draw(now) {
  const lv = level();
  const timeSec = (now - levelStartTime) / 1000;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  drawPath();

  const s = startPoint();
  const g = goalPoint();
  drawCircle(s.x, s.y, Math.min(lv.width / 2 - 4, 22), "#00e676", 15);
  drawCircle(g.x, g.y, Math.min(lv.width / 2 - 4, 22), "#ffd54f", 20);

  const enemies = state === "playing" ? enemyPositions(timeSec) : enemyPositions(0);
  enemies.forEach(e => drawCircle(e.x, e.y, ENEMY_RADIUS, "#ff1744", 18));

  if (state === "playing") {
    drawCircle(mouse.x, mouse.y, 5, "#ffffff", 10);
  }

  // Lights Out twist: everything is dark except a circle around your cursor
  if (lv.dark && state === "playing") {
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(mouse.x, mouse.y, LIGHT_RADIUS, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
  }

  // Red flash when you die
  if (flash > 0) {
    ctx.fillStyle = "rgba(255, 0, 0, " + (flash * 0.5) + ")";
    ctx.fillRect(0, 0, W, H);
  }

  if (message) {
    const color = state === "dead" ? "#ff5252" : state === "finished" || state === "cleared" ? "#ffd54f" : "#ffffff";
    drawText(message, H / 2 + 10, state === "finished" ? 22 : 26, color);
  }
}

// ---------- Main loop ----------
function loop(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;

  if (state === "playing") {
    const timeSec = (now - levelStartTime) / 1000;
    const hit = enemyPositions(timeSec).some(e =>
      Math.hypot(e.x - mouse.x, e.y - mouse.y) <= ENEMY_RADIUS + 4);
    if (hit) die("A red dot got you!");
  }

  if (flash > 0) flash = Math.max(0, flash - dt * 2);

  if (runStart !== null) {
    const end = runEnd !== null ? runEnd : now;
    timerEl.textContent = ((end - runStart) / 1000).toFixed(1);
  }

  draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
