import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { LiveProvider } from './live';
import { StoreProvider } from './store';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

createRoot(root).render(
  <StrictMode>
    <StoreProvider>
      <LiveProvider>
        <App />
      </LiveProvider>
    </StoreProvider>
  </StrictMode>,
);
