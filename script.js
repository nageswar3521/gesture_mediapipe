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

// Help UI
const helpBtn = document.getElementById("helpBtn");
const helpPanel = document.getElementById("helpPanel");

helpBtn.onclick = () => {
helpPanel.style.display =
helpPanel.style.display === "block" ? "none" : "block";
};

// 🔴 ESP32 IP (CHANGE IF NEEDED)
const ESP32_IP = "http://10.128.114.1";

let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];
let noHandFrames = 0;

// ================= CAMERA =================
async function setupCamera() {
console.log("Requesting camera...");

const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: "user" }
});

video.srcObject = stream;

return new Promise((resolve) => {
video.onloadedmetadata = () => {
console.log("Camera started");
resolve(video);
};
});
}

// ================= INIT =================
async function init() {
try {

```
const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const recognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    // ✅ ONLINE MODEL (no file needed)
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"
  },
  runningMode: "VIDEO",
  numHands: 1
});

await setupCamera();

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

// Hide loading
if (loading) loading.style.display = "none";

// ================= ESP32 =================
async function sendCommand(cmd) {
  if (cmd === lastCommand) return;

  try {
    await fetch(`${ESP32_IP}/${cmd}`, {
      method: "GET",
      mode: "no-cors"
    });

    lastCommand = cmd;

    statusBox.innerText = "🟢 CONNECTED";
    statusBox.classList.add("connected");

  } catch (err) {
    console.error("ESP32 error:", err);

    statusBox.innerText = "🔴 OFFLINE";
    statusBox.classList.remove("connected");
  }
}

// ================= GESTURE MAP =================
function mapGesture(g) {
  if (g === "None") {
    sendCommand("stop");
    return;
  }

  const map = {
    Thumb_Up: "forward",
    Thumb_Down: "backward",
    Open_Palm: "stop",
    Pointing_Up: "move_left",
    Victory: "move_right",
    Closed_Fist: "turn_left",
    ILoveYou: "turn_right"
  };

  if (map[g]) sendCommand(map[g]);
}

// ================= SMOOTHING =================
function smoothGesture(g) {
  gestureHistory.push(g);
  if (gestureHistory.length > 7) gestureHistory.shift();

  const count = {};
  gestureHistory.forEach(x => count[x] = (count[x] || 0) + 1);

  return Object.keys(count).reduce((a, b) =>
    count[a] > count[b] ? a : b
  );
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

// ================= DRAW HAND (MESH STYLE) =================
function drawHand(landmarks) {
  const mirrorX = (x) => canvas.width - (x * canvas.width);

  ctx.strokeStyle = "rgba(0,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "cyan";

  const conn = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];

  conn.forEach(([i, j]) => {
    const x1 = mirrorX(landmarks[i].x);
    const y1 = landmarks[i].y * canvas.height;
    const x2 = mirrorX(landmarks[j].x);
    const y2 = landmarks[j].y * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  ctx.fillStyle = "#00ffff";

  landmarks.forEach((pt, i) => {
    const x = mirrorX(pt.x);
    const y = pt.y * canvas.height;

    ctx.beginPath();
    ctx.arc(x, y, i === 8 ? 8 : 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.shadowBlur = 0;
}

// ================= LOOP =================
async function loop() {
  const now = performance.now();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Mirror camera
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  const res = recognizer.recognizeForVideo(video, now);

  let g = "None";
  let conf = 0;

  if (res.gestures.length > 0) {
    g = res.gestures[0][0].categoryName;
    conf = res.gestures[0][0].score;
    noHandFrames = 0;
  } else {
    noHandFrames++;
  }

  // Auto STOP safety
  if (noHandFrames > 10) g = "None";

  const stable = smoothGesture(g);

  mapGesture(stable);

  gestureText.innerText =
    `${stable} (${(conf * 100).toFixed(0)}%)`;

  iconBox.innerText = getIcon(stable);

  if (res.landmarks.length > 0) {
    drawHand(res.landmarks[0]);
  }

  const fps = 1000 / (now - lastTime);
  lastTime = now;
  fpsText.innerText = `${fps.toFixed(1)} FPS`;

  requestAnimationFrame(loop);
}

loop();
```

} catch (err) {
console.error("INIT ERROR:", err);
alert("Error: " + err.message);
}
}

init();
