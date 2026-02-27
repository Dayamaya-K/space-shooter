# 90s Space Shooter

A simple, mobile-friendly retro 90s pixel art space shooter game. Built with vanilla HTML, CSS, and JavaScript.

## Features

*   **Retro 90s Aesthetic:** Procedurally generated pixel art, arcade font, and subtle CRT scanlines.
*   **Web Audio API:** Synthesized dynamic sound effects for shooting and explosions—no external audio files required.
*   **Mobile-First Controls:** Responsive canvas sizing with virtual touch controls for minimal latency and multi-touch support.
*   **Dynamic Gameplay:** Enemy spawn rates increase as your score goes up to gradually increase difficulty.
*   **Health System:** You have 10 hearts. You lose a heart if an alien flies past you or if their lasers hit you. Crashing into an alien will destroy them but also cost you a heart.
*   **Zero Dependencies:** The whole project consists of three static files (`index.html`, `style.css`, `game.js`). No build steps or heavy node modules needed.

## Playing Locally

Since all resources are generated programmatically by the code itself, simply download the repository and open the `index.html` file in your modern browser of choice.

## Deploying to GitHub Pages

1. Create a repository on GitHub and commit `index.html`, `style.css`, and `game.js`.
2. Go to your repository settings.
3. Select "Pages" on the left menu.
4. Set the Source to deploy from a branch and select the `main` branch.
5. Save. Your retro game is now hosted online!

## Tech Stack

*   **HTML5 Canvas:** Defines the frame to render all game sprites and text elements.
*   **CSS3:** Powers the styling of the UI overlays and the CRT monitor-like effects.
*   **Vanilla JS (ES6+):** Manages the game loop (`requestAnimationFrame`), input, physics, collision detection, and procedural pixel art generating logic.
