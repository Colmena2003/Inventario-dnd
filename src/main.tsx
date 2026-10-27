import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CofreProvider } from './store/cofre';
import './styles/sistema.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CofreProvider>
      <App />
    </CofreProvider>
  </StrictMode>,
);
