import {
  GestureRecognizer,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.getElementById("webcam");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");

const gestureText = document.getElementById("gesture");
const fpsText = document.getElementById("fps");

const ESP32_IP = "http://192.168.29.119";

let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video);
  });
}

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

  async function sendCommand(cmd) {
    if (cmd === lastCommand) return;

    try {
      const res = await fetch(`${ESP32_IP}/${cmd}`);
      console.log("Sent:", cmd, res.status);
      lastCommand = cmd;
    } catch (err) {
      console.log("ESP32 error:", err);
    }
  }

  function mapGesture(gesture) {
    if (gesture === "Thumb_Up") sendCommand("forward");
    else if (gesture === "Thumb_Down") sendCommand("backward");
    else if (gesture === "Open_Palm") sendCommand("stop");
    else if (gesture === "Pointing_Up") sendCommand("left");
    else if (gesture === "Victory") sendCommand("right");
  }

  function smoothGesture(gesture) {
    gestureHistory.push(gesture);
    if (gestureHistory.length > 5) gestureHistory.shift();

    return gestureHistory.sort((a,b) =>
      gestureHistory.filter(v => v===a).length -
      gestureHistory.filter(v => v===b).length
    ).pop();
  }

  async function loop() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = performance.now();

    const result = recognizer.recognizeForVideo(video, now);

    let gesture = "None";

    if (result.gestures.length > 0) {
      gesture = result.gestures[0][0].categoryName;
    }

    const stableGesture = smoothGesture(gesture);

    mapGesture(stableGesture);

    gestureText.innerText = stableGesture;

    const fps = 1000 / (now - lastTime);
    lastTime = now;
    fpsText.innerText = fps.toFixed(1);

    requestAnimationFrame(loop);
  }

  loop();
}

init();