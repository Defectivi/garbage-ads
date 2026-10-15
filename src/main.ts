import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/libre-caslon-display/latin-400.css';
import './styles/main.css';
import { Game } from './game/Game';
import { newState } from './game/GameState';
import { randomSeed, worldSpec } from './game/GameConfig';
import { Renderer } from './rendering/Renderer';
import { App } from './ui/App';
try {
  const game = new Game(newState(worldSpec(randomSeed())));
  const renderer = new Renderer(document.getElementById('game')!, game);
  const app = new App(game, renderer); app.start();
  if (import.meta.env.DEV) Object.assign(window, { __frostbound: app });
} catch (error) {
  const root = document.getElementById('interface')!; root.className = 'error-screen';
  const heading = document.createElement('h1'); heading.textContent = 'The wilderness could not load.';
  const message = document.createElement('p'); message.textContent = error instanceof Error ? error.message : String(error); root.replaceChildren(heading, message);
}
