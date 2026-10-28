// Pantalla 1 y 2 del diseño: vista grupal, con arrastre entre personajes, equipo y alijo.

import { useRef, useState, type CSSProperties } from 'react';
import {
  ataque, cargaMaxKg, CLASE_RAREZA, colocar, conSigno, CRITERIOS_ORDEN, equipadoEn, estadoSaciedad, fmtKg, objetosDe, pesoAlijoKg,
  pesoPersonajeKg, tramoCarga,
} from '../domain/reglas';
import type { Categoria, Personaje, Propietario, TipoRanura } from '../domain/tipos';
import { guardarImagen } from '../store/archivos';
import { useCofre } from '../store/cofre';
import { dentroDe, useArrastreApi, useArrastreSel } from './arrastre';
import { useObjetos } from './EditarObjeto';
import { MenuBoton, type OpcionMenu } from './Menus';
import { useSintonia } from './Dialogos';
import { ICONOS, UI, type ClaveIcono } from './iconos';
import { Esquinas, fmt1, fmtNum, Icono, Orla } from './piezas';
import { DCHA, IZQ, RanuraEquipo, RejillaObjetos, Silueta, SILUETA_ARMA } from './interaccion';

// ── Pantalla ───────────────────────────────────────────────────────

/** Opciones de «Ordenar por…» para el inventario de un dueño. */
export function opcionesOrden(ordenar: (d: Propietario, c: (typeof CRITERIOS_ORDEN)[number]['id']) => void, dueno: Propietario): OpcionMenu[] {
  return CRITERIOS_ORDEN.map((c) => ({ texto: c.texto, icono: UI.ordenar, onClick: () => ordenar(dueno, c.id) }));
}

export function Grupal({ busqueda, onFicha }: { busqueda: string; onFicha: (id: string) => void }) {
  const { estado } = useCofre();
  const n = estado.personajes.length;
  const anchoCol = Math.min(352, Math.floor((1772 - 300 - 16 * n) / Math.max(n, 1)));
  const slot = Math.min(44, Math.floor((anchoCol - 16 - 4 - 6 * 4) / 7));

  return (
    <main className="grupal" style={{ '--slot': `${slot}px` } as CSSProperties}>
      {estado.personajes.map((p, i) => (
        <Columna key={p.id} p={p} indice={i} ancho={anchoCol} busqueda={busqueda} onFicha={onFicha} />
      ))}
      <Alijo busqueda={busqueda} />
    </main>
  );
}

// ── Columna de personaje ──────────────────────────────────────────

function Columna({ p, indice, ancho, busqueda, onFicha }: { p: Personaje; indice: number; ancho: number; busqueda: string; onFicha: (id: string) => void }) {
  const onDoble = useSintonia();
  const { estado, validar, cambiarImagen, ordenar } = useCofre();
  const acciones = useObjetos();
  const dueno: Propietario = { tipo: 'personaje', id: p.id };
  const fichero = useRef<HTMLInputElement>(null);

  const propios = objetosDe(estado, { tipo: 'personaje', id: p.id });
  const inventario = propios.filter((o) => !o.equipadoEn);
  const peso = pesoPersonajeKg(estado, p);
  const max = cargaMaxKg(p.fue);
  const tramo = tramoCarga(peso, max);
  const sac = estadoSaciedad(p.saciedad);
  const eq = (r: TipoRanura, i = 0) => equipadoEn(estado, p.id, r, i);
  const armaCaC = eq('cuerpoACuerpo', 0), armaDist = eq('distancia', 0);
  const atqM = ataque(p, armaCaC, 'cuerpoACuerpo');
  const atqR = ataque(p, armaDist, 'distancia');
  const silueta = SILUETA_ARMA[(armaCaC ?? armaDist)?.icono as ClaveIcono];
  const clases = p.clases.map((c) => `${c.clase} ${c.nivel}`).join(' / ');

  const clave = `pj:${p.id}`;

  const subirImagen = async (f: File | undefined) => {
    if (!f) return;
    cambiarImagen(p.id, await guardarImagen(f, 'personaje'));
  };

  return (
    <article className={`panel columna ${p.imagenUrl ? 'con-fondo' : ''}`} aria-label={p.nombre} style={{ width: ancho }} data-drop={clave}>
      {p.imagenUrl && <img className="fondo-pj" src={p.imagenUrl} alt="" />}
      <Esquinas />
      <MarcoColumna p={p} peso={peso} max={max} />

      <header className="col-cab">
        <MenuBoton
          className="ibtn" etiqueta={`Opciones de ${p.nombre}`}
          opciones={[
            { texto: 'Ver ficha completa', icono: UI.persona, onClick: () => onFicha(p.id) },
            { texto: 'Editar personaje', icono: UI.lapiz, onClick: () => acciones.editarPersonaje(p) },
            { texto: 'Añadir objeto', icono: UI.mas, onClick: () => acciones.nuevo(dueno) },
            { titulo: 'Ordenar inventario por' },
            ...opcionesOrden(ordenar, dueno),
            'separador',
            { texto: p.imagenUrl ? 'Cambiar imagen' : 'Subir imagen', icono: UI.camara, onClick: () => fichero.current?.click() },
            ...(p.imagenUrl ? [{ texto: 'Quitar imagen', icono: UI.papelera, onClick: () => cambiarImagen(p.id, '') }] : []),
          ]}
        >
          <Icono d={UI.menu} />
        </MenuBoton>
        <h2 title={p.nombre}>{p.nombre}</h2>
        <div className="oro">{fmtNum(p.monedas.po)}<i aria-label="piezas de oro" /></div>
      </header>
      <div className="col-sub">
        <span>{p.raza} · {clases} · PV {p.pvActual}/{p.pvMax}</span>
        <div className="saciedad" title={`Saciedad ${p.saciedad}/100 · ${sac.efecto}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ stroke: sac.color }}><path d={UI.cuenco} /></svg>
          <div className="pista"><div style={{ height: 6, width: `${p.saciedad}%`, background: `linear-gradient(90deg, ${sac.color}99, ${sac.color})` }} /></div>
          <span style={{ color: sac.color }}>{sac.texto}</span>
        </div>
      </div>
      <Orla />

      <div className="figura">
        {!p.imagenUrl && <Silueta tinte={p.color} id={`col${indice}`} arma={silueta} />}
        <button type="button" className="ibtn camara" aria-label="Cambiar imagen del personaje" onClick={() => fichero.current?.click()}>
          <Icono d={UI.camara} />
        </button>
        <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { subirImagen(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="eq-izq">{IZQ.map(([r, ic]) => <RanuraEquipo key={r} p={p} ranura={r} indice={0} fantasma={ic} busqueda={busqueda} onDoble={onDoble} />)}</div>
        <div className="eq-dcha">{DCHA.map(([r, i, ic]) => <RanuraEquipo key={r + i} p={p} ranura={r} indice={i} fantasma={ic} busqueda={busqueda} onDoble={onDoble} />)}</div>
      </div>

      <div className="armas">
        <div>
          <span className="lbl">Cuerpo a cuerpo</span>
          <div className="par">
            <RanuraEquipo p={p} ranura="cuerpoACuerpo" indice={0} fantasma="sword" etiqueta="Mano principal" busqueda={busqueda} onDoble={onDoble} />
            <RanuraEquipo p={p} ranura="cuerpoACuerpo" indice={1} fantasma="shield" etiqueta="Mano secundaria" busqueda={busqueda} onDoble={onDoble} />
          </div>
        </div>
        <div className="ca" aria-label={`Clase de armadura ${p.ca}`}>
          <svg viewBox="0 0 76 84" width="76" height="84" aria-hidden="true">
            <path d="M38 3l32 10v26c0 20-14 34-32 42C20 73 6 59 6 39V13z" fill="#0f0c0a" stroke="#b89a55" strokeWidth="1.5" />
            <path d="M38 9l26 8v22c0 16-11 28-26 35C23 67 12 55 12 39V17z" fill="none" stroke="#4d3e25" strokeWidth="1" />
            <path d="M30 6l8-5 8 5" fill="none" stroke="#e2c27a" strokeWidth="1.2" />
          </svg>
          <span>CA</span>
          <span>{p.ca}</span>
        </div>
        <div>
          <span className="lbl">A distancia</span>
          <div className="par">
            <RanuraEquipo p={p} ranura="distancia" indice={0} fantasma="bow" etiqueta="A distancia" busqueda={busqueda} onDoble={onDoble} />
            <RanuraEquipo p={p} ranura="distancia" indice={1} fantasma="dagger" etiqueta="Mano secundaria" busqueda={busqueda} onDoble={onDoble} />
          </div>
        </div>
      </div>
      <div className="ataques">
        <div><b>{atqM ? conSigno(atqM.bono) : '—'}</b><i>{atqM?.dano ?? '—'}</i></div>
        <div><span className="lbl">Bono de ataque</span><span className="lbl">Daño</span></div>
        <div><b>{atqR ? conSigno(atqR.bono) : '—'}</b><i>{atqR?.dano ?? '—'}</i></div>
      </div>

      <RejillaObjetos
        className="rejilla inv" data-drop={clave} aria-label={`Inventario de ${p.nombre}`}
        celdas={colocar(inventario, 35, 7)} dueno={dueno} porCelda busqueda={busqueda} onDoble={onDoble}
        puedeSoltar={(o) => validar(o.id, { propietario: dueno }).ok}
      />

      <footer className="pie-carga">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.peso} /></svg>
        <div>
          <div className="barra-carga" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number(peso.toFixed(1))} aria-label="Carga">
            <div style={{ height: 8, width: `${Math.min(100, (peso / max) * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${tramo.color}99, ${tramo.color})`, boxShadow: `0 0 8px ${tramo.color}66` }} />
            <span className="tic" style={{ left: '33.3%' }} />
            <span className="tic" style={{ left: '66.6%' }} />
          </div>
          <div className="txt">
            <span style={{ color: tramo.color, fontWeight: 500 }}>{tramo.texto}</span>
            <span><b>{fmtKg(peso)}</b> / {max} kg</span>
          </div>
        </div>
      </footer>
    </article>
  );
}

/** Marco e insignia de «puede recibirlo» mientras se arrastra. Solo esto se re-renderiza al coger un objeto. */
function MarcoColumna({ p, peso, max }: { p: Personaje; peso: number; max: number }) {
  const { validar } = useCofre();
  const { actual } = useArrastreApi();
  const clave = `pj:${p.id}`;
  const estado = useArrastreSel((a) => {
    if (!a) return '';
    const esOrigen = a.objeto.propietario.tipo === 'personaje' && a.objeto.propietario.id === p.id;
    return esOrigen ? '' : `${a.objeto.id}|${dentroDe(a.objetivo?.clave, clave) ? 1 : ''}`;
  });
  const a = estado ? actual() : null;
  if (!a) return null;
  const sobre = estado.endsWith('|1');
  const v = validar(a.objeto.id, { propietario: { tipo: 'personaje', id: p.id } });
  return (
    <>
      <div className={`marco-drop ${v.ok ? 'ok' : 'mal'} ${sobre ? 'fuerte' : ''}`} />
      <div className={`insignia ${v.ok ? 'ok' : 'mal'}`}>
        <Icono d={v.ok ? UI.check : UI.cruz} />
        {v.ok
          ? `${sobre ? `Soltar en ${p.nombre.split(' ')[0]}` : 'Puede recibirlo'} · ${fmt1(v.pesoNuevo ?? peso)} / ${max} kg`
          : v.motivo}
      </div>
    </>
  );
}

// ── Alijo ──────────────────────────────────────────────────────────

const FILTROS: { t: string; cats: Categoria[] | null }[] = [
  { t: 'Todo', cats: null },
  { t: 'Armas', cats: ['Armas', 'Armaduras'] },
  { t: 'Pociones', cats: ['Pociones', 'Pergaminos'] },
  { t: 'Materiales', cats: ['Materiales'] },
];

function Alijo({ busqueda }: { busqueda: string }) {
  const { estado, ordenar } = useCofre();
  const acciones = useObjetos();
  const [filtro, setFiltro] = useState(0);
  const todos = objetosDe(estado, { tipo: 'alijo' });
  const cats = FILTROS[filtro].cats;
  const visibles = cats ? todos.filter((o) => cats.includes(o.categoria)) : todos;

  const pesos = estado.personajes.map((p) => ({ p, peso: pesoPersonajeKg(estado, p) }));
  const pesoGrupo = pesos.reduce((s, x) => s + x.peso, 0);
  const maxGrupo = estado.personajes.reduce((s, p) => s + cargaMaxKg(p.fue), 0);


  return (
    <aside className="panel alijo" aria-label="Alijo de la party" data-drop="alijo">
      <Esquinas />
      <MarcoAlijo />
      <header>
        <div className="alijo-fila">
          <button type="button" className="ibtn" aria-label="Añadir objeto al alijo" title="Añadir objeto al alijo" onClick={() => acciones.nuevo({ tipo: 'alijo' })}><Icono d={UI.mas} /></button>
          <div>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.cofre} /></svg>
            <h2>Alijo de la party</h2>
          </div>
          <MenuBoton className="ibtn" etiqueta="Ordenar el alijo" lado="dcha" opciones={[{ titulo: 'Ordenar alijo por' }, ...opcionesOrden(ordenar, { tipo: 'alijo' })]}>
            <Icono d={UI.ordenar} />
          </MenuBoton>
        </div>
        <span>Cofre común · cualquiera puede dejar o tomar</span>
      </header>
      <div className="filtros" role="group" aria-label="Filtrar alijo">
        {FILTROS.map((f, i) => (
          <button key={f.t} type="button" className={`chip ${i === filtro ? 'on' : ''}`} aria-pressed={i === filtro} onClick={() => setFiltro(i)}>{f.t}</button>
        ))}
      </div>
      {/* Con «Todo», cada objeto en su celda (se ordena a mano); con un filtro, solo los que coinciden */}
      <RejillaObjetos
        className="rejilla alj" aria-label="Objetos del alijo" dueno={{ tipo: 'alijo' }} porCelda={!cats} busqueda={busqueda}
        celdas={cats ? [...visibles, ...Array(Math.max(1, 78 - visibles.length))] : colocar(visibles, 78, 6)}
      />
      <footer>
        <div><span>{todos.length} objetos en el alijo</span><span style={{ color: 'var(--texto)' }}><b>{fmtKg(pesoAlijoKg(estado))}</b> kg</span></div>
        <div><span>Carga del grupo</span><span style={{ fontSize: 14, color: 'var(--texto)' }}><b>{fmtKg(pesoGrupo)}</b> / {maxGrupo} kg</span></div>
        <div className="reparto" aria-hidden="true">
          {pesos.map(({ p, peso }) => (
            <div key={p.id} title={`${p.nombre}: ${fmtKg(peso)} kg`} style={{ width: `${(peso / maxGrupo) * 100}%`, background: p.color }} />
          ))}
          <div style={{ flex: 1, background: '#1a1611', border: '1px solid #3a2f1d' }} />
        </div>
      </footer>
    </aside>
  );
}

function MarcoAlijo() {
  const estado = useArrastreSel((a) => (!a || a.objeto.propietario.tipo === 'alijo' ? '' : dentroDe(a.objetivo?.clave, 'alijo') ? 'sobre' : 'fuera'));
  if (!estado) return null;
  const sobre = estado === 'sobre';
  return (
    <>
      <div className={`marco-drop ok ${sobre ? 'fuerte' : ''}`} />
      <div className="insignia ok"><Icono d={UI.check} />{sobre ? 'Soltar en el alijo' : 'Al alijo · no cuenta para la carga'}</div>
    </>
  );
}

// ── Pie: leyenda, ayuda de arrastre y avisos ──────────────────────

const LEYENDA: [string, string][] = [['r-c', 'Común'], ['r-u', 'Poco común'], ['r-r', 'Raro'], ['r-m', 'Muy raro'], ['r-l', 'Legendario'], ['r-a', 'Artefacto']];

export type Aviso =
  | { id: number; tipo: 'error' | 'info'; texto: string }
  | { id: number; tipo: 'mov'; movId: string };

export function PieGrupal({ aviso }: { aviso: Aviso | null }) {
  const objeto = useArrastreSel((a) => a?.objeto ?? null);
  return (
    <div className="pie">
      <div className="leyenda">
        <span>Rareza</span>
        {LEYENDA.map(([c, t]) => (
          <span key={c} className={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="cuadro" /><span style={{ color: 'var(--rc)' }}>{t}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}><span className="rombo" />Requiere sintonización</span>
      </div>
      {objeto ? (
        <div className="ayuda-arrastre">
          <span><span style={{ width: 12, height: 12, border: '2px solid var(--ok)' }} />Destino válido</span>
          <span><span style={{ width: 12, height: 12, border: '2px solid var(--no)' }} />Destino no válido</span>
          {objeto.cantidad > 1 && <span style={{ color: '#8a7f6c' }}>Mayús + soltar para dividir</span>}
          <span style={{ color: '#8a7f6c' }}>Esc para cancelar</span>
        </div>
      ) : (
        <AvisoActual aviso={aviso} />
      )}
    </div>
  );
}

/** Último aviso: un movimiento («X ha movido Y a Z»), un error o un mensaje. */
export function AvisoActual({ aviso }: { aviso: Aviso | null }) {
  const { estado } = useCofre();
  if (!aviso) return null;
  if (aviso.tipo !== 'mov') {
    return <div key={aviso.id} className={`aviso ${aviso.tipo === 'error' ? 'error' : 'info'}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>{aviso.texto}</div>;
  }
  const mov = estado.movimientos.find((m) => m.id === aviso.movId);
  if (!mov) return null;
  const actorPj = estado.personajes.find((p) => p.nombre === mov.actor || p.nombre.split(' ')[0] === mov.actor);
  const destino = mov.destino.tipo === 'alijo' ? 'Alijo de la party' : estado.personajes.find((p) => p.id === (mov.destino as { id: string }).id)?.nombre;
  return (
    <div key={aviso.id} className="aviso" role="status">
      <span className={`slot has ${CLASE_RAREZA[mov.rareza]}`}><Icono d={ICONOS[mov.icono]} /></span>
      <span>
        <b style={{ color: actorPj?.color ?? 'var(--oro-claro)' }}>{mov.actor}</b> ha movido{' '}
        {mov.cantidad > 1 && `${mov.cantidad} × `}<b className={CLASE_RAREZA[mov.rareza]} style={{ color: 'var(--rc)' }}>{mov.objetoNombre}</b> a{' '}
        <b style={{ color: 'var(--oro-claro)' }}>{destino}</b>
      </span>
      <span style={{ color: '#8a7f6c' }}>· ahora</span>
    </div>
  );
}
