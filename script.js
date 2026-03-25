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

const helpBtn = document.getElementById("helpBtn");
const helpPanel = document.getElementById("helpPanel");

const ESP32_IP = "http://10.128.114.1";

let lastCommand = "";
let lastTime = performance.now();
let gestureHistory = [];
let noHandFrames = 0;

/* HELP TOGGLE */
helpBtn.onclick = () => {
helpPanel.style.display =
helpPanel.style.display === "block" ? "none" : "block";
};

/* CAMERA */
async function setupCamera() {
const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: "user" }
});
video.srcObject = stream;

return new Promise((resolve) => {
video.onloadedmetadata = () => resolve(video);
});
}

/* INIT */
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

async function sendCommand(cmd) {
if (cmd === lastCommand) return;

```
try {
  await fetch(`${ESP32_IP}/${cmd}`, { mode: "no-cors" });
  lastCommand = cmd;
  statusBox.innerText = "🟢 CONNECTED";
  statusBox.classList.add("connected");
} catch {
  statusBox.innerText = "🔴 OFFLINE";
  statusBox.classList.remove("connected");
}
```

}

function mapGesture(gesture) {
if (gesture === "None") return sendCommand("stop");

```
if (gesture === "Thumb_Up") sendCommand("forward");
else if (gesture === "Thumb_Down") sendCommand("backward");
else if (gesture === "Open_Palm") sendCommand("stop");
else if (gesture === "Pointing_Up") sendCommand("move_left");
else if (gesture === "Victory") sendCommand("move_right");
else if (gesture === "Closed_Fist") sendCommand("turn_left");
else if (gesture === "ILoveYou") sendCommand("turn_right");
```

}

function smoothGesture(g) {
gestureHistory.push(g);
if (gestureHistory.length > 7) gestureHistory.shift();

```
const counts = {};
gestureHistory.forEach(x => counts[x] = (counts[x] || 0) + 1);

return Object.keys(counts).reduce((a,b)=>counts[a]>counts[b]?a:b);
```

}

function drawHand(landmarks) {
const mirrorX = x => canvas.width - x * canvas.width;

```
ctx.strokeStyle = "rgba(0,255,255,0.6)";
ctx.lineWidth = 1.5;

const connections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

connections.forEach(([i,j]) => {
  ctx.beginPath();
  ctx.moveTo(mirrorX(landmarks[i].x), landmarks[i].y * canvas.height);
  ctx.lineTo(mirrorX(landmarks[j].x), landmarks[j].y * canvas.height);
  ctx.stroke();
});

landmarks.forEach(pt => {
  const x = mirrorX(pt.x);
  const y = pt.y * canvas.height;

  const g = ctx.createRadialGradient(x,y,2,x,y,6);
  g.addColorStop(0,"#00ffff");
  g.addColorStop(1,"transparent");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x,y,6,0,2*Math.PI);
  ctx.fill();
});
```

}

async function loop() {
const now = performance.now();

```
ctx.clearRect(0,0,canvas.width,canvas.height);

ctx.save();
ctx.scale(-1,1);
ctx.drawImage(video,-canvas.width,0,canvas.width,canvas.height);
ctx.restore();

const res = recognizer.recognizeForVideo(video, now);

let gesture = "None";
let confidence = 0;

if (res.gestures.length > 0) {
  gesture = res.gestures[0][0].categoryName;
  confidence = res.gestures[0][0].score;
  noHandFrames = 0;
} else {
  noHandFrames++;
}

if (noHandFrames > 10) gesture = "None";

const stable = smoothGesture(gesture);
mapGesture(stable);

gestureText.innerText = `${stable} (${(confidence*100).toFixed(0)}%)`;
iconBox.innerText = stable;

if (res.landmarks.length > 0) drawHand(res.landmarks[0]);

const fps = 1000/(now-lastTime);
lastTime = now;
fpsText.innerText = `${fps.toFixed(1)} FPS`;

requestAnimationFrame(loop);
```

}

loop();
}

init();
