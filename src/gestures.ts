export type GestureId =
  | 'default' | 'thumbs-up' | 'thumbs-down' | 'side-eye-right' | 'side-eye-left' | 'startled' | 'drooling' | 'silly'
  | 'fist-by-head' | 'two-hands' | 'glasses' | 'bicep' | 'cross-arms' | 'finger-mouth'
  | 'nerd' | 'thinking' | 'hug' | 'sad' | 'teeth';

export type Gesture = { id: GestureId; label: string; prompt: string; image: string };

export const gestures: readonly Gesture[] = [
  { id: 'default', label: 'Neutral', prompt: 'Relax and return to the default hamster.', image: 'default.jpg' },
  { id: 'thumbs-up', label: 'Thumbs up', prompt: 'Hold a thumbs-up away from your face.', image: 'thumbs-up.jpg' },
  { id: 'thumbs-down', label: 'Thumbs down', prompt: 'Point your thumb down.', image: 'thumbs-down.jpg' },
  { id: 'side-eye-right', label: 'Side eye right', prompt: 'Turn your head to the right.', image: 'side-eye-right.jpg' },
  { id: 'side-eye-left', label: 'Side eye left', prompt: 'Turn your head to the left.', image: 'side-eye-left.jpg' },
  { id: 'startled', label: 'Startled', prompt: 'Raise your eyebrows high.', image: 'startled.jpg' },
  { id: 'drooling', label: 'Drooling', prompt: 'Open your mouth wide.', image: 'drooling.jpg' },
  { id: 'silly', label: 'Silly', prompt: 'Pucker your lips and open your mouth.', image: 'silly.jpg' },
  { id: 'fist-by-head', label: 'Fist by head', prompt: 'Hold a curled fist beside your head.', image: 'fist-by-head.webp' },
  { id: 'two-hands', label: 'Two hands', prompt: 'Show both hands to the camera.', image: 'two-hands.jpg' },
  { id: 'glasses', label: 'Glasses', prompt: 'Make a pinch close to your face.', image: 'glasses.jpg' },
  { id: 'bicep', label: 'Bicep', prompt: 'Flex with your wrist above your shoulder.', image: 'bicep.jpg' },
  { id: 'cross-arms', label: 'Cross arms', prompt: 'Cross your arms at chest height.', image: 'cross-arms.jpg' },
  { id: 'finger-mouth', label: 'Finger at mouth', prompt: 'Place one pointing finger near your mouth.', image: 'finger-mouth.jpg' },
  { id: 'nerd', label: 'One finger', prompt: 'Raise one pointing finger.', image: 'nerd.jpg' },
  { id: 'thinking', label: 'Thinking', prompt: 'Clasp your hands close to your mouth.', image: 'thinking.jpg' },
  { id: 'hug', label: 'Hug', prompt: 'Clasp your hands at chest height.', image: 'hug.jpg' },
  { id: 'sad', label: 'Sad', prompt: 'Frown.', image: 'sad.jpg' },
  { id: 'teeth', label: 'Teeth showing', prompt: 'Smile broadly and show your teeth.', image: 'teeth.jpg' },
];

export const gestureById = Object.fromEntries(gestures.map((gesture) => [gesture.id, gesture])) as Record<GestureId, Gesture>;
