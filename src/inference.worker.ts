/// <reference lib="webworker" />

import { FaceLandmarker, FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { classifyDetection, headPitchDegrees, headYawDegrees, type Point } from './classify';

type InitMessage = { type: 'init'; generation: number; assetBaseUrl: string };
type FrameMessage = { type: 'frame'; generation: number; timestamp: number; bitmap: ImageBitmap };
type WorkerMessage = InitMessage | FrameMessage;

let faceLandmarker: FaceLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let readyGeneration = -1;
let initialization: Promise<void> | null = null;
let lastInferenceAt = 0;

const worker = self as DedicatedWorkerGlobalScope;
const asPoints = (points: readonly Point[][]) => points.map((landmarks) => [...landmarks]);
const assetUrl = (baseUrl: string, path: string) => new URL(path, baseUrl).toString();

async function initialize(message: InitMessage) {
  readyGeneration = -1;
  const wasmBase = assetUrl(message.assetBaseUrl, 'wasm/');
  const vision = await FilesetResolver.forVisionTasks(wasmBase);
  const options = { runningMode: 'VIDEO' as const };
  [faceLandmarker, handLandmarker, poseLandmarker] = await Promise.all([
    FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: assetUrl(message.assetBaseUrl, 'models/face_landmarker.task') },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      numFaces: 1,
      minFaceDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    }),
    HandLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: assetUrl(message.assetBaseUrl, 'models/hand_landmarker.task') },
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    }),
    PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: assetUrl(message.assetBaseUrl, 'models/pose_landmarker_lite.task') },
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
  ]);
  readyGeneration = message.generation;
  worker.postMessage({ type: 'ready', generation: message.generation });
}

function blendshapeScores(categories: readonly { categoryName: string; score: number }[]) {
  return Object.fromEntries(categories.map((category) => [category.categoryName, category.score]));
}

async function infer(message: FrameMessage) {
  try {
    if (message.generation !== readyGeneration || !faceLandmarker || !handLandmarker || !poseLandmarker) return;
    const faceResult = faceLandmarker.detectForVideo(message.bitmap, message.timestamp);
    const handResult = handLandmarker.detectForVideo(message.bitmap, message.timestamp);
    const poseResult = poseLandmarker.detectForVideo(message.bitmap, message.timestamp);
    const face = faceResult.faceLandmarks[0] ?? [];
    const hands = asPoints(handResult.landmarks);
    const pose = poseResult.landmarks[0] ?? [];
    const blendshapes = blendshapeScores(faceResult.faceBlendshapes[0]?.categories ?? []);
    const facialTransformationMatrix = faceResult.facialTransformationMatrixes[0]?.data;
    const candidate = classifyDetection({
      blendshapes,
      face,
      hands,
      pose,
      facialTransformationMatrix,
    });
    const now = performance.now();
    const inferenceRate = lastInferenceAt ? 1000 / (now - lastInferenceAt) : 0;
    lastInferenceAt = now;
    worker.postMessage({
      type: 'result',
      generation: message.generation,
      timestamp: message.timestamp,
      candidate,
      debug: { face, hands, pose, yawDegrees: headYawDegrees(facialTransformationMatrix), pitchDegrees: headPitchDegrees(facialTransformationMatrix), inferenceRate },
    });
  } catch (error) {
    worker.postMessage({ type: 'error', generation: message.generation, message: error instanceof Error ? error.message : 'Recognition failed.' });
  } finally {
    message.bitmap.close();
  }
}

worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === 'init') {
    initialization = initialize(message).catch((error) => {
      worker.postMessage({ type: 'error', generation: message.generation, message: error instanceof Error ? error.message : 'Could not initialize recognition.' });
    });
    return;
  }
  void (initialization ? initialization.then(() => infer(message)) : infer(message));
});
