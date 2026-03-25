import {
GestureRecognizer,
FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.getElementById("webcam");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");

const gestureText = document.getElementById("gesture");
const fpsText = document.getElementById("fps");
const statusBox = document.getElementById("status");
const iconBox = document.getElementById("icon");
const loading = document.getElementById("loading");

// HELP MENU
const helpBtn = document.getElementById("helpBtn");
const helpMenu = document.getElementById("helpMenu");
const closeHelp = document.getElementById("closeHelp");

helpBtn.onclick = () => helpMenu.classList.add("active");
closeHelp.onclick = () => helpMenu.classList.remove("active");

// Tap outside to close (mobile UX)
window.addEventListener("click", (e) => {
if (helpMenu.classList.contains("active") &&
!helpMenu.contains(e.target) &&
e.target !== helpBtn) {
helpMenu.classList.remove("active");
}
});

// ESP32 IP
const ESP32_IP = "http://10.128.114.1";

let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];
let noHandFrames = 0;

// CAMERA
async function setupCamera() {
const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: "user" }
});

video.srcObject = stream;

return new Promise((resolve) => {
video.onloadedmetadata = () => resolve(video);
});
}

// INIT
async function init() {

const vision = await FilesetResolver.forVisionTasks(
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const recognizer = await GestureRecognizer.createFromOptions(vision, {
baseOptions: {
modelAssetPath: "./gesture_recognizer.task"
},
runningMode: "VIDEO",
numHands: 1
});

await setupCamera();

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

loading.style.display = "none";

// ================= ESP32 =================
async function sendCommand(cmd) {
if (cmd === lastCommand) return;

```
try {
  await fetch(`${ESP32_IP}/${cmd}`, {
    method: "GET",
    mode: "no-cors"
  });

  lastCommand = cmd;
  statusBox.innerText = "🟢 CONNECTED";
  statusBox.classList.add("connected");

} catch {
  statusBox.innerText = "🔴 OFFLINE";
  statusBox.classList.remove("connected");
}
```

}

// ================= GESTURE MAP =================
function mapGesture(g) {
if (g === "None") return sendCommand("stop");

```
if (g === "Thumb_Up") sendCommand("forward");
else if (g === "Thumb_Down") sendCommand("backward");
else if (g === "Open_Palm") sendCommand("stop");
else if (g === "Pointing_Up") sendCommand("move_left");
else if (g === "Victory") sendCommand("move_right");
else if (g === "Closed_Fist") sendCommand("turn_left");
else if (g === "ILoveYou") sendCommand("turn_right");
```

}

// ================= SMOOTHING =================
function smoothGesture(g) {
gestureHistory.push(g);
if (gestureHistory.length > 7) gestureHistory.shift();

```
const count = {};
gestureHistory.forEach(x => count[x] = (count[x] || 0) + 1);

return Object.keys(count).reduce((a, b) =>
  count[a] > count[b] ? a : b
);
```

}

// ================= ICON =================
function getIcon(g) {
return {
Thumb_Up: "⬆️",
Thumb_Down: "⬇️",
Open_Palm: "⛔",
Pointing_Up: "↖️",
Victory: "↗️",
Closed_Fist: "⟲",
ILoveYou: "⟳"
}[g] || "❓";
}

// ================= HAND DRAW =================
function drawHand(landmarks) {

```
const mirrorX = x => canvas.width - x * canvas.width;

ctx.strokeStyle = "rgba(0,255,255,0.3)";
ctx.lineWidth = 1;

for (let i = 0; i < landmarks.length; i++) {
  for (let j = i + 1; j < landmarks.length; j++) {

    const x1 = mirrorX(landmarks[i].x);
    const y1 = landmarks[i].y * canvas.height;
    const x2 = mirrorX(landmarks[j].x);
    const y2 = landmarks[j].y * canvas.height;

    if (Math.hypot(x1 - x2, y1 - y2) < 55) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

ctx.fillStyle = "cyan";
landmarks.forEach(pt => {
  const x = mirrorX(pt.x);
  const y = pt.y * canvas.height;

  ctx.beginPath();
  ctx.arc(x, y, 3, 0, 2 * Math.PI);
  ctx.fill();
});
```

}

// ================= LOOP =================
function loop() {

```
const now = performance.now();

ctx.clearRect(0, 0, canvas.width, canvas.height);

// Mirror camera
ctx.save();
ctx.scale(-1, 1);
ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
ctx.restore();

const result = recognizer.recognizeForVideo(video, now);

let gesture = "None";
let confidence = 0;

if (result.gestures.length > 0) {
  gesture = result.gestures[0][0].categoryName;
  confidence = result.gestures[0][0].score;
  noHandFrames = 0;
} else {
  noHandFrames++;
}

// 🚨 Safety STOP
if (noHandFrames > 10) {
  gesture = "None";
}

// 🎯 Confidence filter
if (confidence < 0.6) {
  gesture = "None";
}

const stable = smoothGesture(gesture);

mapGesture(stable);

// UI update
gestureText.innerText = `${stable} (${(confidence * 100).toFixed(0)}%)`;
iconBox.innerText = getIcon(stable);

// Animation trigger
iconBox.parentElement.classList.add("gesture-active");
setTimeout(() => {
  iconBox.parentElement.classList.remove("gesture-active");
}, 150);

// Draw hand
if (result.landmarks.length > 0) {
  drawHand(result.landmarks[0]);
}

// FPS
const fps = 1000 / (now - lastTime);
lastTime = now;
fpsText.innerText = `${fps.toFixed(1)} FPS`;

requestAnimationFrame(loop);
```

}

loop();
}

init();
