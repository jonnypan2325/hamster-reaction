const CARD_WIDTH = 1400;
const CARD_HEIGHT = 920;
const CARD_PADDING = 48;
const CARD_GUTTER = 24;
const PANEL_RADIUS = 26;
const LABEL_GAP = 24;

type DrawSource = CanvasImageSource & {
  videoWidth?: number;
  videoHeight?: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

export type ReactionCardOptions = {
  hamsterImageSrc: string;
  hamsterLabel: string;
  video: HTMLVideoElement;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The hamster image could not be loaded.'));
    image.src = src;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawCover(context: CanvasRenderingContext2D, source: DrawSource, x: number, y: number, width: number, height: number, mirror = false) {
  const sourceWidth = source.videoWidth || source.naturalWidth || 0;
  const sourceHeight = source.videoHeight || source.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) throw new Error('The camera frame is not ready yet.');

  const sourceRatio = sourceWidth / sourceHeight;
  const destinationRatio = width / height;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;
  if (sourceRatio > destinationRatio) {
    cropWidth = sourceHeight * destinationRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / destinationRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.save();
  roundedRect(context, x, y, width, height, PANEL_RADIUS);
  context.clip();
  if (mirror) {
    context.translate(x + width, y);
    context.scale(-1, 1);
    context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, width, height);
  } else {
    context.drawImage(source, cropX, cropY, cropWidth, cropHeight, x, y, width, height);
  }
  context.restore();
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The card could not be encoded as a PNG.'));
    }, 'image/png');
  });
}

export async function createReactionCard({ hamsterImageSrc, hamsterLabel, video }: ReactionCardOptions): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('The camera frame is not ready yet.');
  }

  const hamsterImage = await loadImage(hamsterImageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Capture is unavailable in this browser.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = '#1c1917';
  context.font = '700 44px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(hamsterLabel, CARD_WIDTH / 2, CARD_PADDING + 22);

  const panelTop = CARD_PADDING + 44 + LABEL_GAP;
  const panelHeight = CARD_HEIGHT - panelTop - CARD_PADDING;
  const panelWidth = (CARD_WIDTH - CARD_PADDING * 2 - CARD_GUTTER) / 2;
  const left = CARD_PADDING;
  const right = left + panelWidth + CARD_GUTTER;

  context.fillStyle = '#f5f5f4';
  roundedRect(context, left, panelTop, panelWidth, panelHeight, PANEL_RADIUS);
  context.fill();
  roundedRect(context, right, panelTop, panelWidth, panelHeight, PANEL_RADIUS);
  context.fill();
  drawCover(context, hamsterImage, left, panelTop, panelWidth, panelHeight);
  drawCover(context, video, right, panelTop, panelWidth, panelHeight, true);
  return canvasToPng(canvas);
}

export function canShareReactionFile(file: File): boolean {
  try {
    return typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function isShareCanceled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}
