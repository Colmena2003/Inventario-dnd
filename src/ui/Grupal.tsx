// Pantalla 1 y 2 del diseño: vista grupal, con arrastre entre personajes, equipo y alijo.

import { useRef, useState, type CSSProperties } from 'react';
import { hoja } from '../domain/hoja';
import {
  cargaMaxDe, CLASE_RAREZA, conSigno, equipadoEn, fmtKg, objetosDe, pesoAlijoKg, pesoPersonajeKg, primerNombre, SACIEDAD_MAX,
} from '../domain/reglas';
import { ORDENES } from '../domain/reglas';
import type { Categoria, Personaje, TipoRanura } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useArrastre } from './arrastre';
import { useDobleClic } from './Dialogos';
import { UI, type ClaveIcono } from './iconos';
import { ClasesConIcono } from './clases';
import { useEditorPersonaje } from './EditorPersonaje';
import { BotonMenu, type OpcionMenu } from './Menu';
import { Esquinas, fmt1, fmtNum, Icono, IconoObjeto, Orla } from './piezas';
import { DCHA, IZQ, LADO_RETRATO, RanuraEquipo, RejillaObjetos, Silueta, SILUETA_ARMA, useInteraccion } from './interaccion';
import { desglose, tituloAtaque } from './desglose';
import { useEditor } from './editorCtx';
import { useLienzo } from './lienzo';

// ── Pantalla ───────────────────────────────────────────────────────

export function Grupal({ busqueda, onVerFicha }: { busqueda: string; onVerFicha: (personajeId: string) => void }) {
  const { estado } = useCofre();
  const n = estado.personajes.length;
  const util = useLienzo().ancho - 148;
  // Con pocos personajes las columnas y las ranuras crecen, y el alijo ocupa lo que sobra
  const maxCol = n <= 2 ? 500 : n === 3 ? 420 : 352;
  const anchoCol = Math.min(maxCol, Math.floor((util - 300 - 16 * n) / Math.max(n, 1)));
  const slot = Math.min(n <= 2 ? 52 : n === 3 ? 48 : 44, Math.floor((anchoCol - 16 - 4 - 6 * 4) / 7));
  const anchoAlijo = util - n * (anchoCol + 16);

  return (
    <main className="grupal" style={{ '--slot': `${slot}px` } as CSSProperties}>
      {estado.personajes.map((p, i) => (
        <Columna key={p.id} p={p} indice={i} ancho={anchoCol} busqueda={busqueda} onVerFicha={onVerFicha} />
      ))}
      <Alijo busqueda={busqueda} ancho={anchoAlijo} slot={slot} />
    </main>
  );
}

// ── Columna de personaje ──────────────────────────────────────────

function Columna({ p, indice, ancho, busqueda, onVerFicha }: { p: Personaje; indice: number; ancho: number; busqueda: string; onVerFicha: (id: string) => void }) {
  const onDoble = useDobleClic();
  const { estado, validar, cambiarImagen, prepararImagen, ordenar } = useCofre();
  const { arrastre } = useInteraccion(busqueda, onDoble);
  const editor = useEditor();
  const editorPj = useEditorPersonaje();
  const fichero = useRef<HTMLInputElement>(null);

  const propios = objetosDe(estado, { tipo: 'personaje', id: p.id });
  const inventario = propios.filter((o) => !o.equipadoEn);
  const h = hoja(estado, p);
  const peso = h.carga, max = h.cargaMax, tramo = h.tramo, sac = h.saciedad;
  const eq = (r: TipoRanura, i = 0) => equipadoEn(estado, p.id, r, i);
  const armaCaC = eq('cuerpoACuerpo', 0), armaDist = eq('distancia', 0);
  const atqM = h.ataques.find((a) => a.ranura === 'cuerpoACuerpo' && a.indice === 0);
  const atqR = h.ataques.find((a) => a.ranura === 'distancia' && a.indice === 0);
  const silueta = SILUETA_ARMA[(armaCaC ?? armaDist)?.icono as ClaveIcono];

  // Estado de arrastre de esta columna
  const clave = `pj:${p.id}`;
  const sobre = arrastre?.objetivo?.clave.startsWith(clave) ?? false;
  const v = arrastre ? validar(arrastre.objeto.id, { propietario: { tipo: 'personaje', id: p.id } }) : null;
  const esOrigen = arrastre?.objeto.propietario.tipo === 'personaje' && arrastre.objeto.propietario.id === p.id;
  const dueno = { tipo: 'personaje' as const, id: p.id };

  const subirImagen = async (f: File | undefined) => {
    if (!f) return;
    cambiarImagen(p.id, await prepararImagen(f, LADO_RETRATO));
  };

  const opciones: OpcionMenu[] = [
    { texto: 'Ver ficha completa', icono: UI.persona, onClick: () => onVerFicha(p.id) },
    { texto: 'Editar personaje', icono: UI.lapiz, onClick: () => editorPj.editar(p) },
    { texto: 'Añadir objeto', icono: UI.mas, onClick: () => editor.nuevo({ propietario: dueno }) },
    { titulo: 'Ordenar inventario por' },
    ...ORDENES.map((o) => ({ texto: o.texto, icono: UI.ordenar, onClick: () => ordenar(dueno, o.id) })),
    'separador',
    { texto: p.imagenUrl ? 'Cambiar imagen' : 'Subir imagen', icono: UI.camara, onClick: () => fichero.current?.click() },
    ...(p.imagenUrl ? [{ texto: 'Quitar imagen', icono: UI.papelera, onClick: () => cambiarImagen(p.id, '') }] : []),
  ];

  return (
    <article className={`panel columna ${p.imagenUrl ? 'con-fondo' : ''}`} aria-label={p.nombre} style={{ width: ancho }} data-drop={clave}>
      {p.imagenUrl && <img className="fondo-pj" src={p.imagenUrl} alt="" />}
      <Esquinas />
      {arrastre && !esOrigen && v && (
        <>
          <div className={`marco-drop ${v.ok ? 'ok' : 'mal'} ${sobre ? 'fuerte' : ''}`} />
          <div className={`insignia ${v.ok ? 'ok' : 'mal'}`}>
            <Icono d={v.ok ? UI.check : UI.cruz} />
            {v.ok
              ? `${sobre ? `Soltar en ${primerNombre(p.nombre)}` : 'Puede recibirlo'} · ${fmt1(v.pesoNuevo ?? peso)} / ${max} kg`
              : v.motivo}
          </div>
        </>
      )}

      <header className="col-cab">
        <BotonMenu className="ibtn" etiqueta={`Opciones de ${p.nombre}`} opciones={opciones}><Icono d={UI.menu} /></BotonMenu>
        <h2 title={p.nombre}>{p.nombre}</h2>
        <div className="oro">{fmtNum(p.monedas.po)}<i aria-label="piezas de oro" /></div>
      </header>
      <div className="col-sub">
        <span className="col-sub-linea">{p.raza} · <ClasesConIcono clases={p.clases} /> · PV {h.pvActual}/{h.pvMax.total}</span>
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
        <div className="ca" aria-label={`Clase de armadura ${h.ca.total}`} title={desglose(h.ca)}>
          <svg viewBox="0 0 76 84" width="76" height="84" aria-hidden="true">
            <path d="M38 3l32 10v26c0 20-14 34-32 42C20 73 6 59 6 39V13z" fill="#0f0c0a" stroke="#b89a55" strokeWidth="1.5" />
            <path d="M38 9l26 8v22c0 16-11 28-26 35C23 67 12 55 12 39V17z" fill="none" stroke="#4d3e25" strokeWidth="1" />
            <path d="M30 6l8-5 8 5" fill="none" stroke="#e2c27a" strokeWidth="1.2" />
          </svg>
          <span>CA</span>
          <span>{h.ca.total}</span>
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
        <div title={atqM ? tituloAtaque(atqM) : undefined}><b className={atqM?.bono.desv?.length ? 'desv' : ''}>{atqM ? conSigno(atqM.bono.total) : '—'}</b><i>{atqM?.dano ?? '—'}</i></div>
        <div><span className="lbl">Bono de ataque</span><span className="lbl">Daño</span></div>
        <div title={atqR ? tituloAtaque(atqR) : undefined}><b className={atqR?.bono.desv?.length ? 'desv' : ''}>{atqR ? conSigno(atqR.bono.total) : '—'}</b><i>{atqR?.dano ?? '—'}</i></div>
      </div>

      <RejillaObjetos
        className="rejilla inv" aria-label={`Inventario de ${p.nombre}`} objetos={inventario} dueno={dueno} minimo={35} porFila={7}
        busqueda={busqueda} onDoble={onDoble} porCelda valido={!!v?.ok}
      />

      <footer className="pie-col">
        <div className="pie-carga" title={`Saciedad ${p.saciedad}/${SACIEDAD_MAX} · ${sac.efectos.join(' · ') || 'Sin efectos'}`}>
          <Icono d={UI.cuenco} style={{ color: sac.color }} />
          <div>
            <div className="barra-carga" role="meter" aria-valuemin={0} aria-valuemax={SACIEDAD_MAX} aria-valuenow={p.saciedad} aria-label="Saciedad">
              <div style={{ height: 6, width: `${(p.saciedad / SACIEDAD_MAX) * 100}%`, background: `linear-gradient(90deg, ${sac.color}99, ${sac.color})` }} />
            </div>
            <div className="txt">
              <span style={{ color: sac.color, fontWeight: 500 }}>{sac.texto}</span>
              <span><b>{p.saciedad}</b> / {SACIEDAD_MAX}</span>
            </div>
          </div>
        </div>
        <div className="pie-carga">
          <Icono d={UI.peso} />
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
        </div>
      </footer>
    </article>
  );
}

// ── Alijo ──────────────────────────────────────────────────────────

const FILTROS: { t: string; cats: Categoria[] | null }[] = [
  { t: 'Todo', cats: null },
  { t: 'Armas', cats: ['Armas', 'Armaduras'] },
  { t: 'Pociones', cats: ['Pociones', 'Pergaminos'] },
  { t: 'Materiales', cats: ['Materiales'] },
];

function Alijo({ busqueda, ancho, slot }: { busqueda: string; ancho: number; slot: number }) {
  // Tantas ranuras por fila como quepan en el ancho que le queda
  const porFila = Math.max(6, Math.floor((ancho - 20) / (slot + 4)));
  const { estado } = useCofre();
  const editor = useEditor();
  const { arrastre } = useInteraccion(busqueda);
  const onDoble = useDobleClic();
  const [filtro, setFiltro] = useState(0);
  const todos = objetosDe(estado, { tipo: 'alijo' });
  const cats = FILTROS[filtro].cats;
  const visibles = cats ? todos.filter((o) => cats.includes(o.categoria)) : todos;

  const pesos = estado.personajes.map((p) => ({ p, peso: pesoPersonajeKg(estado, p) }));
  const pesoGrupo = pesos.reduce((s, x) => s + x.peso, 0);
  const maxGrupo = estado.personajes.reduce((s, p) => s + cargaMaxDe(estado, p), 0);

  const sobre = !!arrastre?.objetivo?.clave.startsWith('alijo');
  const desdeOtro = arrastre && arrastre.objeto.propietario.tipo !== 'alijo';

  return (
    <aside className="panel alijo" aria-label="Alijo de la party" data-drop="alijo" style={{ width: ancho, '--por-fila': porFila } as CSSProperties}>
      <Esquinas />
      {desdeOtro && (
        <>
          <div className={`marco-drop ok ${sobre ? 'fuerte' : ''}`} />
          <div className="insignia ok"><Icono d={UI.check} />{sobre ? 'Soltar en el alijo' : 'Al alijo · no cuenta para la carga'}</div>
        </>
      )}
      <header>
        <div>
          <Icono d={UI.cofre} />
          <h2>Alijo de la party</h2>
        </div>
        <span>Cofre común · cualquiera puede dejar o tomar</span>
      </header>
      <div className="filtros" role="group" aria-label="Filtrar alijo">
        {FILTROS.map((f, i) => (
          <button key={f.t} type="button" className={`chip ${i === filtro ? 'on' : ''}`} aria-pressed={i === filtro} onClick={() => setFiltro(i)}>{f.t}</button>
        ))}
        <button type="button" className="chip anadir-alijo" aria-label="Añadir objeto al alijo" title="Añadir objeto al alijo" onClick={() => editor.nuevo({ propietario: { tipo: 'alijo' } })}>
          <Icono d={UI.mas} size={13} />
        </button>
      </div>
      <RejillaObjetos
        className="rejilla alj" aria-label="Objetos del alijo" objetos={visibles} dueno={{ tipo: 'alijo' }} minimo={porFila * 13} porFila={porFila}
        busqueda={busqueda} onDoble={onDoble} porCelda={filtro === 0} valido
      />
      <footer>
        <div><span>{todos.length} objetos en el alijo</span><span style={{ color: 'var(--texto)' }}><b>{fmtKg(pesoAlijoKg(estado))}</b> kg</span></div>
        <div><span>Carga del grupo</span><span style={{ fontSize: 14, color: 'var(--texto)' }}><b>{fmtKg(pesoGrupo)}</b> / {maxGrupo} kg</span></div>
        <div className="reparto" aria-hidden="true">
          {pesos.map(({ p, peso }) => (
            <div key={p.id} title={`${p.nombre}: ${fmtKg(peso)} kg`} style={{ width: `${(peso / maxGrupo) * 100}%`, background: p.color }} />
          ))}
          <div style={{ flex: 1, background: 'var(--t-1a1611)', border: '1px solid var(--t-3a2f1d)' }} />
        </div>
      </footer>
    </aside>
  );
}

// ── Pie: leyenda, ayuda de arrastre y avisos ──────────────────────

const LEYENDA: [string, string][] = [['r-c', 'Común'], ['r-u', 'Poco común'], ['r-r', 'Raro'], ['r-m', 'Muy raro'], ['r-l', 'Legendario'], ['r-a', 'Artefacto']];

export type Aviso =
  | { id: number; tipo: 'error' | 'info'; texto: string }
  | { id: number; tipo: 'mov'; movId: string };

export function PieGrupal({ aviso }: { aviso: Aviso | null }) {
  const { arrastre } = useArrastre();
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
      {arrastre ? (
        <div className="ayuda-arrastre">
          <span><span style={{ width: 12, height: 12, border: '2px solid var(--ok)' }} />Destino válido</span>
          <span><span style={{ width: 12, height: 12, border: '2px solid var(--no)' }} />Destino no válido</span>
          {arrastre.objeto.cantidad > 1 && <span style={{ color: 'var(--t-8a7f6c)' }}>Mayús + soltar para dividir</span>}
          <span style={{ color: 'var(--t-8a7f6c)' }}>Esc para cancelar</span>
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
  const actorPj = estado.personajes.find((p) => p.nombre === mov.actor || primerNombre(p.nombre) === mov.actor);
  const destino = mov.destino.tipo === 'alijo' ? 'Alijo de la party' : estado.personajes.find((p) => p.id === (mov.destino as { id: string }).id)?.nombre;
  return (
    <div key={aviso.id} className="aviso" role="status">
      <span className={`slot has ${CLASE_RAREZA[mov.rareza]}`}><IconoObjeto icono={mov.icono} /></span>
      <span>
        <b style={{ color: actorPj?.color ?? 'var(--oro-claro)' }}>{mov.actor}</b> ha movido{' '}
        {mov.cantidad > 1 && `${mov.cantidad} × `}<b className={CLASE_RAREZA[mov.rareza]} style={{ color: 'var(--rc)' }}>{mov.objetoNombre}</b> a{' '}
        <b style={{ color: 'var(--oro-claro)' }}>{destino}</b>
      </span>
      <span style={{ color: 'var(--t-8a7f6c)' }}>· ahora</span>
    </div>
  );
}
