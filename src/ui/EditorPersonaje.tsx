// Alta y edición de personajes: identidad, clases, características, competencias, defensas y rasgos.
// La columna de la derecha enseña la hoja resultante (CA, PV, salvaciones…) con su equipo actual.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CARACTERISTICAS, CONDICIONES, datosClase, HABILIDADES, NOMBRE_CAR, TIPOS_DANO } from '../domain/catalogo';
import { hoja } from '../domain/hoja';
import { personajeVacio } from '../domain/personajes';
import { conSigno, modificador, nivelTotal } from '../domain/reglas';
import type { Caracteristica, Habilidad, IconoRasgo, Personaje, Rasgo, Tamano } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { Campo, Numero, Seccion } from './EditorObjeto';
import { UI } from './iconos';
import { Esquinas, Icono } from './piezas';

type ApiPersonaje = { nuevo: () => void; editar: (p: Personaje) => void };
const Ctx = createContext<ApiPersonaje>({ nuevo: () => {}, editar: () => {} });
export const useEditorPersonaje = () => useContext(Ctx);

export function EditorPersonajeProvider({ onAviso, children }: { onAviso: (texto: string, error?: boolean) => void; children: ReactNode }) {
  const [abierto, setAbierto] = useState<{ p?: Personaje } | null>(null);
  const api = useMemo<ApiPersonaje>(() => ({ nuevo: () => setAbierto({}), editar: (p) => setAbierto({ p }) }), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      {abierto && <Editor key={abierto.p?.id ?? 'nuevo'} inicial={abierto.p} onCerrar={() => setAbierto(null)} onAviso={onAviso} />}
    </Ctx.Provider>
  );
}

const CLASES = ['Artífice', 'Bárbaro', 'Bardo', 'Brujo', 'Clérigo', 'Druida', 'Explorador', 'Guerrero', 'Hechicero', 'Mago', 'Monje', 'Paladín', 'Pícaro'];
const TAMANOS: Tamano[] = ['diminuto', 'pequeño', 'mediano', 'grande', 'enorme'];
const ICONOS_RASGO: [IconoRasgo, string][] = [
  ['estrella', 'Estrella'], ['corazon', 'Corazón'], ['rayo', 'Rayo'], ['ojo', 'Ojo'], ['espada', 'Espada'], ['escudo', 'Escudo'], ['libro', 'Libro'], ['mano', 'Mano'],
];
const RECARGAS = ['', 'Descanso corto', 'Descanso largo', 'Al amanecer'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const alternar = <T,>(lista: T[] | undefined, x: T) => (lista?.includes(x) ? lista.filter((y) => y !== x) : [...(lista ?? []), x]);

function Editor({ inicial, onCerrar, onAviso }: { inicial?: Personaje; onCerrar: () => void; onAviso: (t: string, e?: boolean) => void }) {
  const { estado, guardarPersonaje, eliminarPersonaje } = useCofre();
  const editando = !!inicial;
  const [p, setP] = useState<Personaje>(() => (inicial ? structuredClone(inicial) : personajeVacio(estado)));
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  useEscape(onCerrar);
  const cambiar = useCallback((c: Partial<Personaje>) => { setError(null); setP((x) => ({ ...x, ...c })); }, []);

  const guardar = () => {
    const motivo = guardarPersonaje(p, !editando);
    if (motivo) { setError(motivo); return; }
    onAviso(editando ? `${p.nombre.trim()}: ficha guardada` : `${p.nombre.trim()} se une a la party`);
    onCerrar();
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="pj-t" className="panel editor editor-pj">
        <Esquinas />
        <header className="ed-cab">
          <h2 id="pj-t">{editando ? 'Editar personaje' : 'Nuevo personaje'}</h2>
          <span className="ed-paso">{p.nombre || 'Sin nombre'} · nivel {nivelTotal(p)}</span>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>

        <div className="ed-cuerpo">
          <form className="ed-form" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
            <Identidad p={p} cambiar={cambiar} />
            <Clases p={p} cambiar={cambiar} />
            <Caracteristicas p={p} cambiar={cambiar} />
            <Competencias p={p} cambiar={cambiar} />
            <Defensas p={p} cambiar={cambiar} />
            <Rasgos p={p} cambiar={cambiar} />
            <button type="submit" hidden />
          </form>
          <Resumen p={p} />
        </div>

        <footer className="ed-pie">
          {editando && (borrar ? (
            <span className="ed-borrar">
              ¿Quitar a {p.nombre} de la party? Su equipo pasa al alijo y sus monedas al tesoro.
              <button type="button" className="btn peligro" onClick={() => { eliminarPersonaje(p.id); onAviso(`${p.nombre} deja la party`); onCerrar(); }}>Sí, quitar</button>
              <button type="button" className="btn sec" onClick={() => setBorrar(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="btn peligro-sec" onClick={() => setBorrar(true)}>Quitar personaje</button>
          ))}
          {error && <span className="ed-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{editando ? 'Guardar ficha' : 'Crear personaje'}</button>
        </footer>
      </section>
    </>
  );
}

type Sec = { p: Personaje; cambiar: (c: Partial<Personaje>) => void };

function Identidad({ p, cambiar }: Sec) {
  return (
    <Seccion titulo="Identidad">
      <Campo label="Nombre" ancho={3}><input value={p.nombre} placeholder="Tamsin Brezo" onChange={(e) => cambiar({ nombre: e.target.value })} /></Campo>
      <Campo label="Raza" ancho={2}><input value={p.raza} onChange={(e) => cambiar({ raza: e.target.value })} /></Campo>
      <Campo label="Trasfondo" ancho={2}><input value={p.trasfondo ?? ''} onChange={(e) => cambiar({ trasfondo: e.target.value })} /></Campo>
      <Campo label="Color" ancho={1}><input type="color" value={p.color} onChange={(e) => cambiar({ color: e.target.value })} /></Campo>
      <Campo label="Tamaño" ayuda="Automático: Pequeño para medianos, gnomos…">
        <select value={p.tamano ?? ''} onChange={(e) => cambiar({ tamano: (e.target.value || undefined) as Tamano | undefined })}>
          <option value="">Automático</option>
          {TAMANOS.map((t) => <option key={t} value={t}>{capital(t)}</option>)}
        </select>
      </Campo>
      <Campo label="Velocidad (m)" ayuda="Vacío: 9 m, o 7,5 m para enanos, medianos y gnomos">
        <Numero valor={p.velocidad} min={0} paso={1.5} vacio="Auto" onCambio={(n) => cambiar({ velocidad: n })} />
      </Campo>
      <Campo label="PX"><Numero valor={p.px} min={0} onCambio={(n) => cambiar({ px: n })} /></Campo>
      <Campo label="PV actuales / máximos">
        <span className="par-num">
          <Numero valor={p.pvActual} min={0} onCambio={(n) => cambiar({ pvActual: n ?? 0 })} />
          <Numero valor={p.pvMax} min={1} onCambio={(n) => cambiar({ pvMax: n ?? 1 })} />
        </span>
      </Campo>
    </Seccion>
  );
}

function Clases({ p, cambiar }: Sec) {
  const fijar = (i: number, c: Partial<Personaje['clases'][number]>) => cambiar({ clases: p.clases.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  const clase = datosClase(p.clases[0]?.clase ?? '');
  return (
    <Seccion titulo="Clases" nota="La primera clase decide las salvaciones con competencia, la característica de conjuros y la defensa sin armadura, salvo que elijas otra cosa.">
      <datalist id="clases-5e">{CLASES.map((c) => <option key={c} value={c} />)}</datalist>
      {p.clases.map((c, i) => (
        <div key={i} className="fila-clase" style={{ gridColumn: 'span 4' }}>
          <input list="clases-5e" aria-label="Clase" value={c.clase} onChange={(e) => fijar(i, { clase: e.target.value })} />
          <Numero valor={c.nivel} min={1} max={20} onCambio={(n) => fijar(i, { nivel: n ?? 1 })} />
          {p.clases.length > 1 && <button type="button" className="ibtn" aria-label="Quitar clase" onClick={() => cambiar({ clases: p.clases.filter((_, j) => j !== i) })}><Icono d={UI.cruz} /></button>}
        </div>
      ))}
      <div style={{ gridColumn: 'span 8' }}>
        <button type="button" className="chip on anadir-fila chip-i" onClick={() => cambiar({ clases: [...p.clases, { clase: '', nivel: 1 }] })}><Icono d={UI.mas} />Añadir clase (multiclase)</button>
      </div>
      <Campo label="Conjuros con" ancho={2}>
        <select
          value={p.caracteristicaConjuros === undefined ? 'auto' : p.caracteristicaConjuros ?? 'no'}
          onChange={(e) => cambiar({ caracteristicaConjuros: e.target.value === 'auto' ? undefined : e.target.value === 'no' ? null : (e.target.value as Caracteristica) })}
        >
          <option value="auto">De la clase ({clase?.conjuros ? NOMBRE_CAR[clase.conjuros] : 'no lanza'})</option>
          <option value="no">No lanza conjuros</option>
          {CARACTERISTICAS.map(([k, , n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Campo>
      <Campo label="Defensa sin armadura" ancho={2}>
        <select
          value={p.caSinArmadura === undefined ? 'auto' : p.caSinArmadura ?? 'no'}
          onChange={(e) => cambiar({ caSinArmadura: e.target.value === 'auto' ? undefined : e.target.value === 'no' ? null : (e.target.value as Caracteristica) })}
        >
          <option value="auto">De la clase ({clase?.sinArmadura ? `10 + DES + ${NOMBRE_CAR[clase.sinArmadura].slice(0, 3).toUpperCase()}` : 'no tiene'})</option>
          <option value="no">No tiene</option>
          <option value="con">10 + DES + CON</option>
          <option value="sab">10 + DES + SAB</option>
        </select>
      </Campo>
      <Campo label="CA extra" ancho={2} ayuda="Estilo Defensa, rasgos… (no objetos)">
        <Numero valor={p.caExtra} vacio="0" onCambio={(n) => cambiar({ caExtra: n || undefined })} />
      </Campo>
    </Seccion>
  );
}

function Caracteristicas({ p, cambiar }: Sec) {
  return (
    <Seccion titulo="Características" nota="Puntuaciones base, sin objetos ni efectos: esos se suman solos en la hoja.">
      <div className="cars-pj" style={{ gridColumn: 'span 8' }}>
        {CARACTERISTICAS.map(([k, a, n]) => (
          <label key={k} className="car-pj" title={n}>
            <span className="k">{a}</span>
            <Numero valor={p[k]} min={1} max={30} onCambio={(v) => cambiar({ [k]: v ?? 10 } as Partial<Personaje>)} />
            <span className="car-mod">{conSigno(modificador(p[k] ?? 10))}</span>
          </label>
        ))}
      </div>
    </Seccion>
  );
}

function Competencias({ p, cambiar }: Sec) {
  const comp = p.competencias ?? {};
  const fijar = (c: Partial<NonNullable<Personaje['competencias']>>) => cambiar({ competencias: { ...comp, ...c } });
  const deClase = datosClase(p.clases[0]?.clase ?? '')?.salvaciones ?? [];
  const nivel = (h: Habilidad) => (comp.pericia?.includes(h) ? 2 : comp.habilidades?.includes(h) ? 1 : 0);
  // Cada clic sube un paso: sin competencia → competencia → pericia → sin competencia
  const siguiente = (h: Habilidad) => {
    const n = nivel(h);
    fijar({
      habilidades: n === 0 ? [...(comp.habilidades ?? []), h] : n === 2 ? comp.habilidades?.filter((x) => x !== h) : comp.habilidades,
      pericia: n === 1 ? [...(comp.pericia ?? []), h] : comp.pericia?.filter((x) => x !== h),
    });
  };
  return (
    <Seccion titulo="Competencias" nota="Clic en una habilidad: competencia (●), pericia (●●) o nada. Las salvaciones de la clase ya cuentan aunque no las marques.">
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Salvaciones</span>
        <div className="chips">
          {CARACTERISTICAS.map(([k, , n]) => {
            const clase = deClase.includes(k);
            const on = clase || !!comp.salvaciones?.includes(k);
            return (
              <button key={k} type="button" role="checkbox" aria-checked={on} disabled={clase} className={`chip ${on ? 'on' : ''}`} title={clase ? 'De la clase' : undefined} onClick={() => fijar({ salvaciones: alternar(comp.salvaciones, k) })}>
                {n}{clase ? ' · clase' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className="habs-pj" style={{ gridColumn: 'span 8' }}>
        {HABILIDADES.map(([k, n, c]) => {
          const v = nivel(k);
          return (
            <button key={k} type="button" className={`hab-pj n${v}`} aria-label={`${n}: ${['sin competencia', 'competencia', 'pericia'][v]}`} onClick={() => siguiente(k)}>
              <span className="hab-marca">{v === 2 ? '●●' : v === 1 ? '●' : '○'}</span>
              {n}<span className="hab-car">{c.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </Seccion>
  );
}

function Defensas({ p, cambiar }: Sec) {
  const conocidas = p.condiciones.filter((c) => CONDICIONES.includes(c));
  const otras = p.condiciones.filter((c) => !CONDICIONES.includes(c));
  const [textoOtras, setTextoOtras] = useState(otras.join(', '));
  return (
    <Seccion titulo="Condiciones y resistencias" nota="Las resistencias de objetos y efectos se añaden solas; aquí van las del personaje (raza, clase…).">
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Resistencias</span>
        <div className="chips">
          {TIPOS_DANO.map((t) => (
            <button key={t} type="button" role="checkbox" aria-checked={p.resistencias.includes(t)} className={`chip ${p.resistencias.includes(t) ? 'on' : ''}`} onClick={() => cambiar({ resistencias: alternar(p.resistencias, t) })}>
              {capital(t)}
            </button>
          ))}
        </div>
      </div>
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Condiciones</span>
        <div className="chips">
          {CONDICIONES.map((c) => (
            <button key={c} type="button" role="checkbox" aria-checked={conocidas.includes(c)} className={`chip ${conocidas.includes(c) ? 'on' : ''}`} onClick={() => cambiar({ condiciones: alternar(p.condiciones, c) })}>
              {capital(c)}
            </button>
          ))}
        </div>
      </div>
      <Campo label="Otras condiciones (separadas por comas)" ancho={8}>
        <input
          value={textoOtras} placeholder="Agotamiento 2, Maldito…"
          onChange={(e) => { setTextoOtras(e.target.value); cambiar({ condiciones: [...conocidas, ...e.target.value.split(',').map((x) => x.trim()).filter(Boolean)] }); }}
        />
      </Campo>
    </Seccion>
  );
}

function Rasgos({ p, cambiar }: Sec) {
  const lista = p.rasgos ?? [];
  const fijar = (i: number, c: Partial<Rasgo>) => cambiar({ rasgos: lista.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  return (
    <Seccion titulo="Rasgos destacados" nota="Con usos máximos, la ficha los cuenta (clic para gastar uno) y los descansos los recuperan según «Recarga».">
      <div className="rasgos-pj" style={{ gridColumn: 'span 8' }}>
        {lista.length > 0 && (
          <div className="rasgo-pj cab" aria-hidden="true"><span>Icono</span><span>Nombre</span><span>Detalle</span><span>Usos</span><span>Máx.</span><span>Recarga</span><span /></div>
        )}
        {lista.map((r, i) => (
          <div key={i} className="rasgo-pj">
            <select aria-label="Icono" value={r.icono ?? 'estrella'} onChange={(e) => fijar(i, { icono: e.target.value as IconoRasgo })}>
              {ICONOS_RASGO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
            <input aria-label="Nombre del rasgo" value={r.nombre} placeholder="Segundo aliento" onChange={(e) => fijar(i, { nombre: e.target.value })} />
            <input aria-label="Detalle" value={r.detalle ?? ''} placeholder="Pasivo, 3d6…" onChange={(e) => fijar(i, { detalle: e.target.value || undefined })} />
            <Numero valor={r.usos} min={0} vacio="—" onCambio={(n) => fijar(i, { usos: n })} />
            <Numero valor={r.usosMax} min={0} vacio="—" onCambio={(n) => fijar(i, { usosMax: n || undefined, usos: n ? Math.min(r.usos ?? n, n) : undefined })} />
            <select aria-label="Recarga" value={RECARGAS.includes(r.recarga ?? '') ? r.recarga ?? '' : r.recarga} onChange={(e) => fijar(i, { recarga: e.target.value || undefined })}>
              {RECARGAS.map((x) => <option key={x} value={x}>{x || '—'}</option>)}
              {r.recarga && !RECARGAS.includes(r.recarga) && <option value={r.recarga}>{r.recarga}</option>}
            </select>
            <button type="button" className="ibtn" aria-label="Quitar rasgo" onClick={() => cambiar({ rasgos: lista.filter((_, j) => j !== i) })}><Icono d={UI.cruz} /></button>
          </div>
        ))}
        <button type="button" className="chip on anadir-fila chip-i" onClick={() => cambiar({ rasgos: [...lista, { nombre: '', icono: 'estrella' }] })}><Icono d={UI.mas} />Añadir rasgo</button>
      </div>
    </Seccion>
  );
}

/** La hoja que saldría al guardar, con el equipo que ya lleva. */
function Resumen({ p }: { p: Personaje }) {
  const { estado } = useCofre();
  const sim = { ...p, id: p.id || '__nuevo' };
  const h = hoja({ ...estado, personajes: [...estado.personajes.filter((x) => x.id !== sim.id), sim] }, sim);
  const filas: [string, string][] = [
    ['CA', String(h.ca.total)],
    ['PV máximos', String(h.pvMax.total)],
    ['Iniciativa', conSigno(h.iniciativa.total)],
    ['Velocidad', `${h.velocidad.caminar.total} m`],
    ['Competencia', conSigno(h.competencia.total)],
    ['Percepción pasiva', String(h.pasivas.percepcion.total)],
    ['CD de conjuros', h.conjuros ? String(h.conjuros.cd.total) : '—'],
    ['Carga máxima', `${h.cargaMax} kg`],
  ];
  return (
    <aside className="ed-previa" aria-label="Hoja resultante">
      <span className="k">Así queda la hoja</span>
      <div className="previa-ficha pj-previa" style={{ '--rc': p.color, '--rg': 'transparent' } as React.CSSProperties}>
        <div>
          <b className="previa-nombre">{p.nombre || 'Sin nombre'}</b>
          <span>{p.raza} · {p.clases.map((c) => `${c.clase || '¿?'} ${c.nivel}`).join(' / ')}</span>
        </div>
      </div>
      <ul className="previa-cambios">
        {filas.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
      </ul>
      <span className="k">Salvaciones</span>
      <ul className="previa-cambios salv-pj">
        {CARACTERISTICAS.map(([k, a]) => (
          <li key={k}><span>{a}{h.salvaciones[k].competente ? ' ●' : ''}</span><b>{conSigno(h.salvaciones[k].total)}</b></li>
        ))}
      </ul>
      {!!h.p.efectos?.length && <span className="ayuda">Incluye los efectos temporales activos.</span>}
    </aside>
  );
}
