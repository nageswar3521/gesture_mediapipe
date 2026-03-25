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
return new Promise(res => video.onloadedmetadata = () => res(video));
}

// INIT
async function init() {

const vision = await FilesetResolver.forVisionTasks(
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
);

const recognizer = await GestureRecognizer.createFromOptions(vision, {
baseOptions: { modelAssetPath: "./gesture_recognizer.task" },
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

function mapGesture(g) {
if (g === "None") return sendCommand("stop");

```
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
```

}

function smoothGesture(g) {
gestureHistory.push(g);
if (gestureHistory.length > 7) gestureHistory.shift();

```
const count = {};
gestureHistory.forEach(x => count[x] = (count[x]||0)+1);

return Object.keys(count).reduce((a,b)=>count[a]>count[b]?a:b);
```

}

function getIcon(g) {
return {
Thumb_Up:"⬆️", Thumb_Down:"⬇️", Open_Palm:"⛔",
Pointing_Up:"↖️", Victory:"↗️",
Closed_Fist:"⟲", ILoveYou:"⟳"
}[g] || "❓";
}

// FACE-MESH STYLE HAND
function drawHand(landmarks) {
const mirrorX = x => canvas.width - (x * canvas.width);

```
ctx.strokeStyle = "rgba(0,255,255,0.8)";
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

conn.forEach(([i,j])=>{
  ctx.beginPath();
  ctx.moveTo(mirrorX(landmarks[i].x), landmarks[i].y*canvas.height);
  ctx.lineTo(mirrorX(landmarks[j].x), landmarks[j].y*canvas.height);
  ctx.stroke();
});

ctx.fillStyle = "#00ffff";
landmarks.forEach((pt,i)=>{
  ctx.beginPath();
  ctx.arc(mirrorX(pt.x), pt.y*canvas.height, i===8?8:4, 0, 2*Math.PI);
  ctx.fill();
});

ctx.shadowBlur = 0;
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

let g="None", conf=0;

if (res.gestures.length>0){
  g = res.gestures[0][0].categoryName;
  conf = res.gestures[0][0].score;
  noHandFrames=0;
} else noHandFrames++;

if (noHandFrames>10) g="None";

const stable = smoothGesture(g);
mapGesture(stable);

gestureText.innerText = `${stable} (${(conf*100).toFixed(0)}%)`;
iconBox.innerText = getIcon(stable);

if (res.landmarks.length>0) drawHand(res.landmarks[0]);

const fps = 1000/(now-lastTime);
lastTime=now;
fpsText.innerText = `${fps.toFixed(1)} FPS`;

requestAnimationFrame(loop);
```

}

loop();
}

init();
