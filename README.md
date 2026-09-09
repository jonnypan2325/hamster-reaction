# Hamster Reaction

Hamster Reaction is a small camera experiment: make a face, hand, or body gesture and the app chooses a matching hamster image.

Camera frames and recognition stay on the device. The app uses MediaPipe in a browser worker; it does not upload video, save frames, or use a server for inference. Camera access starts only after you press **Start camera**, and stopping the camera stops analysis.

## Run locally

Requirements: Node.js 22.13+ (or a later supported version) and npm.

```sh
npm install
npm run prepare:mediapipe-assets
npm run dev
```

Open the local URL printed by Vite and allow camera access. `prepare:mediapipe-assets` copies the MediaPipe WASM runtime and downloads the pinned face, hand, and pose models into `public/`; run it after a fresh install and whenever those assets are missing.

Useful checks and production commands:

```sh
npm run build       # typecheck and create dist/
npm test            # run the test suite
npm run check       # typecheck, lint, and test
npm run preview     # serve dist/ locally
```

## Gesture mappings

| Gesture | Action |
| --- | --- |
| Neutral | Relax and return to the default hamster |
| Thumbs up | Hold a thumbs-up away from your face |
| Teeth showing | Smile broadly and show your teeth |
| Thumbs down | Point your thumb down |
| Side eye | Turn your head to either side |
| Startled | Raise your eyebrows high. |
| Drooling | Open your mouth wide |
| Silly | Pucker your lips and open your mouth. |
| Fist by head | Hold a curled fist beside your head |
| Two hands | Show both hands to the camera |
| Glasses | Make a pinch close to your face |
| Bicep | Flex with your wrist above your shoulder |
| Cross arms | Cross your arms at chest height |
| Finger at mouth | Place one pointing finger near your mouth |
| One finger | Raise one pointing finger |
| Thinking | Clasp your hands close to your mouth |
| Hug | Clasp your hands at chest height |
| Sad | Tilt your head down |

## GitHub Pages

The repository already includes `.github/workflows/deploy-pages.yml`. Enable **Settings → Pages → Source: GitHub Actions** to use it. The workflow prepares assets, runs checks, builds the site, and deploys it to GitHub Pages.

The Vite config uses relative asset URLs, so the same build works for a user or organization Pages site and a project Pages site.

## Optional Vercel deployment

Import the repository into Vercel as a Vite project. Use:

- Build command: `npm run prepare:mediapipe-assets && npm run build`
- Output directory: `dist`
- Install command: `npm ci`

This is a static deployment; no Vercel serverless function is required. The asset preparation step needs network access during the build to fetch the pinned MediaPipe models.

## Browser and device notes

Camera use requires permission and a secure context: HTTPS in deployment, or `localhost` during development. The browser must provide `getUserMedia`, Web Workers, `createImageBitmap`, and MediaPipe WASM support. Current desktop Chromium, Firefox, and Safari releases are the most reliable; older browsers and some embedded in-app browsers may not support all of these APIs.

Recognition runs continuously at roughly 20 frames per second when the camera is connected, so older phones may run warm or respond more slowly. Good lighting, a clear view of the face and hands, and enough distance for the full upper body improve results. The app stops the camera when its tab becomes hidden, and camera permissions or another app using the camera can prevent startup.

To tune recognition, edit the `THRESHOLDS` values in [`src/classify.ts`](src/classify.ts). The temporal confirmation behavior is in [`src/gestureStabilizer.ts`](src/gestureStabilizer.ts).
