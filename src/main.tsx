import { createRoot } from 'react-dom/client';
import App from './page';
import './globals.css';
import './theme.css';
import './inventory.css';
import './operations.css';
import './stock-presets.css';
import './day-closing.css';

createRoot(document.getElementById('root')!).render(<App />);
