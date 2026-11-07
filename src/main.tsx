import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { LiveProvider } from './ui/live';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><LiveProvider><App /></LiveProvider></StrictMode>);
