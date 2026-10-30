// Tiradas de dados: el botón de la esquina con su bandeja (quién tira, qué dados, estilo e historial) y la
// mesa transparente por encima de toda la pantalla donde caen los dados en 3D (src/dados/mesa.ts).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  ACABADOS, CARAS, critico, dadosEnMesa, ESTILO_DM, estiloDe, esEstilo, formula, formulaDe, MAX_MODIFICADOR, NOMBRE_ACABADO, QUIEN_DM,
  tintaPara, tirar, TIPOS_DADO, total, cambiarSeleccion, type Acabado, type EstiloDados, type Seleccion, type TipoDado, type Tirada,
} from '../domain/dados';
import { personajeDelJugador, primerNombre } from '../domain/reglas';
import { useCofre } from '../store/cofre';
import type { Mesa, Reposo } from '../dados/mesa';
import { UI } from './iconos';
import { DADOS } from './iconosJuego';
import { useCerrarFuera } from './Menu';
import { Esquinas, Icono, iniciales } from './piezas';

const CLAVE_DM = 'cofre:dados-dm';
const CLAVE_AJENAS = 'cofre:dados-ajenas';

function leer<T>(clave: string, valido: (x: unknown) => boolean, defecto: T): T {
  try { const x = JSON.parse(localStorage.getItem(clave) ?? 'null'); return valido(x) ? x as T : defecto; } catch { return defecto; }
}
function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* se pierde al recargar */ }
}

/** Tiradas hechas en este navegador: estas se ven siempre en 3D, las de los demás según la preferencia. */
const propias = new Set<string>();

const COLORES = ['#8e2420', '#c8403a', '#e0883a', '#c8a24a', '#e8dcc0', '#9cc95e', '#2f6b3a', '#4fc1b5', '#5aa0d8', '#27406e', '#b874ff', '#4a2a5e', '#d88ac4', '#6b6f78', '#1c1a1a'];
const TINTAS: { nombre: string; color: string | null }[] = [
  { nombre: 'Auto', color: null }, { nombre: 'Oro', color: '#e2c27a' }, { nombre: 'Plata', color: '#d9dde3' },
  { nombre: 'Blanco', color: '#fbf6ea' }, { nombre: 'Negro', color: '#15110d' }, { nombre: 'Rojo', color: '#d8322c' },
];

export function IconoDado({ tipo, size }: { tipo: TipoDado; size?: number }) {
  if (tipo !== 'd100') return <Icono d={DADOS[tipo]} size={size} />;
  return (
    <span className="icono-d100" aria-hidden="true">
      <Icono d={DADOS.d10} size={size} /><Icono d={DADOS.d10} size={size} />
    </span>
  );
}

// ── Bandeja ────────────────────────────────────────────────────────

export function BandejaDados() {
  const { estado, actor, lanzarDados, cambiarEstiloDados, tiradas } = useCofre();
  const [abierta, setAbierta] = useState(false);
  const [seleccion, setSeleccion] = useState<Seleccion>({});
  const [modificador, setModificador] = useState(0);
  const [privada, setPrivada] = useState(false);
  const [editando, setEditando] = useState(false);
  const [estiloDm, setEstiloDm] = useState<EstiloDados>(() => leer(CLAVE_DM, esEstilo, ESTILO_DM));
  const [ajenas, setAjenas] = useState(() => leer(CLAVE_AJENAS, (x) => typeof x === 'boolean', true));
  const [elegido, setElegido] = useState<string | null>(null);
  const ancla = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => { setAbierta(false); setEditando(false); }, []);
  useCerrarFuera(ancla, abierta, cerrar);
  // Al abrir la bandeja se va descargando la mesa 3D, que pesa: así la primera tirada no espera
  useEffect(() => { if (abierta) void import('../dados/mesa'); }, [abierta]);

  // Por defecto tira el personaje del jugador (o el DM); se puede cambiar para tirar por otro
  const porDefecto = personajeDelJugador(estado, actor)?.id ?? (actor === 'DM' || !estado.personajes.length ? QUIEN_DM : estado.personajes[0].id);
  const quien = elegido && (elegido === QUIEN_DM || estado.personajes.some((p) => p.id === elegido)) ? elegido : porDefecto;
  const pj = estado.personajes.find((p) => p.id === quien);
  const estilo = pj ? estiloDe(pj) : estiloDm;
  const nombre = pj ? primerNombre(pj.nombre) : 'DM';
  const hay = dadosEnMesa(seleccion) > 0;

  const sumar = (tipo: TipoDado, delta: number) => setSeleccion((s) => cambiarSeleccion(s, tipo, delta));
  const restar = (e: MouseEvent, tipo: TipoDado) => { e.preventDefault(); sumar(tipo, -1); };

  const cambiarEstilo = (cambio: Partial<EstiloDados>) => {
    const nuevo = { ...estilo, ...cambio };
    if (pj) cambiarEstiloDados(pj.id, nuevo);
    else { setEstiloDm(nuevo); guardar(CLAVE_DM, nuevo); }
  };

  const lanzar = () => {
    if (!hay) return;
    const t: Tirada = {
      id: crypto.randomUUID(), fecha: Date.now(), quien, nombre, estilo,
      dados: tirar(seleccion), modificador, ...(privada ? { privada: true } : {}),
    };
    propias.add(t.id);
    lanzarDados(t);
  };

  const limpiar = () => { setSeleccion({}); setModificador(0); };

  return (
    <div ref={ancla} className="dados-ancla" style={{ '--dc': estilo.color, '--dt': estilo.tinta } as CSSProperties}>
      {abierta && (
        <section className="panel bandeja" aria-label="Tirada de dados">
          <Esquinas />
          <header className="bandeja-cab">
            <h2>Tirada de dados</h2>
            <button
              type="button" className={`ibtn ${editando ? 'on' : ''}`} aria-pressed={editando}
              title={`Estilo de los dados de ${nombre}`} aria-label={`Estilo de los dados de ${nombre}`} onClick={() => setEditando((x) => !x)}
            >
              <Icono d={UI.lapiz} />
            </button>
          </header>

          <div className="quien-tira" role="radiogroup" aria-label="Quién tira">
            {estado.personajes.map((p) => {
              const e = estiloDe(p);
              return (
                <button
                  key={p.id} type="button" role="radio" aria-checked={quien === p.id} title={`Tira ${p.nombre}`}
                  className={`tirador ${quien === p.id ? 'on' : ''}`} style={{ '--c': e.color } as CSSProperties} onClick={() => setElegido(p.id)}
                >
                  {p.imagenUrl ? <img src={p.imagenUrl} alt="" /> : <span>{iniciales(p.nombre)}</span>}
                  <i aria-hidden="true" />
                  <b>{primerNombre(p.nombre)}</b>
                </button>
              );
            })}
            <button
              type="button" role="radio" aria-checked={quien === QUIEN_DM} title="Tira el DM"
              className={`tirador ${quien === QUIEN_DM ? 'on' : ''}`} style={{ '--c': estiloDm.color } as CSSProperties} onClick={() => setElegido(QUIEN_DM)}
            >
              <span>DM</span>
              <i aria-hidden="true" />
              <b>DM</b>
            </button>
          </div>

          {editando ? (
            <EditorEstilo estilo={estilo} nombre={nombre} compartido={!!pj} onCambio={cambiarEstilo} onHecho={() => setEditando(false)} />
          ) : (
            <>
              <ul className="dados-lista">
                {TIPOS_DADO.map((tipo) => {
                  const n = seleccion[tipo] ?? 0;
                  return (
                    <li key={tipo} className={n ? 'on' : ''}>
                      <button
                        type="button" className="dado-fila" onClick={() => sumar(tipo, 1)} onContextMenu={(e) => restar(e, tipo)}
                        aria-label={`${tipo}: ${n}. Clic para añadir uno, clic derecho para quitarlo`} title="Clic: añadir · clic derecho: quitar"
                      >
                        <span className="dado-ic"><IconoDado tipo={tipo} /></span>
                        <span className="dado-nom">{tipo}<small>1–{CARAS[tipo]}</small></span>
                        {n > 0 && <span className="dado-n">×{n}</span>}
                      </button>
                      {n > 0 && (
                        <button type="button" className="dado-menos" aria-label={`Quitar un ${tipo}`} onClick={() => sumar(tipo, -1)}>
                          <Icono d={UI.menos} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="dados-mod">
                <span className="k">Modificador</span>
                <button type="button" className="ibtn" aria-label="Restar 1 al modificador" onClick={() => setModificador((m) => Math.max(-MAX_MODIFICADOR, m - 1))}><Icono d={UI.menos} /></button>
                <output aria-live="polite">{modificador > 0 ? `+${modificador}` : modificador < 0 ? `−${-modificador}` : '0'}</output>
                <button type="button" className="ibtn" aria-label="Sumar 1 al modificador" onClick={() => setModificador((m) => Math.min(MAX_MODIFICADOR, m + 1))}><Icono d={UI.mas} /></button>
              </div>

              <label className="dados-check">
                <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} />
                Tirada oculta: solo la ves tú
              </label>

              {hay && (
                <div className="dados-tirar">
                  <button type="button" className="btn pri" onClick={lanzar}>
                    Tirar <span>{formula(seleccion, modificador)}</span>
                  </button>
                  <button type="button" className="ibtn" title="Quitar todos los dados" aria-label="Quitar todos los dados" onClick={limpiar}><Icono d={UI.cruz} /></button>
                </div>
              )}
            </>
          )}

          {tiradas.length > 0 && (
            <div className="historial-dados">
              <span className="k">Últimas tiradas</span>
              <ol>
                {tiradas.slice(0, 5).map((t) => <FilaTirada key={t.id} t={t} />)}
              </ol>
            </div>
          )}
          <label className="dados-check tenue">
            <input type="checkbox" checked={ajenas} onChange={(e) => { setAjenas(e.target.checked); guardar(CLAVE_AJENAS, e.target.checked); }} />
            Ver caer los dados del resto de la party
          </label>
        </section>
      )}
      <button
        type="button" className={`dados-fab ${abierta ? 'on' : ''}`} aria-expanded={abierta} aria-label="Tirar dados" title="Tirar dados"
        onClick={() => (abierta ? cerrar() : setAbierta(true))}
      >
        <Icono d={DADOS.d20} />
        {hay && !abierta && <span className="fab-n">{dadosEnMesa(seleccion)}</span>}
      </button>
    </div>
  );
}

function FilaTirada({ t }: { t: Tirada }) {
  const crit = t.dados.map(critico).find(Boolean);
  return (
    <li className={crit ?? ''} style={{ '--c': t.estilo.color } as CSSProperties} title={t.dados.map((d) => `${d.tipo}: ${d.valor}`).join(' · ')}>
      <i aria-hidden="true" />
      <span>{t.nombre}{t.privada ? ' (oculta)' : ''}</span>
      <small>{formulaDe(t)}</small>
      <b>{total(t)}</b>
    </li>
  );
}

function EditorEstilo({ estilo, nombre, compartido, onCambio, onHecho }: {
  estilo: EstiloDados; nombre: string; compartido: boolean; onCambio: (c: Partial<EstiloDados>) => void; onHecho: () => void;
}) {
  const tintaAuto = estilo.tinta === tintaPara(estilo.color);
  return (
    <div className="estilo-dados">
      <div className="estilo-previa" aria-hidden="true">
        {(['d20', 'd6', 'd10'] as const).map((t) => <span key={t} className={`previa-${estilo.acabado}`}><IconoDado tipo={t} /></span>)}
      </div>
      <span className="k">Color de los dados</span>
      <div className="estilo-colores" role="radiogroup" aria-label="Color de los dados">
        {COLORES.map((c) => (
          <button
            key={c} type="button" role="radio" aria-checked={estilo.color === c} aria-label={c} className={estilo.color === c ? 'on' : ''}
            style={{ background: c }} onClick={() => onCambio({ color: c, ...(tintaAuto ? { tinta: tintaPara(c) } : {}) })}
          />
        ))}
        <label className={`otro ${COLORES.includes(estilo.color) ? '' : 'on'}`} title="Otro color" style={{ background: estilo.color }}>
          <input type="color" value={estilo.color} aria-label="Otro color" onChange={(e) => onCambio({ color: e.target.value, ...(tintaAuto ? { tinta: tintaPara(e.target.value) } : {}) })} />
          <Icono d={UI.mas} />
        </label>
      </div>
      <span className="k">Números</span>
      <div className="chips">
        {TINTAS.map((t) => {
          const on = t.color ? estilo.tinta === t.color && !(tintaAuto && t.color !== tintaPara(estilo.color)) : tintaAuto;
          return (
            <button key={t.nombre} type="button" className={`chip ${on ? 'on' : ''}`} onClick={() => onCambio({ tinta: t.color ?? tintaPara(estilo.color) })}>
              {t.color && <span className="punto" style={{ background: t.color }} />}{t.nombre}
            </button>
          );
        })}
      </div>
      <span className="k">Acabado</span>
      <div className="chips">
        {ACABADOS.map((a: Acabado) => (
          <button key={a} type="button" className={`chip ${estilo.acabado === a ? 'on' : ''}`} onClick={() => onCambio({ acabado: a })}>{NOMBRE_ACABADO[a]}</button>
        ))}
      </div>
      <p className="estilo-nota">
        {compartido ? `Los dados de ${nombre} los ve así toda la party.` : 'Los dados del DM se guardan en este navegador.'}
      </p>
      <button type="button" className="btn sec" onClick={onHecho}>Hecho</button>
    </div>
  );
}

// ── Mesa ───────────────────────────────────────────────────────────

/** Capa encima del lienzo de la app (no recibe clics) donde ruedan los dados de cada tirada, una tras otra. */
export function MesaDados({ escala }: { escala: number }) {
  const { tiradas } = useCofre();
  const caja = useRef<HTMLDivElement>(null);
  const mesa = useRef<Mesa | null>(null);
  const cola = useRef<Tirada[]>([]);
  const vistas = useRef(new Set(tiradas.map((t) => t.id)));
  const ocupada = useRef(false);
  const despertar = useRef<(() => void) | null>(null);
  const [actual, setActual] = useState<{ t: Tirada; reposo: Reposo[] | null } | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const pausa = (ms: number) => new Promise<void>((ok) => {
    const t = setTimeout(ok, ms);
    despertar.current = () => { clearTimeout(t); ok(); };
  });

  const siguiente = useCallback(async () => {
    if (ocupada.current || !caja.current) return;
    const t = cola.current.shift();
    if (!t) return;
    ocupada.current = true;
    try {
      const { Mesa } = await import('../dados/mesa');
      await document.fonts?.load('700 64px Cinzel').catch(() => {});
      mesa.current ??= new Mesa(caja.current);
      setSaliendo(false);
      setActual({ t, reposo: null });
      const reposo = await mesa.current.lanzar(t.dados, t.estilo);
      setActual({ t, reposo });
      // Se deja ver el resultado; si llega otra tirada, se acorta
      await pausa(cola.current.length ? 1800 : 5000);
      setSaliendo(true);
      await pausa(450);
    } catch {
      // Sin WebGL: el resultado sigue en el historial de la bandeja
    } finally {
      mesa.current?.limpiar();
      setActual(null);
      setSaliendo(false);
      despertar.current = null;
      ocupada.current = false;
    }
    void siguiente();
  }, []);

  useEffect(() => {
    const ajenas = leer(CLAVE_AJENAS, (x) => typeof x === 'boolean', true);
    const nuevas = tiradas.filter((t) => !vistas.current.has(t.id)).reverse();
    for (const t of nuevas) {
      vistas.current.add(t.id);
      // Con la pestaña oculta no se apilan las de los demás para soltarlas todas al volver
      if (propias.has(t.id) || (ajenas && !document.hidden)) cola.current.push(t);
    }
    if (nuevas.length) {
      // Una tirada propia no espera: corta la que se está mirando
      if (nuevas.some((t) => propias.has(t.id))) despertar.current?.();
      void siguiente();
    }
  }, [tiradas, siguiente]);

  // Ocupa lo mismo que el lienzo escalado: los dados salen del botón y no caen en las franjas de los lados
  useEffect(() => { mesa.current?.medir(); }, [escala]);
  useEffect(() => () => { mesa.current?.destruir(); mesa.current = null; }, []);
  const ancho = 1920 * escala, alto = 1080 * escala;

  const t = actual?.t, reposo = actual?.reposo;
  // El total va arriba o abajo, donde no hayan caído los dados
  const totalAbajo = !!reposo?.length && reposo.reduce((s, r) => s + r.y, 0) / reposo.length < alto / 2;
  return (
    <div className={`mesa-dados ${actual ? 'activa' : ''} ${saliendo ? 'saliendo' : ''}`} style={{ '--k': escala, left: (window.innerWidth - ancho) / 2, width: ancho, height: alto } as CSSProperties} aria-live="polite">
      <div ref={caja} className="mesa-lienzo" />
      {t && reposo && (
        <>
          {reposo.filter((r) => r.principal).map((r, i) => {
            const d = t.dados[r.indice];
            return (
              <span key={i} className={`dado-valor ${critico(d) ?? ''} ${r.y < 70 * escala ? 'debajo' : ''}`} style={{ left: r.x, top: r.y, '--c': t.estilo.color } as CSSProperties}>
                {d.valor}
              </span>
            );
          })}
          <div className={`dados-total ${totalAbajo ? 'abajo' : ''}`}style={{ '--c': t.estilo.color } as CSSProperties}>
            <span className="dt-quien"><i aria-hidden="true" />{t.nombre}{t.privada ? ' · oculta' : ''}</span>
            <span className="dt-formula">{formulaDe(t)}</span>
            <b>{total(t)}</b>
            {t.dados.length > 1 || t.modificador ? (
              <span className="dt-desglose">{t.dados.map((d) => d.valor).join(' + ')}{t.modificador ? (t.modificador > 0 ? ` + ${t.modificador}` : ` − ${-t.modificador}`) : ''}</span>
            ) : null}
            {t.dados.some((d) => critico(d) === 'exito') && <span className="dt-crit exito">¡Crítico!</span>}
            {t.dados.some((d) => critico(d) === 'pifia') && <span className="dt-crit pifia">Pifia</span>}
          </div>
        </>
      )}
    </div>
  );
}
