// Configuración de cada jugador: se guarda en su navegador y no viaja a la party, así que lo que cambia
// aquí solo lo ve él. De momento, el color del tema (src/styles/tema.css).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { UI } from './iconos';
import { Icono } from './piezas';

const CLAVE = 'cofre:tema';
/** Tono y saturación del oro original (#b89a55), del que se giran los demás. */
const TONO_ORO = 41.8;
const SAT_ORO = 41;

type Tema = { id: string; tono: number; sat: number };

const TEMAS: (Tema & { nombre: string })[] = [
  { id: 'oro', nombre: 'Oro', tono: 0, sat: 1 },
  { id: 'esmeralda', nombre: 'Esmeralda', tono: 100, sat: 1 },
  { id: 'zafiro', nombre: 'Zafiro', tono: 172, sat: 1 },
  { id: 'amatista', nombre: 'Amatista', tono: 232, sat: 1 },
  { id: 'carmesi', nombre: 'Carmesí', tono: -40, sat: 1.15 },
  { id: 'plata', nombre: 'Plata', tono: 175, sat: 0.22 },
];

const muestra = (t: Pick<Tema, 'tono' | 'sat'>) => `hsl(${(TONO_ORO + t.tono + 360) % 360} ${Math.min(100, SAT_ORO * t.sat)}% 53%)`;

/** Del color elegido a mano: cuánto girar el tono y cuánto saturar respecto al oro. */
function desdeColor(hex: string): Tema {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { id: 'propio', tono: Math.round(h - TONO_ORO), sat: Math.min(1.8, Math.round(((s * 100) / SAT_ORO) * 100) / 100) };
}

function aHex(t: Tema) {
  const h = (TONO_ORO + t.tono + 360) % 360, s = Math.min(1, (SAT_ORO * t.sat) / 100), l = 0.53;
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${[0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function leer(): Tema {
  try {
    const t = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (t && typeof t.tono === 'number' && typeof t.sat === 'number') return t;
  } catch { /* sin almacenamiento: el oro de siempre */ }
  return TEMAS[0];
}

function aplicar(t: Tema) {
  document.documentElement.style.setProperty('--tono', String(t.tono));
  document.documentElement.style.setProperty('--sat', String(t.sat));
}

/** Se llama antes de pintar la app para que no se vea un instante el oro. */
export const aplicarTemaGuardado = () => aplicar(leer());

export function BotonConfiguracion() {
  const [abierto, setAbierto] = useState(false);
  const [tema, setTema] = useState(leer);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!panel.current?.parentElement?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { window.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const elegir = (t: Tema) => {
    setTema(t);
    aplicar(t);
    try { localStorage.setItem(CLAVE, JSON.stringify({ id: t.id, tono: t.tono, sat: t.sat })); } catch { /* se pierde al recargar */ }
  };

  return (
    <span className="filtros-ancla">
      <button
        type="button" className="rbtn" aria-label="Configuración" title="Configuración"
        aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}
      >
        <Icono d={UI.engranaje} />
      </button>
      {abierto && (
        <div ref={panel} className="panel filtros-panel config-panel" role="dialog" aria-label="Configuración">
          <span className="k">Color del tema</span>
          <div className="temas" role="radiogroup" aria-label="Color del tema">
            {TEMAS.map((t) => (
              <button
                key={t.id} type="button" role="radio" aria-checked={tema.id === t.id} className={`tema ${tema.id === t.id ? 'on' : ''}`}
                style={{ '--m': muestra(t) } as CSSProperties} onClick={() => elegir(t)}
              >
                <span className="tema-m" aria-hidden="true" />
                {t.nombre}
              </button>
            ))}
            <label className={`tema ${tema.id === 'propio' ? 'on' : ''}`} style={{ '--m': muestra(tema) } as CSSProperties}>
              <input type="color" value={aHex(tema)} onChange={(e) => elegir(desdeColor(e.target.value))} aria-label="Elegir un color propio" />
              <span className="tema-m" aria-hidden="true" />
              Otro color…
            </label>
          </div>
          <footer>
            <span>Solo cambia en este navegador: el resto de la party sigue viendo el suyo.</span>
          </footer>
        </div>
      )}
    </span>
  );
}
