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
const startBtn = document.getElementById("startBtn");

// ✅ CHANGE IF NEEDED
const ESP32_IP = "http://192.168.4.1";

let recognizer;
let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];
let noHandFrames = 0;

// ================= CAMERA =================
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve(video);
      };
    });

  } catch (err) {
    console.error(err);
    loading.innerText = "❌ Camera Error: " + err.message;
    loading.style.color = "red";
    throw err;
  }
}

// ================= INIT =================
async function init() {

  loading.innerText = "Loading AI Model...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "./gesture_recognizer.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });

  loading.innerText = "Starting Camera...";

  await setupCamera();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  loading.style.display = "none";

  loop();
}

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

  } catch {
    statusBox.innerText = "🔴 OFFLINE";
    statusBox.classList.remove("connected");
  }
}

// ================= MAP =================
function mapGesture(g) {
  if (g === "None") return sendCommand("stop");

  if (g === "Thumb_Up") sendCommand("forward");
  else if (g === "Thumb_Down") sendCommand("backward");
  else if (g === "Open_Palm") sendCommand("stop");
  else if (g === "Pointing_Up") sendCommand("move_left");
  else if (g === "Victory") sendCommand("move_right");
  else if (g === "Closed_Fist") sendCommand("turn_left");
  else if (g === "ILoveYou") sendCommand("turn_right");
}

// ================= SMOOTH =================
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

// ================= LOOP =================
function loop() {

  const now = performance.now();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // mirror
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

  if (noHandFrames > 10) gesture = "None";
  if (confidence < 0.6) gesture = "None";

  const stable = smoothGesture(gesture);
  mapGesture(stable);

  gestureText.innerText = `${stable} (${(confidence * 100).toFixed(0)}%)`;
  iconBox.innerText = getIcon(stable);

  // FPS
  const fps = 1000 / (now - lastTime);
  lastTime = now;
  fpsText.innerText = `${fps.toFixed(1)} FPS`;

  requestAnimationFrame(loop);
}

// ✅ USER INTERACTION REQUIRED
startBtn.onclick = init;
