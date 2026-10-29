// Diálogos: dividir pila (pantalla 3 del diseño), límite de sintonización (Estados) y elegir quién usa la app.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cargaMaxDe, CLASE_RAREZA, MAX_SINTONIZADOS, pesoPersonajeKg, type Destino } from '../domain/reglas';
import type { Objeto } from '../domain/tipos';
import { usable } from '../domain/uso';
import { useCofre } from '../store/cofre';
import { UI } from './iconos';
import { Esquinas, fmt1, Icono, iniciales, Ranura } from './piezas';

function Separador() {
  return (
    <svg viewBox="0 0 330 10" width="300" height="10" aria-hidden="true">
      <path d="M0 5h150M180 5h150" stroke="#4d3e25" />
      <path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" />
    </svg>
  );
}

export function useEscape(f: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && f();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [f]);
}

export function DividirPila({ objeto, destino, onCancelar, onMover }: {
  objeto: Objeto;
  destino: Destino;
  onCancelar: () => void;
  onMover: (cantidad: number) => void;
}) {
  const { estado, validar } = useCofre();
  const max = objeto.cantidad;
  const [n, setN] = useState(Math.max(1, Math.floor(max / 2)));
  const fijar = (x: number) => setN(Math.max(1, Math.min(max, x)));
  useEscape(onCancelar);

  const pj = destino.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (destino.propietario as { id: string }).id) : undefined;
  const v = validar(objeto.id, destino, n);
  const anade = objeto.pesoKg * n;
  const base = pj ? pesoPersonajeKg(estado, pj) : 0;
  const cap = pj ? cargaMaxDe(estado, pj) : 0;
  const origenPj = objeto.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (objeto.propietario as { id: string }).id) : undefined;
  const nombreOrigen = origenPj ? origenPj.nombre.split(' ')[0] : 'alijo';

  return (
    <>
      <div className="velo" onClick={onCancelar} />
      <section role="dialog" aria-modal="true" aria-labelledby="dp-t" className="panel dialogo">
        <Esquinas />
        <header>
          <h2 id="dp-t">Dividir pila</h2>
          <Separador />
        </header>
        <div className="dp-par">
          <div>
            <Ranura objeto={{ ...objeto, cantidad: max - n }} aria-hidden="true" style={{ cursor: 'default' }} />
            <div className="info">
              <span>{objeto.nombre}</span>
              <span>{objeto.propietario.tipo === 'alijo' ? 'Del ' : 'De '}<b style={{ color: origenPj?.color }}>{nombreOrigen}</b> · quedan {max - n}</span>
            </div>
          </div>
          <svg viewBox="0 0 40 20" width="40" height="20" aria-hidden="true"><path d={UI.flecha} fill="none" stroke="#b89a55" strokeWidth="1.6" /></svg>
          <div>
            <div className="info">
              <span>{pj?.nombre ?? 'Alijo de la party'}</span>
              <span>recibirá {n}</span>
            </div>
            <div className="dp-dest" style={{ '--c': pj?.color ?? '#b89a55' } as React.CSSProperties}>
              {pj?.imagenUrl ? <img src={pj.imagenUrl} alt="" /> : pj ? iniciales(pj.nombre) : <Icono d={UI.cofre} size={26} />}
            </div>
          </div>
        </div>

        <div className="dp-cant">
          <label htmlFor="dp-r">¿Cuántas unidades de {objeto.nombre.toLowerCase()} mover?</label>
          <div>
            <button type="button" className="step" aria-label="Una menos" onClick={() => fijar(n - 1)}><Icono d={UI.menos} /></button>
            <output aria-live="polite">{n}</output>
            <button type="button" className="step" aria-label="Una más" onClick={() => fijar(n + 1)}><Icono d={UI.mas} /></button>
          </div>
          <input id="dp-r" type="range" min={1} max={max} value={n} onChange={(e) => fijar(Number(e.target.value))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="chip" onClick={() => fijar(1)}>1</button>
            <button type="button" className="chip" onClick={() => fijar(Math.floor(max / 2))}>Mitad</button>
            <button type="button" className="chip" onClick={() => fijar(max)}>Todas</button>
          </div>
        </div>

        {pj && (
          <div className="dp-carga">
            <div>
              <span style={{ color: 'var(--texto-2)' }}>Carga de {pj.nombre.split(' ')[0]} tras mover</span>
              <span>
                <b>{fmt1(base + anade)}</b> / {cap} kg{' '}
                <span style={{ color: v.ok ? '#9cc95e' : 'var(--no)' }}>(+{fmt1(anade)} kg)</span>
              </span>
            </div>
            <div className="barra-carga">
              <div style={{ height: 8, width: `${Math.min(100, (base / cap) * 100)}%`, background: '#c9a65a' }} />
              <div style={{ position: 'absolute', top: 0, height: 8, left: `${Math.min(100, (base / cap) * 100)}%`, width: `${Math.max(0, Math.min(100 - (base / cap) * 100, (anade / cap) * 100))}%`, background: v.ok ? '#9cc95e' : 'var(--no)', boxShadow: '0 0 8px rgba(156,201,94,.6)' }} />
              <span className="tic" style={{ left: '33.3%' }} />
              <span className="tic" style={{ left: '66.6%' }} />
            </div>
            {!v.ok && <span style={{ color: '#ffd6d3', fontSize: 14 }}>{v.motivo}</span>}
          </div>
        )}

        <div className="acciones">
          <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn pri" disabled={!v.ok} aria-disabled={!v.ok} onClick={() => onMover(n)}>
            Mover {n}
          </button>
        </div>
      </section>
    </>
  );
}

// ── Sintonización ──────────────────────────────────────────────────

const CtxSintonia = createContext<(o: Objeto) => void>(() => {});
const CtxDoble = createContext<(o: Objeto) => void>(() => {});

/** Sintoniza o desintoniza un objeto; con 3 ya sintonizados, pregunta cuál sustituir. */
export const useSintonia = () => useContext(CtxSintonia);

/**
 * Doble clic en un objeto: lo usa si se puede (gasta una carga o una unidad) y, si no, lo sintoniza.
 * Un objeto que pide sintonía y aún no la tiene se sintoniza primero. Lo del alijo lo usa quien maneja la app.
 */
export const useDobleClic = () => useContext(CtxDoble);

export function SintoniaProvider({ onAviso, children }: { onAviso: (texto: string, error?: boolean) => void; children: ReactNode }) {
  const { estado, actor, sintonizar, usar } = useCofre();
  const [lleno, setLleno] = useState<{ objeto: Objeto; actuales: Objeto[] } | null>(null);

  const pedir = useCallback((o: Objeto) => {
    if (!o.requiereSintonizacion) return;
    const r = sintonizar(o.id);
    if (r.ok) onAviso(o.sintonizado ? `${o.nombre} ya no está sintonizado` : `${o.nombre} sintonizado (requiere un descanso corto)`);
    else if (r.lleno) setLleno({ objeto: o, actuales: r.lleno });
    else onAviso(r.motivo, true);
  }, [sintonizar, onAviso]);

  const doble = useCallback((o: Objeto) => {
    if (!usable(o) || (o.requiereSintonizacion && !o.sintonizado)) { pedir(o); return; }
    const yo = estado.personajes.find((p) => p.nombre.split(' ')[0] === actor);
    const r = usar(o.id, yo?.id);
    onAviso(r.ok ? r.texto : r.motivo, !r.ok);
  }, [pedir, usar, estado.personajes, actor, onAviso]);

  return (
    <CtxSintonia.Provider value={pedir}>
    <CtxDoble.Provider value={doble}>
      {children}
      {lleno && (
        <LimiteSintonia
          {...lleno}
          onCancelar={() => setLleno(null)}
          onSustituir={(id) => {
            const r = sintonizar(lleno.objeto.id, id);
            if (r.ok) onAviso(`${lleno.objeto.nombre} sintonizado (requiere un descanso corto)`);
            else onAviso(r.motivo, true);
            setLleno(null);
          }}
        />
      )}
    </CtxDoble.Provider>
    </CtxSintonia.Provider>
  );
}

function LimiteSintonia({ objeto, actuales, onCancelar, onSustituir }: {
  objeto: Objeto;
  actuales: Objeto[];
  onCancelar: () => void;
  onSustituir: (id: string) => void;
}) {
  const [elegido, setElegido] = useState(actuales[0]?.id);
  useEscape(onCancelar);
  return (
    <>
      <div className="velo" onClick={onCancelar} />
      <section role="dialog" aria-modal="true" aria-labelledby="ls-t" className="panel dialogo ls-dialogo">
        <Esquinas />
        <div className="ls-objeto">
          <Ranura objeto={{ ...objeto, cantidad: 1 }} aria-hidden="true" style={{ width: 72, height: 72, cursor: 'default' }} />
          <span className={`ls-nombre ${CLASE_RAREZA[objeto.rareza]}`}>{objeto.nombre}</span>
          <span className="ls-sub">{objeto.rareza.charAt(0).toUpperCase() + objeto.rareza.slice(1)} · requiere sintonización</span>
          <span className="ls-rombos" aria-hidden="true">
            {actuales.map((a) => <i key={a.id} className={CLASE_RAREZA[a.rareza]} />)}
            <i className="nuevo" />
          </span>
          <span className="ls-ocupadas">{actuales.length} / {MAX_SINTONIZADOS} ocupadas</span>
        </div>
        <fieldset className="ls-lista">
          <legend id="ls-t">Límite de sintonización alcanzado</legend>
          <p>
            Un personaje solo puede estar sintonizado con {MAX_SINTONIZADOS} objetos. Elige cuál deja de estarlo para
            sintonizar {objeto.nombre}. Sintonizar lleva un descanso corto.
          </p>
          {actuales.map((a) => (
            <label key={a.id} className={`ls-opcion ${elegido === a.id ? 'on' : ''}`}>
              <input type="radio" name="ls" checked={elegido === a.id} onChange={() => setElegido(a.id)} />
              <Ranura objeto={{ ...a, cantidad: 1, requiereSintonizacion: false }} aria-hidden="true" style={{ width: 36, height: 36, cursor: 'default' }} />
              <span>{a.nombre} · <span className={CLASE_RAREZA[a.rareza]} style={{ color: 'var(--rc)' }}>{a.rareza.charAt(0).toUpperCase() + a.rareza.slice(1)}</span></span>
            </label>
          ))}
          <div className="acciones">
            <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button>
            <button type="button" className="btn pri" disabled={!elegido} onClick={() => elegido && onSustituir(elegido)}>Sustituir sintonización</button>
          </div>
        </fieldset>
      </section>
    </>
  );
}

/** Sin cuentas: cada jugador dice quién es para firmar sus movimientos en el historial. */
export function QuienEres({ onCerrar }: { onCerrar: () => void }) {
  const { estado, actor, setActor } = useCofre();
  const [libre, setLibre] = useState('');
  const elegir = (nombre: string) => {
    if (!nombre.trim()) return;
    setActor(nombre.trim());
    onCerrar();
  };
  return (
    <>
      <div className="velo" />
      <section role="dialog" aria-modal="true" aria-labelledby="qe-t" className="panel dialogo">
        <Esquinas />
        <header>
          <h2 id="qe-t">¿Quién eres?</h2>
          <Separador />
        </header>
        <p>Tu nombre aparecerá en el historial cuando muevas objetos. No hace falta cuenta.</p>
        <div className="quien">
          {estado.personajes.map((p) => (
            <button key={p.id} type="button" className={`chip ${actor === p.nombre.split(' ')[0] ? 'on' : ''}`} style={{ borderColor: p.color }} onClick={() => elegir(p.nombre.split(' ')[0])}>
              {p.nombre}
            </button>
          ))}
          <button type="button" className={`chip ${actor === 'DM' ? 'on' : ''}`} onClick={() => elegir('DM')}>Soy el DM</button>
        </div>
        <form className="quien-libre" onSubmit={(e) => { e.preventDefault(); elegir(libre); }}>
          <input aria-label="Otro nombre" placeholder="Otro nombre…" value={libre} onChange={(e) => setLibre(e.target.value)} />
          <button type="submit" className="btn sec" style={{ height: 40 }}>Entrar</button>
        </form>
      </section>
    </>
  );
}
