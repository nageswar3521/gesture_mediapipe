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

// 🔴 CHANGE THIS
const ESP32_IP = "http://192.168.29.119";

let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];

// ================= CAMERA =================
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" }
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

// ================= INIT =================
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

  // ================= ESP32 =================
  async function sendCommand(cmd) {
    if (cmd === lastCommand) return;

    try {
      await fetch(`${ESP32_IP}/${cmd}`);
      lastCommand = cmd;

      statusBox.innerText = "CONNECTED";
      statusBox.classList.add("connected");

    } catch {
      statusBox.innerText = "OFFLINE";
      statusBox.classList.remove("connected");
    }
  }

  function mapGesture(gesture) {
    if (gesture === "Thumb_Up") sendCommand("forward");
    else if (gesture === "Thumb_Down") sendCommand("backward");
    else if (gesture === "Open_Palm") sendCommand("stop");
    else if (gesture === "Pointing_Up") sendCommand("left");
    else if (gesture === "Victory") sendCommand("right");
  }

  function getGestureIcon(gesture) {
    switch (gesture) {
      case "Thumb_Up": return "👍";
      case "Thumb_Down": return "👎";
      case "Open_Palm": return "✋";
      case "Victory": return "✌️";
      case "Pointing_Up": return "☝️";
      default: return "❓";
    }
  }

  function smoothGesture(gesture) {
    gestureHistory.push(gesture);
    if (gestureHistory.length > 5) gestureHistory.shift();

    return gestureHistory.sort((a,b) =>
      gestureHistory.filter(v => v===a).length -
      gestureHistory.filter(v => v===b).length
    ).pop();
  }

  // ================= DRAW HAND =================
  function drawHand(landmarks) {
    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],
      [0,17]
    ];

    const mirrorX = (x) => canvas.width - (x * canvas.width);

    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 3;

    connections.forEach(([i, j]) => {
      const x1 = mirrorX(landmarks[i].x);
      const y1 = landmarks[i].y * canvas.height;
      const x2 = mirrorX(landmarks[j].x);
      const y2 = landmarks[j].y * canvas.height;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    ctx.fillStyle = "yellow";
    landmarks.forEach(pt => {
      const x = mirrorX(pt.x);
      const y = pt.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
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

    const result = recognizer.recognizeForVideo(video, now);

    let gesture = "None";
    let confidence = 0;

    if (result.gestures.length > 0) {
      gesture = result.gestures[0][0].categoryName;
      confidence = result.gestures[0][0].score;
    }

    const stableGesture = smoothGesture(gesture);

    mapGesture(stableGesture);

    gestureText.innerText = `${stableGesture} (${(confidence*100).toFixed(0)}%)`;
    iconBox.innerText = getGestureIcon(stableGesture);

    if (result.landmarks.length > 0) {
      drawHand(result.landmarks[0]);
    }

    const fps = 1000 / (now - lastTime);
    lastTime = now;
    fpsText.innerText = `${fps.toFixed(1)} FPS`;

    requestAnimationFrame(loop);
  }

  loop();
}

init();