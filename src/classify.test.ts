import { describe, expect, it } from 'vitest';
import { classifyDetection, classifyFace, fingersUp, headPitchDegrees, headYawDegrees, isPinch } from './classify';

type Point = { x: number; y: number; visibility?: number };
const point = (x = 0.5, y = 0.5, visibility = 1): Point => ({ x, y, visibility });
const input = (overrides: Partial<Parameters<typeof classifyDetection>[0]> = {}) => ({ blendshapes: {}, face: [], hands: [], pose: [], ...overrides });
const face = (x = 0.5, y = 0.3) => Array.from({ length: 14 }, () => point(x, y));
const matrix = (index: number, degrees: number) => { const values = Array.from({ length: 16 }, () => 0); values[index] = Math.sin(degrees * Math.PI / 180); return values; };
const centerOf = (points: Point[]) => point(points.reduce((sum, value) => sum + value.x, 0) / points.length, points.reduce((sum, value) => sum + value.y, 0) / points.length);

function hand(kind: 'fist' | 'thumb-up' | 'thumb-down' | 'pointer' | 'pinch', offset = 0): Point[] {
  const landmarks = Array.from({ length: 21 }, () => point(offset + 0.5, 0));
  landmarks[0] = point(offset, 0);
  landmarks[2] = point(offset + 0.5, 0);
  landmarks[5] = landmarks[9] = landmarks[13] = landmarks[17] = point(offset + 1, 0);
  landmarks[4] = point(offset + 0.6, 0);
  for (const tip of [8, 12, 16, 20]) landmarks[tip] = point(offset + 0.5, 0);
  if (kind === 'thumb-up') landmarks[4] = point(offset + 2, -0.5);
  if (kind === 'thumb-down') landmarks[4] = point(offset + 2, 0.5);
  if (kind === 'pointer') landmarks[8] = point(offset + 2, 0);
  if (kind === 'pinch') {
    landmarks[4] = point(offset + 0.1, 0);
    landmarks[8] = point(offset + 0.2, 0);
    landmarks[12] = point(offset + 2, 0);
  }
  return landmarks;
}

function crossArmsPose() {
  const pose = Array.from({ length: 25 }, () => point());
  pose[11] = point(0.35, 0.4); pose[12] = point(0.65, 0.4);
  pose[15] = point(0.47, 0.6); pose[16] = point(0.57, 0.6);
  pose[23] = point(0.4, 0.8); pose[24] = point(0.6, 0.8);
  return pose;
}

function bicepPose() {
  const pose = Array.from({ length: 25 }, () => point());
  pose[11] = point(0.5, 0.5); pose[13] = point(0.65, 0.5); pose[15] = point(0.65, 0.35);
  return pose;
}

describe('gesture classifier', () => {
  it('uses expression thresholds and precedence', () => {
    expect(classifyFace({ mouthPucker: 0.7, jawOpen: 0.9, browInnerUp: 0.8 })?.id).toBe('startled');
    expect(classifyFace({ browInnerUp: 0.7 })?.id).toBe('startled');
    expect(classifyFace({ browInnerUp: 0.699 })).toBeNull();
    expect(classifyFace({ mouthPucker: 0.25, jawOpen: 0.25 })?.id).toBe('silly');
    expect(classifyFace({ mouthPucker: 0.249, jawOpen: 0.9 })?.id).toBe('drooling');
    expect(classifyFace({ mouthPucker: 0.25, jawOpen: 0.249 })).toBeNull();
    expect(classifyFace({ mouthPucker: 0.249, mouthSmileLeft: 0.9, mouthSmileRight: 0.9 })?.id).toBe('teeth');
    expect(classifyFace({ mouthSmileLeft: 0.349, mouthSmileRight: 0.35, jawOpen: 0.349 })).toBeNull();
    expect(classifyFace({ mouthSmileLeft: 0.35, mouthSmileRight: 0.35, jawOpen: 0.35 })).toBeNull();
    expect(classifyFace({ mouthSmileLeft: 0.35, mouthSmileRight: 0.35, mouthPucker: 0.25, jawOpen: 0.25 })?.id).toBe('teeth');
    expect(classifyFace({ mouthPucker: 0.25, jawOpen: 0.5 })?.id).toBe('silly');
    expect(classifyFace({ jawOpen: 0.5 })?.id).toBe('drooling');
    expect(classifyFace({ mouthFrownLeft: 0.25, mouthFrownRight: 0.25 })?.id).toBe('sad');
    expect(classifyFace({ mouthFrownLeft: 0.25, mouthFrownRight: 0.249 })).toBeNull();
  });

  it('ports wrist-scale finger and pinch geometry including degenerate hands', () => {
    expect(fingersUp(hand('pointer'))).toEqual([false, true, false, false, false]);
    expect(isPinch(hand('pinch'))).toBe(true);
    expect(isPinch(Array.from({ length: 21 }, () => point(0, 0)))).toBe(false);
    expect(fingersUp([])).toBeNull();
  });

  it.each([
    ['thumbs-up', input({ hands: [hand('thumb-up')] })],
    ['thumbs-down', input({ hands: [hand('thumb-down')] })],
    ['glasses', (() => { const pinch = hand('pinch'); const center = centerOf(pinch); return input({ hands: [pinch], face: face(center.x, center.y) }); })()],
    ['nerd', input({ hands: [hand('pointer')] })],
    ['finger-mouth', input({ hands: [hand('pointer')], face: (() => { const value = face(); value[13] = hand('pointer')[8]; return value; })() })],
    ['thinking', input({ hands: [hand('fist', 0), hand('fist', 0.02)], face: face(0.586, 0) })],
    ['hug', input({ hands: [hand('fist', 0), hand('fist', 0.02)], face: face(0.586, -1) })],
    ['cross-arms', input({ pose: crossArmsPose() })],
    ['bicep', input({ pose: bicepPose() })],
    ['two-hands', input({ hands: [hand('fist', 0), hand('fist', 2)] })],
    ['sad', input({ blendshapes: { mouthFrownLeft: 0.25, mouthFrownRight: 0.25 } })],
    ['side-eye-right', input({ facialTransformationMatrix: matrix(8, 19) })],
    ['side-eye-left', input({ facialTransformationMatrix: matrix(8, -19) })],
    ['default', input()],
  ])('classifies %s in the specified priority chain', (gesture, value) => {
    expect(classifyDetection(value).id).toBe(gesture);
  });

  it('requires real face evidence for face-relative gestures and keeps fists ahead of thumbs', () => {
    expect(classifyDetection(input({ hands: [hand('pinch')] })).id).toBe('default');
    const head = face(0.7, 0);
    expect(classifyDetection(input({ hands: [hand('fist', 0.3)], face: head })).id).toBe('fist-by-head');
    expect(classifyDetection(input({ hands: [hand('thumb-up', 0.3)], face: head })).id).toBe('fist-by-head');
  });

  it('uses column-major matrix slots and face expressions before yaw', () => {
    expect(headYawDegrees(matrix(8, 18))).toBeCloseTo(18);
    expect(headPitchDegrees(matrix(9, -15))).toBeCloseTo(15);
    expect(classifyDetection(input({ facialTransformationMatrix: matrix(9, -15) })).id).toBe('default');
    const both = matrix(9, -20); both[8] = Math.sin(30 * Math.PI / 180);
    expect(classifyDetection(input({ blendshapes: { mouthFrownLeft: 0.25, mouthFrownRight: 0.25 }, facialTransformationMatrix: both })).id).toBe('sad');
    expect(classifyDetection(input({ facialTransformationMatrix: matrix(9, -20) })).id).toBe('default');
  });

  it('does not use invisible or non-chest pose landmarks', () => {
    const invisible = bicepPose();
    invisible[11].visibility = 0.49;
    expect(classifyDetection(input({ pose: invisible })).id).toBe('default');
    const aboveChest = crossArmsPose();
    aboveChest[15].y = aboveChest[16].y = 0.35;
    expect(classifyDetection(input({ pose: aboveChest })).id).toBe('default');
  });
});
