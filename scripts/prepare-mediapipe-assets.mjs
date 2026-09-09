import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(projectRoot, 'public');
const wasmSource = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDestination = path.join(publicRoot, 'wasm');
const minimumModelSize = 1024 * 1024;
const models = [
  {
    name: 'face landmarker',
    fileName: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  },
  {
    name: 'hand landmarker',
    fileName: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    sha256: 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1',
  },
  {
    name: 'pose landmarker lite',
    fileName: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  },
];

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function checksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function validateModel(model, bytes) {
  if (bytes.byteLength < minimumModelSize) {
    throw new Error(`${model.name} model is unexpectedly small (${bytes.byteLength} bytes).`);
  }

  const actualChecksum = checksum(bytes);
  if (actualChecksum !== model.sha256) {
    throw new Error(`${model.name} model checksum did not match the pinned asset (${actualChecksum}).`);
  }
}

async function copyWasmFiles() {
  if (!(await exists(wasmSource))) {
    throw new Error('MediaPipe WASM files are missing. Run npm install before preparing assets.');
  }

  await mkdir(wasmDestination, { recursive: true });
  const files = (await readdir(wasmSource)).filter((file) => file.endsWith('.js') || file.endsWith('.wasm'));

  await Promise.all(files.map((file) => copyFile(path.join(wasmSource, file), path.join(wasmDestination, file))));
  console.log(`Copied ${files.length} MediaPipe WASM runtime files to public/wasm.`);
}

async function downloadModel(model) {
  const destination = path.join(publicRoot, 'models', model.fileName);

  if (await exists(destination)) {
    const existingModel = await stat(destination);
    if (existingModel.size >= minimumModelSize) {
      validateModel(model, await readFile(destination));
      console.log(`Using existing pinned ${model.name} model (${existingModel.size} bytes).`);
      return;
    }
    await unlink(destination);
  }

  console.log(`Downloading pinned ${model.name} model from ${model.url}`);
  const response = await fetch(model.url);
  if (!response.ok) {
    throw new Error(`Could not download the ${model.name} model: ${response.status} ${response.statusText}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  validateModel(model, bytes);

  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryDestination = `${destination}.tmp`;
  await writeFile(temporaryDestination, bytes);
  await rename(temporaryDestination, destination);
  console.log(`Saved ${model.fileName} (${bytes.byteLength} bytes, sha256 ${model.sha256}).`);
}

try {
  await copyWasmFiles();
  for (const model of models) {
    await downloadModel(model);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
