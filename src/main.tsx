import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';
// Side-effect import: bootstraps the glasses/HUD layer in the same bundle.
// The two layers never import each other; they share state via `./app/store`.
import './glasses-main';

createRoot(document.getElementById('root')!).render(<App />);
