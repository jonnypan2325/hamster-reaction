import { useState } from 'react';

type Gesture = {
  id: string;
  label: string;
  prompt: string;
  image: string;
};

const gestures: readonly Gesture[] = [
  { id: 'default', label: 'Neutral', prompt: 'Relax and return to the default hamster.', image: 'default.jpg' },
  { id: 'thumbs-up', label: 'Thumbs up', prompt: 'Hold a thumbs-up away from your face.', image: 'thumbs-up.jpg' },
  { id: 'thumbs-down', label: 'Thumbs down', prompt: 'Point your thumb down.', image: 'thumbs-down.jpg' },
  { id: 'side-eye', label: 'Side eye', prompt: 'Turn your head to either side.', image: 'side-eye.jpg' },
  { id: 'startled', label: 'Startled', prompt: 'Open your eyes wide and raise your eyebrows.', image: 'startled.jpg' },
  { id: 'drooling', label: 'Drooling', prompt: 'Open your mouth wide.', image: 'drooling.jpg' },
  { id: 'silly', label: 'Silly', prompt: 'Stick your tongue out.', image: 'silly.jpg' },
  { id: 'fist-by-head', label: 'Fist by head', prompt: 'Hold a curled fist beside your head.', image: 'fist-by-head.webp' },
  { id: 'two-hands', label: 'Two hands', prompt: 'Show both hands to the camera.', image: 'two-hands.jpg' },
  { id: 'glasses', label: 'Glasses', prompt: 'Make a pinch close to your face.', image: 'glasses.jpg' },
  { id: 'bicep', label: 'Bicep', prompt: 'Flex with your wrist above your shoulder.', image: 'bicep.jpg' },
  { id: 'cross-arms', label: 'Cross arms', prompt: 'Cross your arms at chest height.', image: 'cross-arms.jpg' },
  { id: 'finger-mouth', label: 'Finger at mouth', prompt: 'Place one pointing finger near your mouth.', image: 'finger-mouth.jpg' },
  { id: 'nerd', label: 'One finger', prompt: 'Raise one pointing finger.', image: 'nerd.jpg' },
  { id: 'thinking', label: 'Thinking', prompt: 'Clasp your hands close to your mouth.', image: 'thinking.jpg' },
  { id: 'hug', label: 'Hug', prompt: 'Clasp your hands at chest height.', image: 'hug.jpg' },
  { id: 'sad', label: 'Sad', prompt: 'Tilt your head down.', image: 'sad.jpg' },
];

function imageUrl(fileName: string): string {
  return new URL(`hamsters/${fileName}`, document.baseURI).toString();
}

export default function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const neutral = gestures[0];

  return (
    <main className="page-shell" id="top">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="HamsterReact home">HamsterReact</a>
        <a className="portfolio-link" href="https://jonathanpan.me">Jonathan Pan ↗</a>
      </header>

      <section className="studio" aria-label="Hamster reaction studio">
        <article className="panel hamster-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Hamster response</p>
            <span className="gesture-pill">{neutral.label}</span>
          </div>
          <div className="media-frame hamster-frame">
            <img src={imageUrl(neutral.image)} alt="The neutral hamster response" />
          </div>
        </article>

        <article className="panel camera-panel">
          <div className="panel-heading">
            <p className="panel-kicker">Your camera</p>
            <span className="camera-state"><i aria-hidden="true" />Not connected</span>
          </div>
          <div className="camera-actions">
            <button type="button" disabled title="Camera controls will be available when the browser connection is ready.">Start camera</button>
            <button type="button" className="secondary-button" disabled>Stop</button>
          </div>
          <div className="media-frame camera-frame">
            <div className="camera-placeholder" aria-hidden="true">
              <span className="camera-glyph">⌁</span>
              <p>Camera preview</p>
            </div>
          </div>
          <p className="camera-note">Camera connection will be available here shortly. No video is being captured.</p>
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
            <strong id="guide-title">Seventeen ways to meet the hamster</strong>
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
        <p>Built for the browser. Recognition will run locally on your device.</p>
        <a href="https://jonathanpan.me">More from Jonathan Pan ↗</a>
      </footer>
    </main>
  );
}
