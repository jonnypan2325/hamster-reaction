import type { GestureId } from './gestures';

export type Point = { x: number; y: number; z?: number; visibility?: number };
export type Candidate = { id: GestureId; confidence: number };
export type DetectionInput = {
  blendshapes: Record<string, number>;
  face: Point[];
  hands: Point[][];
  pose: Point[];
  facialTransformationMatrix?: readonly number[];
};

export const THRESHOLDS = {
  glassesNearFace: 0.28, mouthNear: 0.14, elbowBendDegrees: 100, poseVisibility: 0.5,
  handsTogether: 0.12, thinkingNearMouth: 0.25, hugBelowFace: 0.2, yawDegrees: 18,
  mouthPucker: 0.25, browRaised: 0.70, jawOpen: 0.5,
  smile: 0.35, smileJawOpenMax: 0.35, mouthFrown: 0.15,
} as const;

const defaultCandidate: Candidate = { id: 'default', confidence: 0 };
const fingerJoints = [[8, 5], [12, 9], [16, 13], [20, 17]] as const;
const score = (scores: Record<string, number>, name: string) => scores[name] ?? 0;
const average = (...values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
const distance = (a?: Point, b?: Point) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Number.POSITIVE_INFINITY;
const visible = (point?: Point) => point !== undefined && (point.visibility ?? 1) >= THRESHOLDS.poseVisibility;

function center(points: Point[]): Point | null {
  return points.length ? { x: average(...points.map((point) => point.x)), y: average(...points.map((point) => point.y)) } : null;
}

export function classifyFace(blendshapes: Record<string, number>): Candidate | null {
  const brows = Math.max(score(blendshapes, 'browInnerUp'), average(score(blendshapes, 'browOuterUpLeft'), score(blendshapes, 'browOuterUpRight')));
  if (brows >= THRESHOLDS.browRaised) return { id: 'startled', confidence: brows };
  const mouthPucker = score(blendshapes, 'mouthPucker');
  const jawOpen = score(blendshapes, 'jawOpen');
  const smileLeft = score(blendshapes, 'mouthSmileLeft');
  const smileRight = score(blendshapes, 'mouthSmileRight');
  if (smileLeft >= THRESHOLDS.smile && smileRight >= THRESHOLDS.smile && jawOpen < THRESHOLDS.smileJawOpenMax) {
    return { id: 'smile', confidence: average(smileLeft, smileRight) };
  }
  if (mouthPucker >= THRESHOLDS.mouthPucker && jawOpen >= THRESHOLDS.mouthPucker) return { id: 'silly', confidence: average(mouthPucker, jawOpen) };
  if (jawOpen >= THRESHOLDS.jawOpen) return { id: 'drooling', confidence: jawOpen };
  const frownLeft = score(blendshapes, 'mouthFrownLeft');
  const frownRight = score(blendshapes, 'mouthFrownRight');
  return frownLeft >= THRESHOLDS.mouthFrown && frownRight >= THRESHOLDS.mouthFrown
    ? { id: 'sad', confidence: average(frownLeft, frownRight) }
    : null;
}

export function fingersUp(landmarks: Point[]): boolean[] | null {
  if (landmarks.length < 21) return null;
  const wrist = landmarks[0];
  const pinkyBase = landmarks[17];
  const thumbExtended = distance(landmarks[4], pinkyBase) > distance(landmarks[2], pinkyBase) * 1.1;
  return [thumbExtended, ...fingerJoints.map(([tip, base]) => distance(wrist, landmarks[tip]) > distance(wrist, landmarks[base]) * 1.15)];
}

function classifySingleHand(fingers: boolean[]) {
  const [thumb, index, middle, ring, pinky] = fingers;
  if (!index && !middle && !ring && !pinky) return thumb ? 'thumbs-up' : 'fist';
  if (index && middle && ring && pinky && thumb) return 'open-palm';
  if (index && !middle && !ring && !pinky) return 'pointer';
  return null;
}

export function isPinch(landmarks: Point[]) {
  if (landmarks.length < 21) return false;
  const scale = distance(landmarks[0], landmarks[9]);
  if (scale < 1e-6) return false;
  const thumbIndex = distance(landmarks[4], landmarks[8]);
  const thumbMiddle = distance(landmarks[4], landmarks[12]);
  return thumbIndex < scale * 0.5 && thumbIndex < thumbMiddle * 0.7;
}

function thumbPointsDown(landmarks: Point[]) {
  const scale = distance(landmarks[0], landmarks[9]);
  return scale >= 1e-6 && (landmarks[4].y - landmarks[0].y) / scale > 0.35;
}

function classifySpecificHands(hands: Point[][], headCenter: Point | null, mouth: Point | null): Candidate | null {
  for (const landmarks of hands) {
    if (landmarks.length < 21) continue;
    const handCenter = center(landmarks);
    if (isPinch(landmarks)) {
      if (handCenter && headCenter && distance(handCenter, headCenter) < THRESHOLDS.glassesNearFace) return { id: 'glasses', confidence: 0.8 };
      continue;
    }
    const fingers = fingersUp(landmarks);
    if (!fingers) continue;
    const gesture = classifySingleHand(fingers);
    if (gesture === 'fist' || gesture === 'thumbs-up') {
      const besideHead = handCenter && headCenter && Math.abs(handCenter.y - headCenter.y) < 0.15 && Math.abs(handCenter.x - headCenter.x) > 0.08 && Math.abs(handCenter.x - headCenter.x) < 0.3;
      if (besideHead) return { id: 'fist-by-head', confidence: 0.75 };
      if (gesture === 'thumbs-up') return { id: thumbPointsDown(landmarks) ? 'thumbs-down' : 'thumbs-up', confidence: 0.75 };
      continue;
    }
    if (gesture === 'pointer') return mouth && distance(landmarks[8], mouth) < THRESHOLDS.mouthNear ? { id: 'finger-mouth', confidence: 0.75 } : { id: 'nerd', confidence: 0.7 };
  }
  return null;
}

function classifyTwoHands(hands: Point[][], headCenter: Point | null, mouth: Point | null): Candidate | null {
  if (hands.length !== 2) return null;
  const [first, second] = hands.map(center);
  if (!first || !second || distance(first, second) >= THRESHOLDS.handsTogether) return null;
  const combined = { x: average(first.x, second.x), y: average(first.y, second.y) };
  if (mouth && distance(combined, mouth) < THRESHOLDS.thinkingNearMouth) return { id: 'thinking', confidence: 0.65 };
  return headCenter && combined.y - headCenter.y > THRESHOLDS.hugBelowFace ? { id: 'hug', confidence: 0.6 } : null;
}

function elbowAngle(shoulder: Point, elbow: Point, wrist: Point) {
  const first = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
  const second = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };
  const length = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  return length < 1e-6 ? null : Math.acos(clamp((first.x * second.x + first.y * second.y) / length)) * 180 / Math.PI;
}

function detectCrossArms(pose: Point[]) {
  const [leftShoulder, rightShoulder, leftWrist, rightWrist] = [pose[11], pose[12], pose[15], pose[16]];
  if (![leftShoulder, rightShoulder, leftWrist, rightWrist].every(visible)) return false;
  const leftHip = pose[23];
  const rightHip = pose[24];
  const chestTop = Math.min(leftShoulder.y, rightShoulder.y);
  const chestBottom = visible(leftHip) && visible(rightHip) ? Math.max(leftHip.y, rightHip.y) : chestTop + 0.35;
  const wristHeight = average(leftWrist.y, rightWrist.y);
  return distance(leftWrist, rightWrist) < 0.18 && chestTop < wristHeight && wristHeight < chestBottom;
}

function detectBicep(pose: Point[]) {
  for (const [shoulderIndex, elbowIndex, wristIndex] of [[11, 13, 15], [12, 14, 16]]) {
    const shoulder = pose[shoulderIndex];
    const elbow = pose[elbowIndex];
    const wrist = pose[wristIndex];
    if (!visible(shoulder) || !visible(elbow) || !visible(wrist)) continue;
    const angle = elbowAngle(shoulder, elbow, wrist);
    if (angle !== null && angle < THRESHOLDS.elbowBendDegrees && shoulder.y - wrist.y > 0.06 && Math.abs(elbow.x - shoulder.x) > 0.06) return true;
  }
  return false;
}

export function headYawDegrees(matrix?: readonly number[]) { return matrix && matrix.length >= 10 ? Math.asin(clamp(matrix[8])) * 180 / Math.PI : null; }
export function headPitchDegrees(matrix?: readonly number[]) { return matrix && matrix.length >= 10 ? Math.asin(clamp(-matrix[9])) * 180 / Math.PI : null; }

/**
 * Estimate yaw from landmarks in the coordinate system users see. Camera
 * frames are mirrored by the preview, so negate the image-space nose offset.
 * This avoids relying on platform-specific transformation-matrix handedness.
 */
export function displayedFaceYawDegrees(face: Point[]) {
  const nose = face[1];
  const leftEye = face[33];
  const rightEye = face[263];
  if (!nose || !leftEye || !rightEye) return null;
  const eyeDistance = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (eyeDistance < 1e-6) return null;
  const eyeMidpoint = { x: average(leftEye.x, rightEye.x), y: average(leftEye.y, rightEye.y) };
  const imageOffset = (nose.x - eyeMidpoint.x) / eyeDistance;
  return Math.atan(-imageOffset) * 180 / Math.PI;
}

export function classifyDetection(input: DetectionInput): Candidate {
  const faceExpression = classifyFace(input.blendshapes);
  if (faceExpression) return faceExpression;
  const headCenter = center(input.face);
  const mouth = input.face[13] ?? null;
  const specificHand = classifySpecificHands(input.hands, headCenter, mouth);
  if (specificHand) return specificHand;
  const pairedHands = classifyTwoHands(input.hands, headCenter, mouth);
  if (pairedHands) return pairedHands;
  if (detectCrossArms(input.pose)) return { id: 'cross-arms', confidence: 0.7 };
  if (detectBicep(input.pose)) return { id: 'bicep', confidence: 0.6 };
  if (input.hands.length === 2) return { id: 'two-hands', confidence: 0.5 };
  const yaw = displayedFaceYawDegrees(input.face) ?? headYawDegrees(input.facialTransformationMatrix);
  if (yaw !== null && yaw > THRESHOLDS.yawDegrees) return { id: 'side-eye-right' as GestureId, confidence: yaw / 90 };
  if (yaw !== null && yaw < -THRESHOLDS.yawDegrees) return { id: 'side-eye-left' as GestureId, confidence: -yaw / 90 };
  return defaultCandidate;
}
