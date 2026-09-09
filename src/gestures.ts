export type GestureId =
  | 'default' | 'thumbs-up' | 'thumbs-down' | 'side-eye-right' | 'side-eye-left' | 'startled' | 'drooling' | 'silly'
  | 'fist-by-head' | 'two-hands' | 'glasses' | 'bicep' | 'cross-arms' | 'finger-mouth'
  | 'nerd' | 'thinking' | 'hug' | 'sad' | 'smile';

export type Gesture = { id: GestureId; label: string; prompt: string; image: string };

export const gestures: readonly Gesture[] = [
  { id: 'default', label: 'just a hammy', prompt: 'Relax and return to the default hamster.', image: 'default.jpg' },
  { id: 'thumbs-up', label: 'yasssss', prompt: 'Hold a thumbs-up away from your face.', image: 'thumbs-up.jpg' },
  { id: 'thumbs-down', label: 'NO', prompt: 'Point your thumb down.', image: 'thumbs-down.jpg' },
  { id: 'side-eye-right', label: 'side eye', prompt: 'Turn your head to the right.', image: 'side-eye-right.jpg' },
  { id: 'side-eye-left', label: 'side eye', prompt: 'Turn your head to the left.', image: 'side-eye-left.jpg' },
  { id: 'startled', label: 'wtf', prompt: 'Raise your eyebrows high.', image: 'startled.jpg' },
  { id: 'drooling', label: 'ehhhhhh', prompt: 'Open your mouth wide.', image: 'drooling.jpg' },
  { id: 'silly', label: 'freaky', prompt: 'Pucker your lips and open your mouth.', image: 'silly.jpg' },
  { id: 'fist-by-head', label: 'jolly', prompt: 'Hold a curled fist beside your head.', image: 'fist-by-head.webp' },
  { id: 'two-hands', label: 'i surrender', prompt: 'Show both hands to the camera.', image: 'two-hands.jpg' },
  { id: 'glasses', label: 'discord mod', prompt: 'Make a pinch close to your face.', image: 'glasses.jpg' },
  { id: 'bicep', label: 'mooscles', prompt: 'Flex with your wrist above your shoulder.', image: 'bicep.jpg' },
  { id: 'cross-arms', label: 'death', prompt: 'Cross your arms at chest height.', image: 'cross-arms.jpg' },
  { id: 'finger-mouth', label: 'hmmmmmm', prompt: 'Place one pointing finger near your mouth.', image: 'finger-mouth.jpg' },
  { id: 'nerd', label: 'nerdy', prompt: 'Raise one pointing finger.', image: 'nerd.jpg' },
  { id: 'thinking', label: 'pondering', prompt: 'Clasp your hands close to your mouth.', image: 'thinking.jpg' },
  { id: 'hug', label: 'baby', prompt: 'Clasp your hands at chest height.', image: 'hug.jpg' },
  { id: 'sad', label: 'crine', prompt: 'Frown.', image: 'sad.jpg' },
  { id: 'smile', label: 'HAHAHAHA', prompt: 'Smile broadly.', image: 'smile.jpg' },
];

export const gestureById = Object.fromEntries(gestures.map((gesture) => [gesture.id, gesture])) as Record<GestureId, Gesture>;
