import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Buffer } from 'buffer';
import { App } from './ui/App';
import { LiveProvider } from './ui/live';
import { Landing } from './ui/Landing';
import { PrivySignPage } from './ui/PrivySignPage';
import './styles.css';

Object.assign(globalThis,{Buffer});
const isPublicSite = !location.pathname.startsWith('/app') && location.pathname !== '/docs';
const content=location.pathname==='/sign'?<PrivySignPage/>:<LiveProvider>{isPublicSite ? <Landing /> : <App />}</LiveProvider>;
createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
