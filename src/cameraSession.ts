export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable' | 'busy' | 'error';

export type CameraState = {
  status: CameraStatus;
  message: string;
};

export type CameraTrack = Pick<MediaStreamTrack, 'stop'>;

export type CameraStream = {
  getTracks: () => CameraTrack[];
};

type CameraControllerOptions = {
  requestStream: () => Promise<CameraStream>;
  onState: (state: CameraState) => void;
  onStream: (stream: CameraStream | null) => void;
};

const idleState: CameraState = {
  status: 'idle',
  message: 'Camera is off. No video is being captured.',
};

export function cameraFailure(error: unknown): CameraState {
  const name = error instanceof DOMException ? error.name : typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { status: 'denied', message: 'Camera permission was denied. Allow access and try again.' };
  }

  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { status: 'unavailable', message: 'No suitable camera was found.' };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { status: 'busy', message: 'Camera is busy. Close any other app using it and try again.' };
  }

  return { status: 'error', message: 'Camera could not be started. Please try again.' };
}

export class CameraController {
  #generation = 0;
  #stream: CameraStream | null = null;
  #requestStream: () => Promise<CameraStream>;
  #onState: (state: CameraState) => void;
  #onStream: (stream: CameraStream | null) => void;

  constructor({ requestStream, onState, onStream }: CameraControllerOptions) {
    this.#requestStream = requestStream;
    this.#onState = onState;
    this.#onStream = onStream;
  }

  async start() {
    const generation = ++this.#generation;
    this.#stopActiveStream();
    this.#onStream(null);
    this.#onState({ status: 'starting', message: 'Requesting camera access…' });

    try {
      const stream = await this.#requestStream();
      if (generation !== this.#generation) {
        stopStream(stream);
        return;
      }

      this.#stream = stream;
      this.#onStream(stream);
      this.#onState({ status: 'ready', message: 'Camera connected. Video stays in this browser.' });
    } catch (error) {
      if (generation === this.#generation) {
        this.#onState(cameraFailure(error));
      }
    }
  }

  stop() {
    ++this.#generation;
    this.#stopActiveStream();
    this.#onStream(null);
    this.#onState(idleState);
  }

  dispose() {
    ++this.#generation;
    this.#stopActiveStream();
    this.#onStream(null);
  }

  #stopActiveStream() {
    if (this.#stream) {
      stopStream(this.#stream);
      this.#stream = null;
    }
  }
}

export function stopStream(stream: CameraStream) {
  stream.getTracks().forEach((track) => track.stop());
}

export const idleCameraState = idleState;
