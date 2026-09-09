import { describe, expect, it, vi } from 'vitest';
import { cameraFailure, CameraController, type CameraStream } from './cameraSession';

function createStream() {
  const stop = vi.fn();
  const stream: CameraStream = { getTracks: () => [{ stop }] };
  return { stop, stream };
}

describe('CameraController', () => {
  it('stops a stream that resolves after the request was cancelled', async () => {
    let resolveRequest: (stream: CameraStream) => void = () => undefined;
    const requestStream = vi.fn(() => new Promise<CameraStream>((resolve) => { resolveRequest = resolve; }));
    const onState = vi.fn();
    const onStream = vi.fn();
    const controller = new CameraController({ requestStream, onState, onStream });
    const { stop, stream } = createStream();

    const pendingStart = controller.start();
    controller.stop();
    resolveRequest(stream);
    await pendingStart;

    expect(stop).toHaveBeenCalledOnce();
    expect(onState).toHaveBeenLastCalledWith({ status: 'idle', message: 'Camera is off. No video is being captured.' });
    expect(onStream).not.toHaveBeenCalledWith(stream);
  });

  it('stops active camera tracks during disposal', async () => {
    const { stop, stream } = createStream();
    const controller = new CameraController({
      requestStream: async () => stream,
      onState: vi.fn(),
      onStream: vi.fn(),
    });

    await controller.start();
    controller.dispose();

    expect(stop).toHaveBeenCalledOnce();
  });

  it('explains permission, unavailable, and busy camera failures', () => {
    expect(cameraFailure({ name: 'NotAllowedError' }).status).toBe('denied');
    expect(cameraFailure({ name: 'NotFoundError' }).status).toBe('unavailable');
    expect(cameraFailure({ name: 'NotReadableError' }).status).toBe('busy');
  });
});
