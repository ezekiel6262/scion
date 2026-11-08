import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { LiveProvider } from './ui/live';
import { Landing } from './ui/Landing';
import './styles.css';

const isPublicSite = !location.pathname.startsWith('/app') && location.pathname !== '/docs';
createRoot(document.getElementById('root')!).render(<StrictMode><LiveProvider>{isPublicSite ? <Landing /> : <App />}</LiveProvider></StrictMode>);
