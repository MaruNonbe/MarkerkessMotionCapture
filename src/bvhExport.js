import * as THREE from "three";

// メートル(three.js/VRMの単位) → BVHで扱いやすいセンチメートル相当に拡大
const SCALE = 100;

function fmt(n) {
  return n.toFixed(6);
}

function sanitizeName(name) {
  return (name || "bone").replace(/\s+/g, "_");
}

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

function writeJoint(node, indent, isRoot, lines) {
  const pad = "  ".repeat(indent);
  const boneChildren = node.children.filter((c) => c.isBone);
  lines.push(`${pad}${isRoot ? "ROOT" : "JOINT"} ${sanitizeName(node.name)}`);
  lines.push(`${pad}{`);
  const p = node.position;
  lines.push(`${pad}  OFFSET ${fmt(p.x * SCALE)} ${fmt(p.y * SCALE)} ${fmt(p.z * SCALE)}`);
  lines.push(
    isRoot
      ? `${pad}  CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation`
      : `${pad}  CHANNELS 3 Xrotation Yrotation Zrotation`
  );
  if (boneChildren.length === 0) {
    lines.push(`${pad}  End Site`);
    lines.push(`${pad}  {`);
    lines.push(`${pad}    OFFSET 0.000000 5.000000 0.000000`);
    lines.push(`${pad}  }`);
  } else {
    for (const c of boneChildren) writeJoint(c, indent + 1, false, lines);
  }
  lines.push(`${pad}}`);
}

/**
 * 現時点でのボーン位置・回転をスナップショットとして保存する。
 * 録画中、毎フレーム呼び出す。
 */
export function snapshotPose(hipsBone) {
  const boneOrder = collectBoneChain(hipsBone);
  const map = new Map();
  for (const bone of boneOrder) {
    map.set(bone.uuid, {
      pos: bone.position.clone(),
      rot: bone.rotation.clone(),
    });
  }
  return map;
}

/**
 * 記録したフレーム列からBVHテキストを生成する。
 */
export function buildBvh(hipsBone, frames, frameTime) {
  const boneOrder = collectBoneChain(hipsBone);
  const lines = ["HIERARCHY"];
  writeJoint(hipsBone, 0, true, lines);
  lines.push("MOTION");
  lines.push(`Frames: ${frames.length}`);
  lines.push(`Frame Time: ${frameTime}`);

  for (const frame of frames) {
    const values = [];
    const root = frame.get(hipsBone.uuid);
    values.push(fmt(root.pos.x * SCALE), fmt(root.pos.y * SCALE), fmt(root.pos.z * SCALE));
    values.push(
      fmt(THREE.MathUtils.radToDeg(root.rot.x)),
      fmt(THREE.MathUtils.radToDeg(root.rot.y)),
      fmt(THREE.MathUtils.radToDeg(root.rot.z))
    );
    for (const bone of boneOrder.slice(1)) {
      const snap = frame.get(bone.uuid);
      values.push(
        fmt(THREE.MathUtils.radToDeg(snap.rot.x)),
        fmt(THREE.MathUtils.radToDeg(snap.rot.y)),
        fmt(THREE.MathUtils.radToDeg(snap.rot.z))
      );
    }
    lines.push(values.join(" "));
  }

  return lines.join("\n");
}
