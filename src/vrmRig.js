import * as THREE from "three";
import { VRMHumanBoneName } from "@pixiv/three-vrm";

// 角度をラジアン換算しつつ、急激な値の飛びを抑えるための線形補間
function lerpEuler(bone, x, y, z, factor = 0.4) {
  if (!bone) return;
  bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, x, factor);
  bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, y, factor);
  bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, z, factor);
}

function getBone(vrm, name) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
}
export function getHipsBone(vrm) {
  return getBone(vrm, VRMHumanBoneName.Hips);
}

/**
 * Kalidokit の Pose.solve() 結果を VRM の腕・脚・胴体ボーンへ反映する
 */
export function rigPose(vrm, pose, { lerpFactor = 0.45 } = {}) {
  if (!vrm || !pose) return;

  const hips = getBone(vrm, VRMHumanBoneName.Hips);
  if (hips && pose.Hips?.rotation) {
    lerpEuler(hips, pose.Hips.rotation.x, pose.Hips.rotation.y, pose.Hips.rotation.z, lerpFactor);
  }

  const spine = getBone(vrm, VRMHumanBoneName.Spine);
  if (spine && pose.Spine) {
    lerpEuler(spine, pose.Spine.x * 0.3, pose.Spine.y * 0.3, pose.Spine.z * 0.3, lerpFactor);
  }

  const mapping = [
    [VRMHumanBoneName.LeftUpperArm, pose.LeftUpperArm],
    [VRMHumanBoneName.LeftLowerArm, pose.LeftLowerArm],
    [VRMHumanBoneName.RightUpperArm, pose.RightUpperArm],
    [VRMHumanBoneName.RightLowerArm, pose.RightLowerArm],
    [VRMHumanBoneName.LeftUpperLeg, pose.LeftUpperLeg],
    [VRMHumanBoneName.LeftLowerLeg, pose.LeftLowerLeg],
    [VRMHumanBoneName.RightUpperLeg, pose.RightUpperLeg],
    [VRMHumanBoneName.RightLowerLeg, pose.RightLowerLeg],
  ];

  for (const [boneName, rot] of mapping) {
    if (!rot) continue;
    const bone = getBone(vrm, boneName);
    lerpEuler(bone, rot.x, rot.y, rot.z, lerpFactor);
  }
}

/**
 * Kalidokit の Face.solve() 結果を頭部の回転へ反映する
 */
export function rigFace(vrm, face, { lerpFactor = 0.5 } = {}) {
  if (!vrm || !face) return;
  const head = getBone(vrm, VRMHumanBoneName.Head);
  if (head && face.head) {
    lerpEuler(head, face.head.x, face.head.y, face.head.z, lerpFactor);
  }

  // まばたき・口の開閉を VRM の表情 (Expression) に反映
  const expr = vrm.expressionManager;
  if (expr && face.eye) {
    expr.setValue("blinkLeft", 1 - THREE.MathUtils.clamp(face.eye.l, 0, 1));
    expr.setValue("blinkRight", 1 - THREE.MathUtils.clamp(face.eye.r, 0, 1));
  }
  if (expr && typeof face.mouth?.shape?.A === "number") {
    expr.setValue("aa", THREE.MathUtils.clamp(face.mouth.shape.A, 0, 1));
  }
}

// Kalidokit の関節区分 (Proximal/Intermediate/Distal) と VRM のボーン名の対応表。
// 親指だけ関節数が異なる (VRM: Metacarpal/Proximal/Distal) ため個別に対応させる。
const FINGER_VRM_SUFFIX = {
  Thumb: { Proximal: "ThumbMetacarpal", Intermediate: "ThumbProximal", Distal: "ThumbDistal" },
  Index: { Proximal: "IndexProximal", Intermediate: "IndexIntermediate", Distal: "IndexDistal" },
  Middle: { Proximal: "MiddleProximal", Intermediate: "MiddleIntermediate", Distal: "MiddleDistal" },
  Ring: { Proximal: "RingProximal", Intermediate: "RingIntermediate", Distal: "RingDistal" },
  Little: { Proximal: "LittleProximal", Intermediate: "LittleIntermediate", Distal: "LittleDistal" },
};

/**
 * Kalidokit の Hand.solve() 結果を手首・指のボーンへ反映する
 */
export function rigHand(vrm, hand, side, { lerpFactor = 0.5 } = {}) {
  if (!vrm || !hand) return;
  const prefix = side === "Left" ? "Left" : "Right";
  const lowerPrefix = prefix.toLowerCase();

  const wristBone = getBone(vrm, VRMHumanBoneName[`${prefix}Hand`]);
  const wristRot = hand[`${prefix}Wrist`];
  if (wristBone && wristRot) {
    lerpEuler(wristBone, wristRot.x, wristRot.y, wristRot.z, lerpFactor);
  }

  for (const [finger, segmentMap] of Object.entries(FINGER_VRM_SUFFIX)) {
    for (const [kalidokitSegment, vrmSuffix] of Object.entries(segmentMap)) {
      const rot = hand[`${prefix}${finger}${kalidokitSegment}`];
      if (!rot) continue;
      const bone = getBone(vrm, `${lowerPrefix}${vrmSuffix}`);
      if (bone) lerpEuler(bone, rot.x, rot.y, rot.z, lerpFactor);
    }
  }
}
