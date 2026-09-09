import { useEffect, useRef, useState } from 'react';
import { CameraController, type CameraState, idleCameraState } from './cameraSession';
import { gestureById, gestures, type GestureId } from './gestures';
import type { Point } from './classify';
import { GestureStabilizer } from './gestureStabilizer';

function imageUrl(fileName: string): string {
  return new URL(`hamsters/${fileName}`, document.baseURI).toString();
}

type DebugLandmarks = {
  face: Point[];
  hands: Point[][];
  pose: Point[];
  yawDegrees: number | null;
  pitchDegrees: number | null;
  inferenceRate: number;
  blendshapes: {
    mouthPucker: number;
    eyeWideLeft: number;
    eyeWideRight: number;
    browRaised: number;
    mouthSmileLeft: number;
    mouthSmileRight: number;
    mouthFrownLeft: number;
    mouthFrownRight: number;
    jawOpen: number;
  };
};

function drawDebugOverlay(canvas: HTMLCanvasElement, debug: DebugLandmarks, sourceWidth: number, sourceHeight: number) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext('2d');
  if (!context || !width || !height || !sourceWidth || !sourceHeight) return;
  context.clearRect(0, 0, width, height);
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (width - renderedWidth) / 2;
  const offsetY = (height - renderedHeight) / 2;
  const drawPoints = (points: Point[], color: string, radius: number) => {
    context.fillStyle = color;
    for (const point of points) {
      context.beginPath();
      context.arc(offsetX + point.x * renderedWidth, offsetY + point.y * renderedHeight, radius, 0, Math.PI * 2);
      context.fill();
    }
  };
  drawPoints(debug.face, '#0e6ba8', 1.5);
  debug.hands.forEach((hand) => drawPoints(hand, '#c75a41', 2));
  drawPoints(debug.pose, '#2f9c65', 2);
}

export default function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [camera, setCamera] = useState<CameraState>(idleCameraState);
  const [rawGestureId, setRawGestureId] = useState<GestureId>('default');
  const [stableGestureId, setStableGestureId] = useState<GestureId>('default');
  const [gestureStabilizer] = useState(() => new GestureStabilizer());
  const [recognitionMessage, setRecognitionMessage] = useState('Recognition starts when the camera is connected.');
  const [recognitionStatus, setRecognitionStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('idle');
  const [showDebug, setShowDebug] = useState(false);
  const [debugMetrics, setDebugMetrics] = useState<Pick<DebugLandmarks, 'yawDegrees' | 'pitchDegrees' | 'inferenceRate' | 'blendshapes'> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const inferenceGenerationRef = useRef(0);
  const activeGesture = gestureById[stableGestureId];

  useEffect(() => {
    const cameraController = new CameraController({
      requestStream: () => navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'user' } },
      }),
      onState: (nextCamera) => {
        if (nextCamera.status !== 'ready') ++inferenceGenerationRef.current;
        setCamera(nextCamera);
        setRecognitionStatus(nextCamera.status === 'ready' ? 'initializing' : 'idle');
        if (nextCamera.status !== 'ready') {
          setRawGestureId('default');
          setStableGestureId(gestureStabilizer.reset());
          setDebugMetrics(null);
          const context = overlayRef.current?.getContext('2d');
          if (context && overlayRef.current) context.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        }
      },
      onStream: (stream) => {
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream as MediaStream | null;
        if (stream) void video.play().catch(() => undefined);
      },
    });
    cameraControllerRef.current = cameraController;
    const stopCameraWhenHidden = () => {
      if (document.hidden) cameraController.stop();
    };

    document.addEventListener('visibilitychange', stopCameraWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', stopCameraWhenHidden);
      cameraController.dispose();
      cameraControllerRef.current = null;
    };
  }, [gestureStabilizer]);

  function startCamera() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamera({ status: 'unavailable', message: 'Camera access is unavailable in this browser.' });
      return;
    }
    setRecognitionMessage('Recognition is initializing locally…');
    void cameraControllerRef.current?.start();
  }

  function stopCamera() {
    setRecognitionMessage('');
    cameraControllerRef.current?.stop();
  }

  useEffect(() => {
    if (camera.status !== 'ready') return;

    const generation = inferenceGenerationRef.current + 1;
    inferenceGenerationRef.current = generation;
    const worker = new Worker(new URL('./inference.worker.ts', import.meta.url), { type: 'module' });
    let isAlive = true;
    let isReady = false;
    let isInFlight = false;
    let hasFailed = false;
    let lastFrameAt = 0;
    let frameHandle = 0;

    worker.onmessage = (event: MessageEvent<{ type: string; generation: number; timestamp?: number; candidate?: { id: GestureId }; debug?: DebugLandmarks; message?: string }>) => {
      const message = event.data;
      if (!isAlive || message.generation !== generation || message.generation !== inferenceGenerationRef.current) return;
      if (message.type === 'ready') {
        isReady = true;
        setRecognitionStatus('ready');
        setRecognitionMessage('');
        return;
      }
      if (message.type === 'result') {
        isInFlight = false;
        if (message.candidate) {
          setRawGestureId(message.candidate.id);
          setStableGestureId(gestureStabilizer.observe(message.candidate.id, message.timestamp ?? performance.now()));
        }
        if (message.debug) setDebugMetrics(message.debug);
        const video = videoRef.current;
        const overlay = overlayRef.current;
        if (video && overlay && message.debug) {
          if (overlay.width !== video.clientWidth || overlay.height !== video.clientHeight) {
            overlay.width = video.clientWidth;
            overlay.height = video.clientHeight;
          }
          drawDebugOverlay(overlay, message.debug, video.videoWidth, video.videoHeight);
        }
        return;
      }
      if (message.type === 'error') {
        fail(message.message ?? 'Recognition is unavailable.');
      }
    };

    const fail = (message: string) => {
      if (hasFailed || !isAlive) return;
      hasFailed = true;
      isReady = false;
      isInFlight = false;
      setRecognitionStatus('error');
      cancelAnimationFrame(frameHandle);
      worker.terminate();
      setRawGestureId('default');
      setStableGestureId(gestureStabilizer.reset());
      setDebugMetrics(null);
      const overlay = overlayRef.current;
      const context = overlay?.getContext('2d');
      if (overlay && context) context.clearRect(0, 0, overlay.width, overlay.height);
      setRecognitionMessage(message);
    };
    worker.onerror = () => fail('Recognition is unavailable in this browser.');
    worker.onmessageerror = () => fail('Recognition could not read a camera frame.');

    worker.postMessage({ type: 'init', generation, assetBaseUrl: document.baseURI });
    const requestFrame = (now: number) => {
      const video = videoRef.current;
      if (isAlive && !hasFailed && isReady && !isInFlight && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastFrameAt >= 50) {
        isInFlight = true;
        lastFrameAt = now;
        void createImageBitmap(video).then((bitmap) => {
          if (!isAlive) {
            bitmap.close();
            return;
          }
          try {
            worker.postMessage({ type: 'frame', generation, timestamp: performance.now(), bitmap }, [bitmap]);
          } catch {
            bitmap.close();
            fail('Recognition could not send a camera frame.');
          }
        }).catch(() => { isInFlight = false; });
      }
      if (isAlive && !hasFailed) frameHandle = requestAnimationFrame(requestFrame);
    };
    frameHandle = requestAnimationFrame(requestFrame);
    return () => {
      isAlive = false;
      if (inferenceGenerationRef.current === generation) ++inferenceGenerationRef.current;
      cancelAnimationFrame(frameHandle);
      worker.terminate();
    };
  }, [camera.status, gestureStabilizer]);

  const previewVisible = camera.status === 'ready' && recognitionStatus === 'ready';
  const cameraPlaceholderMessage = camera.status === 'ready'
    ? recognitionStatus === 'error' ? 'Recognition unavailable' : recognitionStatus === 'initializing' ? 'Preparing camera and running the hamster wheel' : 'Camera preview'
    : 'Camera preview';

  return (
    <main className="page-shell" id="top">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Hamster Reaction home">Hamster Reaction</a>
      </header>

      <section className="studio" aria-label="Hamster reaction studio">
        <article className="panel hamster-panel">
          <div className="panel-heading">
            <p className="panel-kicker">The hamster is</p>
            <span className="gesture-pill">{camera.status === 'ready' ? activeGesture.label : gestureById.default.label}</span>
          </div>
          <div className="media-frame hamster-frame">
            <img src={imageUrl(camera.status === 'ready' ? activeGesture.image : gestureById.default.image)} alt={`The ${(camera.status === 'ready' ? activeGesture : gestureById.default).label.toLowerCase()} hamster response`} />
          </div>
        </article>

        <article className="panel camera-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Your camera</p>
            <span className={`camera-state camera-state--${camera.status}`}><i aria-hidden="true" />{camera.status === 'ready' ? 'Connected' : camera.status === 'starting' ? 'Connecting' : 'Not connected'}</span>
          </div>
          <div className="camera-actions">
            <button type="button" onClick={startCamera} disabled={camera.status === 'starting' || camera.status === 'ready'}>Start camera</button>
            <button type="button" className="secondary-button" onClick={stopCamera} disabled={camera.status !== 'starting' && camera.status !== 'ready'}>Stop</button>
            <button type="button" className="debug-button" onClick={() => setShowDebug((visible) => !visible)} aria-pressed={showDebug}>Landmarks</button>
          </div>
          <div className="media-frame camera-frame">
            <video className="camera-preview" ref={videoRef} autoPlay muted playsInline hidden={!previewVisible} aria-label="Camera preview" />
            <canvas className="landmark-overlay" ref={overlayRef} hidden={!showDebug || !previewVisible} aria-hidden="true" />
            <div className="camera-placeholder" hidden={previewVisible}>
              <span className="camera-glyph" aria-hidden="true">⌁</span>
              <p>{cameraPlaceholderMessage}</p>
            </div>
          </div>
          <p className="camera-note" aria-live="polite">{camera.message}</p>
          {recognitionMessage && <p className="recognition-note" aria-live="polite">{recognitionMessage}</p>}
          {showDebug && debugMetrics && (
            <p className="debug-readout">
              raw {gestureById[rawGestureId].label} · yaw {debugMetrics.yawDegrees?.toFixed(1) ?? 'n/a'}° · pitch {debugMetrics.pitchDegrees?.toFixed(1) ?? 'n/a'}° · {debugMetrics.inferenceRate.toFixed(1)} fps
              <br />
              pucker {debugMetrics.blendshapes.mouthPucker.toFixed(2)} · eyes {debugMetrics.blendshapes.eyeWideLeft.toFixed(2)}/{debugMetrics.blendshapes.eyeWideRight.toFixed(2)} · brow {debugMetrics.blendshapes.browRaised.toFixed(2)} · smile {debugMetrics.blendshapes.mouthSmileLeft.toFixed(2)}/{debugMetrics.blendshapes.mouthSmileRight.toFixed(2)} · frown {debugMetrics.blendshapes.mouthFrownLeft.toFixed(2)}/{debugMetrics.blendshapes.mouthFrownRight.toFixed(2)} · jaw {debugMetrics.blendshapes.jawOpen.toFixed(2)}
            </p>
          )}
        </article>
      </section>

      <section className="guide-section" aria-labelledby="guide-title">
        <button
          className="guide-toggle"
          type="button"
          aria-expanded={isGuideOpen}
          aria-controls="gesture-guide"
          onClick={() => setIsGuideOpen((open) => !open)}
        >
          <span>
            <span className="eyebrow">Gesture guide</span>
            <strong id="guide-title">Reactions</strong>
          </span>
          <span className="toggle-mark" aria-hidden="true">{isGuideOpen ? '−' : '+'}</span>
        </button>
        {isGuideOpen && (
          <div className="gesture-grid" id="gesture-guide">
            {gestures.map((gesture) => (
              <article className="gesture-card" key={gesture.id}>
                <img src={imageUrl(gesture.image)} alt="" />
                <div>
                  <h2>{gesture.label}</h2>
                  <p>{gesture.prompt}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        <a href="https://jonathanpan.me">Jonathan Pan</a>
      </footer>
    </main>
  );
}
