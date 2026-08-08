import * as THREE from "three"; 
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// VRMのボーンはTHREE.Bone (skin対象) として生成されるため、
// isBone のオブジェクトだけを辿ることでメッシュ等を除外し骨格チェーンのみ取得する
function collectBoneChain(root) {
  const list = [];
  function walk(node) {
    list.push(node);
    const boneChildren = node.children.filter((c) => c.isBone);
    for (const c of boneChildren) walk(c);
  }
  walk(root);
  return list;
}

/**
 * 録画したフレーム列 (bvhExport.snapshotPose と同じ形式) から
 * three.js の AnimationClip (ボーンごとのクォータニオン/位置トラック) を構築する
 */
export function buildAnimationClip(hipsBone, frames, fps) {
  const boneOrder = collectBoneChain(hipsBone);
  const times = frames.map((_, i) => i / fps);
  const tracks = [];
  const q = new THREE.Quaternion();

  const posValues = [];
  const rootRotValues = [];
  for (const frame of frames) {
    const snap = frame.get(hipsBone.uuid);
    posValues.push(snap.pos.x, snap.pos.y, snap.pos.z);
    q.setFromEuler(snap.rot);
    rootRotValues.push(q.x, q.y, q.z, q.w);
  }
  tracks.push(new THREE.VectorKeyframeTrack(`${hipsBone.name}.position`, times, posValues));
  tracks.push(new THREE.QuaternionKeyframeTrack(`${hipsBone.name}.quaternion`, times, rootRotValues));

  for (const bone of boneOrder.slice(1)) {
    const rotValues = [];
    for (const frame of frames) {
      const snap = frame.get(bone.uuid);
      q.setFromEuler(snap.rot);
      rotValues.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotValues));
  }

  const duration = times.length ? times[times.length - 1] : 0;
  return new THREE.AnimationClip("Motion", duration, tracks);
}

/**
 * VRMのシーンとAnimationClipから、アニメーション付きのバイナリGLB (ArrayBuffer) を書き出す
 */
export function exportAnimatedGlb(vrmScene, clip) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      vrmScene,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true, animations: [clip] }
    );
  });
}
