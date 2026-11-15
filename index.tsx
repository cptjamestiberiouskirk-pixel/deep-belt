import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';

// Fonts are bundled with the game so it needs no network access to look right.
// Only the weights the game uses are included.
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/jetbrains-mono/700.css';

const root = createRoot(document.getElementById('root')!);

root.render(
  <div
    style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
    <App />
  </div>,
);
