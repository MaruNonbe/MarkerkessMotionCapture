import "./style.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { Pose, Face, Hand } from "kalidokit";
// Holistic は index.html の <script> タグ経由でグローバルに読み込まれる (npm/ESM非対応のため)
const { Holistic } = window;
import { rigPose, rigFace, rigHand } from "./vrmRig.js";

// ---------- DOM ----------
const videoEl = document.getElementById("input-video");
const threeCanvas = document.getElementById("three-canvas");
const landmarkCanvas = document.getElementById("landmark-canvas");
const landmarkCtx = landmarkCanvas.getContext("2d");
const statusEl = document.getElementById("status");
const btnWebcam = document.getElementById("btn-webcam");
const btnPlay = document.getElementById("btn-play");
const btnPause = document.getElementById("btn-pause");
const inputFile = document.getElementById("input-file");
const inputVrm = document.getElementById("input-vrm");
const toggleLandmarks = document.getElementById("toggle-landmarks");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

// ---------- Three.js シーン ----------
const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
camera.position.set(0, 1.3, 3.2);
camera.lookAt(0, 1.1, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(1, 2, 1);
scene.add(dirLight);

const grid = new THREE.GridHelper(4, 16, 0x2a323d, 0x1a2029);
scene.add(grid);

function resizeRenderer() {
  const wrap = threeCanvas.parentElement;
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  landmarkCanvas.width = landmarkCanvas.clientWidth;
  landmarkCanvas.height = landmarkCanvas.clientHeight;
}
window.addEventListener("resize", resizeRenderer);
resizeRenderer();

let currentVrm = null;

function loadVrm(url) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  setStatus("VRMモデルを読み込み中…");

  loader.load(
    url,
    (gltf) => {
      const vrm = gltf.userData.vrm;
      if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
      }
      VRMUtils.rotateVRM0(vrm); // VRM0系モデルの向きを補正
      scene.add(vrm.scene);
      currentVrm = vrm;
      setStatus("VRM読み込み完了。入力ソースを選択してください。");
    },
    undefined,
    (err) => {
      console.error(err);
      setStatus("VRMの読み込みに失敗しました。", "error");
    }
  );
}

// ---------- MediaPipe Holistic ----------
const holistic = new Holistic({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
});
holistic.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  refineFaceLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});
holistic.onResults(onHolisticResults);

// 胴体・四肢の主要な接続のみを描画(顔・指はランドマーク点のみ)
const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

function drawLandmarks(results) {
  const w = landmarkCanvas.width;
  const h = landmarkCanvas.height;
  landmarkCtx.clearRect(0, 0, w, h);
  if (!toggleLandmarks.checked) return;

  landmarkCtx.drawImage(results.image, 0, 0, w, h);

  const drawPoints = (points, color, radius = 3) => {
    if (!points) return;
    landmarkCtx.fillStyle = color;
    for (const p of points) {
      landmarkCtx.beginPath();
      landmarkCtx.arc(p.x * w, p.y * h, radius, 0, Math.PI * 2);
      landmarkCtx.fill();
    }
  };

  if (results.poseLandmarks) {
    landmarkCtx.strokeStyle = "#4fd1c5";
    landmarkCtx.lineWidth = 2;
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = results.poseLandmarks[a];
      const pb = results.poseLandmarks[b];
      if (!pa || !pb) continue;
      landmarkCtx.beginPath();
      landmarkCtx.moveTo(pa.x * w, pa.y * h);
      landmarkCtx.lineTo(pb.x * w, pb.y * h);
      landmarkCtx.stroke();
    }
    drawPoints(results.poseLandmarks, "#4fd1c5");
  }
  drawPoints(results.leftHandLandmarks, "#f2c14e", 2);
  drawPoints(results.rightHandLandmarks, "#e5534b", 2);
}

let lastVideoTime = -1;

function onHolisticResults(results) {
  drawLandmarks(results);
  if (!currentVrm) return;

  const videoW = videoEl.videoWidth || 640;
  const videoH = videoEl.videoHeight || 480;

  const poseWorld = results.poseWorldLandmarks;
  if (results.poseLandmarks && poseWorld) {
    const pose = Pose.solve(poseWorld, results.poseLandmarks, {
      runtime: "mediapipe",
      video: videoEl,
    });
    rigPose(currentVrm, pose);
  }

  if (results.faceLandmarks) {
    const face = Face.solve(results.faceLandmarks, {
      runtime: "mediapipe",
      video: videoEl,
      imageSize: { width: videoW, height: videoH },
    });
    rigFace(currentVrm, face);
  }

  if (results.rightHandLandmarks) {
    const rightHand = Hand.solve(results.rightHandLandmarks, "Right");
    rigHand(currentVrm, rightHand, "Right");
  }
  if (results.leftHandLandmarks) {
    const leftHand = Hand.solve(results.leftHandLandmarks, "Left");
    rigHand(currentVrm, leftHand, "Left");
  }
}

// ---------- 入力ソース制御 ----------
let rafId = null;
let tracking = false;

async function detectionLoop() {
  if (!tracking) return;
  if (videoEl.readyState >= 2 && videoEl.currentTime !== lastVideoTime) {
    lastVideoTime = videoEl.currentTime;
    await holistic.send({ image: videoEl });
  }
  rafId = requestAnimationFrame(detectionLoop);
}

function startTracking() {
  if (tracking) return;
  tracking = true;
  setStatus("トラッキング中…", "tracking");
  detectionLoop();
}

function stopTracking() {
  tracking = false;
  if (rafId) cancelAnimationFrame(rafId);
  setStatus("停止中");
}

let currentStream = null;

async function useWebcam() {
  stopCurrentSource();
  try {
    setStatus("Webカメラにアクセス中…");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    currentStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    btnPlay.disabled = true;
    btnPause.disabled = false;
    startTracking();
  } catch (err) {
    console.error(err);
    setStatus("Webカメラへのアクセスに失敗しました。ブラウザの権限設定を確認してください。", "error");
  }
}

function useVideoFile(file) {
  stopCurrentSource();
  const url = URL.createObjectURL(file);
  videoEl.srcObject = null;
  videoEl.src = url;
  videoEl.loop = true;
  videoEl.muted = true;
  btnPlay.disabled = false;
  btnPause.disabled = false;
  setStatus("動画を読み込みました。再生ボタンでトラッキング開始。");
}

function stopCurrentSource() {
  stopTracking();
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  videoEl.pause();
}

btnWebcam.addEventListener("click", useWebcam);
inputFile.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) useVideoFile(file);
});
inputVrm.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) loadVrm(URL.createObjectURL(file));
});
btnPlay.addEventListener("click", async () => {
  await videoEl.play();
  startTracking();
});
btnPause.addEventListener("click", () => {
  videoEl.pause();
  stopTracking();
});

// ---------- レンダーループ ----------
function animate() {
  requestAnimationFrame(animate);
  if (currentVrm) currentVrm.update(1 / 60);
  renderer.render(scene, camera);
}
animate();

setStatus("「.vrmファイルを読み込む」からモデルを指定してください。");
