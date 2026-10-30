import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CofreProvider } from './store/cofre';
import { aplicarTemaGuardado } from './ui/Configuracion';
import './styles/tema.css';
import './styles/sistema.css';
import './styles/app.css';
import './styles/individual.css';
import './styles/monedas.css';
import './styles/editor.css';
import './styles/despensa.css';
import './styles/estadisticas.css';
import './styles/uso.css';
import './styles/biblioteca.css';
import './styles/dados.css';

aplicarTemaGuardado();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CofreProvider>
      <App />
    </CofreProvider>
  </StrictMode>,
);
