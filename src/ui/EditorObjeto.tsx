// Alta y edición de objetos (diseno/Objeto-editar.dc.html), en dos pasos: primero qué tipo de objeto es y
// después un formulario con lo que ese tipo necesita. La vista previa enseña cómo cambia al personaje.

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ARMADURAS, ARMAS, CARACTERISTICAS, CONDICIONES, DADOS, DEF_OBJETIVO, DES_MAX_POR_TIPO, HABILIDADES, NOMBRE_TIPO_ARMADURA,
  OBJETIVOS, ORDEN_PROPIEDADES, PROPIEDADES, TIPOS_DANO, TIPOS_OBJETO,
} from '../domain/catalogo';
import { parsearFormula, rango } from '../domain/dados';
import { describirMod } from '../domain/describir';
import { hoja, type Hoja, type Valor } from '../domain/hoja';
import { inferirTipo } from '../domain/objetos';
import {
  capital, CLASE_RAREZA, conSigno, mismoPropietario, moverObjeto, NOMBRE_RANURA, personajeDelJugador, primerNombre, RAREZAS, SACIEDAD_MAX,
} from '../domain/reglas';
import { HORA, MINUTO, RONDA, usable } from '../domain/uso';
import type {
  Categoria, DanoExtra, Duracion, Estado, Modificador, Objeto, ObjetivoMod, Personaje, PlantillaEfecto, PropiedadArma, Propietario,
  DatosArmadura, EfectoTirada, TiradaUso, TipoObjeto, TipoRanura,
} from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { avisarUso } from './avisos';
import { useEscape } from './Dialogos';
import { CtxEditor, type ApiEditor } from './editorCtx';
import { claseDe, ICONOS, NOMBRE_ICONO, UI, type ClaveIcono } from './iconos';
import { Esquinas, fmtNum, Icono, IconoObjeto, Ranura } from './piezas';

// ── Contexto: cualquier pantalla puede abrir el editor ─────────────

type Peticion = { objeto?: Objeto; propietario?: Propietario; tipo?: TipoObjeto };

export { useEditor } from './editorCtx';

export function EditorProvider({ onAviso, children }: { onAviso: (texto: string, error?: boolean) => void; children: ReactNode }) {
  const [peticion, setPeticion] = useState<Peticion | null>(null);
  const api = useMemo<ApiEditor>(() => ({
    nuevo: (p) => setPeticion({ propietario: p?.propietario, tipo: p?.tipo }),
    editar: (o) => setPeticion({ objeto: o }),
  }), []);
  return (
    <CtxEditor.Provider value={api}>
      {children}
      {peticion && <Editor key={peticion.objeto?.id ?? 'nuevo'} peticion={peticion} onCerrar={() => setPeticion(null)} onAviso={onAviso} />}
    </CtxEditor.Provider>
  );
}

// ── Valores por defecto de cada tipo ──────────────────────────────

const BASE: Record<TipoObjeto, Partial<Objeto>> = {
  arma: { icono: 'sword', categoria: 'Armas', ranuraEquipo: 'cuerpoACuerpo', tipoArma: 'sencilla', dado: '1d6', tipoDano: 'cortante', propiedades: [], pesoKg: 1, valorPo: 10 },
  municion: { icono: 'dagger', categoria: 'Armas', subtipo: 'munición', ranuraEquipo: null, cantidad: 20, pesoKg: 0.03, valorPo: 0.05 },
  armadura: { icono: 'armor', categoria: 'Armaduras', ranuraEquipo: 'armadura', armadura: { tipo: 'ligera', caBase: 11 }, pesoKg: 5, valorPo: 10 },
  escudo: { icono: 'shield', categoria: 'Armaduras', ranuraEquipo: 'cuerpoACuerpo', bonoCa: 2, pesoKg: 3, valorPo: 10 },
  equipable: { icono: 'ring', categoria: 'Varios', ranuraEquipo: 'anillo', pesoKg: 0.05, valorPo: 50 },
  pocion: { icono: 'potion', categoria: 'Pociones', ranuraEquipo: null, pesoKg: 0.5, valorPo: 50 },
  pergamino: { icono: 'scroll', categoria: 'Pergaminos', ranuraEquipo: null, pesoKg: 0.05, valorPo: 50 },
  comida: { icono: 'bread', categoria: 'Comida', subtipo: 'ración', saciedad: 1, ranuraEquipo: null, pesoKg: 0.5, valorPo: 0.5 },
  material: { icono: 'herb', categoria: 'Materiales', subtipo: 'hierba', ranuraEquipo: null, pesoKg: 0.1, valorPo: 1 },
  mision: { icono: 'key', categoria: 'Llaves/misión', ranuraEquipo: null, pesoKg: 0.1, valorPo: 0 },
  varios: { icono: 'gem', categoria: 'Varios', ranuraEquipo: null, pesoKg: 0.5, valorPo: 1 },
};

const borradorDe = (tipo: TipoObjeto, propietario: Propietario): Objeto => ({
  id: '', nombre: '', rareza: 'común', cantidad: 1, icono: 'bag', categoria: 'Varios', pesoKg: 0, valorPo: 0,
  propietario, equipadoEn: null, tipo, ...BASE[tipo],
});

const CON_MAGIA: TipoObjeto[] = ['arma', 'armadura', 'escudo', 'equipable', 'varios', 'mision', 'municion'];
const CON_USO: TipoObjeto[] = ['pocion', 'pergamino', 'comida', 'varios', 'equipable', 'mision'];
const RANURAS_EQUIPABLE: TipoRanura[] = ['cabeza', 'capa', 'guantes', 'botas', 'amuleto', 'anillo'];
const CATEGORIA_EQUIPABLE: Partial<Record<TipoRanura, Categoria>> = { cabeza: 'Armaduras', guantes: 'Armaduras', botas: 'Armaduras' };
const ICONO_RANURA: Partial<Record<TipoRanura, ClaveIcono>> = { cabeza: 'helm', capa: 'cloak', guantes: 'gloves', botas: 'boots', amuleto: 'amulet', anillo: 'ring' };
const SUBTIPOS: Partial<Record<TipoObjeto, string[]>> = {
  comida: ['ración', 'plato', 'bebida', 'ingrediente'],
  material: ['hierba', 'mineral', 'parte de criatura', 'reactivo'],
};

// ── Editor ─────────────────────────────────────────────────────────

function Editor({ peticion, onCerrar, onAviso }: { peticion: Peticion; onCerrar: () => void; onAviso: (t: string, e?: boolean) => void }) {
  const { estado, actor, guardarObjeto, eliminarObjeto, usar } = useCofre();
  const editando = !!peticion.objeto;
  const propietarioInicial = peticion.propietario ?? { tipo: 'alijo' as const };
  const [o, setO] = useState<Objeto | null>(() =>
    peticion.objeto ? { ...peticion.objeto, tipo: inferirTipo(peticion.objeto) } : peticion.tipo ? borradorDe(peticion.tipo, propietarioInicial) : null);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  useEscape(onCerrar);

  const cambiar = useCallback((c: Partial<Objeto>) => { setError(null); setO((x) => (x ? { ...x, ...c } : x)); }, []);

  if (!o) {
    return (
      <>
        <div className="velo" onClick={onCerrar} />
        <section role="dialog" aria-modal="true" aria-labelledby="ed-t" className="panel editor tipos-paso">
          <Esquinas />
          <header className="ed-cab">
            <h2 id="ed-t">Añadir objeto</h2>
            <span className="ed-paso">Paso 1 de 2 · ¿Qué tipo de objeto es?</span>
            <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
          </header>
          <div className="tipos-rejilla">
            {TIPOS_OBJETO.map((t) => (
              <button key={t.id} type="button" className="tipo-tarjeta" onClick={() => setO(borradorDe(t.id, propietarioInicial))}>
                <span className="slot has r-c"><IconoObjeto icono={t.icono} /></span>
                <b>{t.nombre}</b>
                <span>{t.detalle}</span>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  const tipo = o.tipo ?? 'varios';
  const defTipo = TIPOS_OBJETO.find((t) => t.id === tipo)!;

  const guardar = () => {
    const motivo = guardarObjeto(o, !editando);
    if (motivo) { setError(motivo); return; }
    onAviso(editando ? `${o.nombre.trim()}: cambios guardados` : `${o.nombre.trim()} creado`);
    onCerrar();
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="ed-t" className="panel editor">
        <Esquinas />
        <header className="ed-cab">
          <h2 id="ed-t">{editando ? 'Editar objeto' : 'Añadir objeto'}</h2>
          <span className="ed-paso">
            {editando ? '' : 'Paso 2 de 2 · '}{defTipo.nombre}
            {!editando && <button type="button" className="enlace" onClick={() => setO(null)}>Cambiar tipo</button>}
          </span>
          {o.creadoPor && <span className="ed-autor">Creado por {o.creadoPor}</span>}
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>

        <div className="ed-cuerpo">
          <form className="ed-form" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
            <Identidad o={o} cambiar={cambiar} />
            {tipo === 'arma' && <SeccionArma o={o} cambiar={cambiar} />}
            {tipo === 'armadura' && <SeccionArmadura o={o} cambiar={cambiar} />}
            {tipo === 'escudo' && <SeccionEscudo o={o} cambiar={cambiar} />}
            {tipo === 'equipable' && <SeccionEquipable o={o} cambiar={cambiar} />}
            {tipo === 'comida' && <SeccionComida o={o} cambiar={cambiar} />}
            {SUBTIPOS[tipo] && tipo !== 'comida' && <SeccionSubtipo o={o} cambiar={cambiar} opciones={SUBTIPOS[tipo]!} />}
            {(tipo === 'varios' || tipo === 'mision') && <SeccionRanuraOpcional o={o} cambiar={cambiar} />}
            {CON_MAGIA.includes(tipo) && <SeccionMagia o={o} cambiar={cambiar} />}
            {CON_USO.includes(tipo) && <SeccionAlUsar o={o} cambiar={cambiar} />}
            <SeccionTextos o={o} cambiar={cambiar} tipo={tipo} />
            <button type="submit" hidden />
          </form>
          <VistaPrevia o={o} />
        </div>

        <footer className="ed-pie">
          {editando && (borrar ? (
            <span className="ed-borrar">
              ¿Eliminar {o.nombre} para siempre?
              <button type="button" className="btn peligro" onClick={() => { eliminarObjeto(o.id); onAviso(`${o.nombre} eliminado`); onCerrar(); }}>Sí, eliminar</button>
              <button type="button" className="btn sec" onClick={() => setBorrar(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="btn peligro-sec" onClick={() => setBorrar(true)}>Eliminar objeto</button>
          ))}
          {editando && usable(peticion.objeto!) && (
            <BotonUsar
              o={peticion.objeto!} estado={estado} actor={actor}
              onUsar={(pid) => {
                const r = usar(peticion.objeto!.id, pid);
                if (!r.ok) { setError(r.motivo); return; }
                avisarUso(onAviso, r);
                onCerrar();
              }}
            />
          )}
          {error && <span className="ed-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{editando ? 'Guardar cambios' : 'Crear objeto'}</button>
        </footer>
      </section>
    </>
  );
}

/** «Usar» en el pie del editor. Para lo del alijo, se elige quién lo usa. */
function BotonUsar({ o, estado, actor, onUsar }: { o: Objeto; estado: Estado; actor: string; onUsar: (personajeId?: string) => void }) {
  const delAlijo = o.propietario.tipo === 'alijo';
  const [quien, setQuien] = useState(() => personajeDelJugador(estado, actor)?.id ?? estado.personajes[0]?.id);
  const sinCargas = !!o.cargasMax && (o.cargas ?? 0) < 1;
  return (
    <span className="ed-usar">
      {delAlijo && (
        <select aria-label="Quién lo usa" value={quien} onChange={(e) => setQuien(e.target.value)}>
          {estado.personajes.map((p) => <option key={p.id} value={p.id}>{primerNombre(p.nombre)}</option>)}
        </select>
      )}
      <button type="button" className="btn sec" disabled={sinCargas} title={sinCargas ? 'Sin cargas' : undefined} onClick={() => onUsar(delAlijo ? quien : undefined)}>
        {o.categoria === 'Comida' ? 'Comer' : o.cargasMax ? `Usar · ${o.cargas ?? 0}/${o.cargasMax} cargas` : 'Usar'}
      </button>
    </span>
  );
}

type Sec = { o: Objeto; cambiar: (c: Partial<Objeto>) => void };

export function Campo({ label, ancho, children, ayuda }: { label: string; ancho?: number | string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="campo" style={{ gridColumn: ancho ? `span ${ancho}` : undefined }}>
      <span className="k">{label}</span>
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  );
}

export function Numero({ valor, onCambio, min, max, paso = 1, vacio }: { valor: number | undefined; onCambio: (n: number | undefined) => void; min?: number; max?: number; paso?: number; vacio?: string }) {
  return (
    <input
      type="number" inputMode="decimal" step={paso} min={min} max={max} placeholder={vacio}
      value={valor ?? ''} onChange={(e) => onCambio(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

function Chips<T extends string>({ opciones, valor, onCambio, nombre }: { opciones: readonly T[]; valor: T | undefined; onCambio: (v: T) => void; nombre?: (v: T) => string }) {
  return (
    <div className="chips" role="radiogroup">
      {opciones.map((x) => (
        <button key={x} type="button" role="radio" aria-checked={valor === x} className={`chip ${valor === x ? 'on' : ''}`} onClick={() => onCambio(x)}>
          {nombre ? nombre(x) : capital(x)}
        </button>
      ))}
    </div>
  );
}

export function Seccion({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return (
    <fieldset className="ed-sec">
      <legend>{titulo}</legend>
      {nota && <p className="ed-nota">{nota}</p>}
      <div className="ed-rejilla">{children}</div>
    </fieldset>
  );
}

// ── Identidad: nombre, imagen, rareza, cantidad, peso, valor, dueño ─

const EJEMPLO_NOMBRE: Record<TipoObjeto, string> = {
  arma: 'Hoja del Alba Cenicienta', municion: 'Flechas de plata', armadura: 'Coraza de escamas de wyvern', escudo: 'Escudo del bastión',
  equipable: 'Brazales de la Marea Gris', pocion: 'Poción de aliento de fuego', pergamino: 'Pergamino de Bola de fuego',
  comida: 'Estofado de jabalí', material: 'Escama de dragón verde', mision: 'Llave de la cripta', varios: 'Varita de las chispas',
};

function Identidad({ o, cambiar }: Sec) {
  const { estado, prepararImagen } = useCofre();
  const fichero = useRef<HTMLInputElement>(null);
  const duenos: { p: Propietario; nombre: string; color?: string }[] = [
    ...estado.personajes.map((p) => ({ p: { tipo: 'personaje' as const, id: p.id }, nombre: primerNombre(p.nombre), color: p.color })),
    { p: { tipo: 'alijo' }, nombre: 'Alijo de la party' },
  ];
  return (
    <Seccion titulo="Objeto">
      <Campo label="Nombre" ancho={4}>
        <input autoFocus value={o.nombre} placeholder={EJEMPLO_NOMBRE[o.tipo ?? 'varios']} onChange={(e) => cambiar({ nombre: e.target.value })} />
      </Campo>
      <div className="campo" style={{ gridColumn: 'span 4' }}>
        <span className="k">Rareza</span>
        <div className="chips">
          {RAREZAS.map((r) => (
            <button key={r} type="button" className={`chip rz ${CLASE_RAREZA[r]} ${o.rareza === r ? 'on' : ''}`} aria-pressed={o.rareza === r} onClick={() => cambiar({ rareza: r })}>
              {capital(r)}
            </button>
          ))}
        </div>
      </div>
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Imagen del objeto, o un icono{NOMBRE_ICONO[o.icono as ClaveIcono] && <b className="icono-nombre"> · {NOMBRE_ICONO[o.icono as ClaveIcono]}</b>}</span>
        <div className="ed-imagen">
          <button type="button" className={`subir ${o.imagenUrl ? 'con' : ''}`} onClick={() => fichero.current?.click()}>
            {o.imagenUrl ? <img src={o.imagenUrl} alt="" /> : <><Icono d={UI.camara} size={22} /><span>Subir imagen</span></>}
          </button>
          {o.imagenUrl && <button type="button" className="enlace" onClick={() => cambiar({ imagenUrl: undefined })}>Quitar imagen</button>}
          <input ref={fichero} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cambiar({ imagenUrl: await prepararImagen(f) }); }} />
          <div className="iconos" role="radiogroup" aria-label="Icono">
            {(Object.keys(ICONOS) as ClaveIcono[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={o.icono === k} aria-label={NOMBRE_ICONO[k]} title={NOMBRE_ICONO[k]} className={`slot ${o.icono === k ? `has ${CLASE_RAREZA[o.rareza]} on` : ''}`} onClick={() => cambiar({ icono: k, ...ranuraDelIcono(o, k) })}>
                <IconoObjeto icono={k} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <Campo label="Cantidad"><Numero valor={o.cantidad} min={1} onCambio={(n) => cambiar({ cantidad: Math.max(1, Math.floor(n ?? 1)) })} /></Campo>
      <Campo label="Peso por unidad (kg)"><Numero valor={o.pesoKg} min={0} paso={0.05} onCambio={(n) => cambiar({ pesoKg: n ?? 0 })} /></Campo>
      <Campo label="Valor por unidad (PO)"><Numero valor={o.valorPo} min={0} paso={0.01} onCambio={(n) => cambiar({ valorPo: n ?? 0 })} /></Campo>
      <div className="campo" style={{ gridColumn: 'span 5' }}>
        <span className="k">Lo tiene</span>
        <div className="chips">
          {duenos.map((d) => (
            <button key={d.nombre} type="button" className={`chip ${mismoPropietario(o.propietario, d.p) ? 'on' : ''}`} aria-pressed={mismoPropietario(o.propietario, d.p)} onClick={() => cambiar({ propietario: d.p })}>
              {d.color ? <i className="punto" style={{ background: d.color }} /> : <Icono d={UI.cofre} size={13} />}{d.nombre}
            </button>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

// ── Armas ──────────────────────────────────────────────────────────

function SeccionArma({ o, cambiar }: Sec) {
  const props = new Set(o.propiedades ?? []);
  const alternar = (p: PropiedadArma) => {
    const s = new Set(props);
    if (s.has(p)) s.delete(p); else s.add(p);
    // Una arma a dos manos no puede ser ligera ni versátil
    if (p === 'dosManos' && s.has('dosManos')) { s.delete('versatil'); s.delete('ligera'); }
    if ((p === 'versatil' || p === 'ligera') && s.has(p)) s.delete('dosManos');
    const c: Partial<Objeto> = { propiedades: ORDEN_PROPIEDADES.filter((x) => s.has(x)) };
    if (p === 'municion' && s.has('municion')) c.ranuraEquipo = 'distancia';
    if (p === 'versatil' && s.has('versatil') && !o.dadoVersatil) c.dadoVersatil = subirDado(o.dado ?? '1d6');
    cambiar(c);
  };
  const plantilla = (nombre: string) => {
    const a = ARMAS.find((x) => x.nombre === nombre);
    if (!a) return;
    cambiar({
      nombre: o.nombre.trim() ? o.nombre : a.nombre, tipoArma: a.tipoArma, dado: a.dado, tipoDano: a.tipoDano, pesoKg: a.pesoKg, valorPo: a.valorPo,
      propiedades: a.propiedades, dadoVersatil: a.dadoVersatil, rango: a.rango, ranuraEquipo: a.distancia ? 'distancia' : 'cuerpoACuerpo',
      icono: a.distancia ? 'bow' : /hacha/i.test(a.nombre) ? 'axe' : /martillo|maza|mazo|clava|lucero/i.test(a.nombre) ? 'hammer' : /bast[oó]n/i.test(a.nombre) ? 'staff' : /daga|dardo/i.test(a.nombre) ? 'dagger' : 'sword',
    });
  };
  return (
    <Seccion titulo="Arma" nota="El ataque usa FUE en cuerpo a cuerpo y DES con munición; las propiedades se aplican solas al calcular el ataque y el daño.">
      <Campo label="Partir de un arma del manual" ancho={3}>
        <select value="" onChange={(e) => plantilla(e.target.value)}>
          <option value="">Elegir plantilla…</option>
          <optgroup label="Sencillas">{ARMAS.filter((a) => a.tipoArma === 'sencilla').map((a) => <option key={a.nombre}>{a.nombre}</option>)}</optgroup>
          <optgroup label="Marciales">{ARMAS.filter((a) => a.tipoArma === 'marcial').map((a) => <option key={a.nombre}>{a.nombre}</option>)}</optgroup>
        </select>
      </Campo>
      <div className="campo" style={{ gridColumn: 'span 2' }}>
        <span className="k">Tipo</span>
        <Chips opciones={['sencilla', 'marcial'] as const} valor={o.tipoArma} onCambio={(v) => cambiar({ tipoArma: v })} />
      </div>
      <div className="campo" style={{ gridColumn: 'span 3' }}>
        <span className="k">Se equipa en</span>
        <Chips opciones={['cuerpoACuerpo', 'distancia'] as const} valor={o.ranuraEquipo as 'cuerpoACuerpo' | 'distancia'} nombre={(v) => NOMBRE_RANURA[v]} onCambio={(v) => cambiar({ ranuraEquipo: v })} />
      </div>
      <Campo label="Dado de daño" ancho={2}><Dado valor={o.dado} onCambio={(v) => cambiar({ dado: v })} /></Campo>
      <Campo label="Tipo de daño" ancho={2}><TipoDano valor={o.tipoDano} onCambio={(v) => cambiar({ tipoDano: v })} /></Campo>
      <Campo label="Bono mágico" ayuda="+X al ataque y al daño"><Numero valor={o.bonoMagico} vacio="+0" onCambio={(n) => cambiar({ bonoMagico: n || undefined })} /></Campo>
      <Campo label="Solo al ataque"><Numero valor={o.bonoAtaque} vacio="+0" onCambio={(n) => cambiar({ bonoAtaque: n || undefined })} /></Campo>
      <Campo label="Solo al daño"><Numero valor={o.bonoDano} vacio="+0" onCambio={(n) => cambiar({ bonoDano: n || undefined })} /></Campo>
      <Campo label="Crítico con">
        <select value={o.critico ?? 20} onChange={(e) => cambiar({ critico: Number(e.target.value) === 20 ? undefined : Number(e.target.value) })}>
          {[20, 19, 18, 17].map((n) => <option key={n} value={n}>{n === 20 ? '20' : `${n}–20`}</option>)}
        </select>
      </Campo>

      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Propiedades</span>
        <div className="props">
          {ORDEN_PROPIEDADES.map((p) => (
            <button key={p} type="button" className={`prop ${props.has(p) ? 'on' : ''}`} aria-pressed={props.has(p)} onClick={() => alternar(p)}>
              <b>{PROPIEDADES[p].nombre}</b>
              <span>{PROPIEDADES[p].regla}</span>
            </button>
          ))}
        </div>
      </div>
      {props.has('versatil') && <Campo label="Dado a dos manos (versátil)" ancho={2}><Dado valor={o.dadoVersatil} onCambio={(v) => cambiar({ dadoVersatil: v })} /></Campo>}
      {(props.has('arrojadiza') || props.has('municion')) && (
        <Campo label="Distancia normal / larga" ancho={2}><input value={o.rango ?? ''} placeholder="6/18 m" onChange={(e) => cambiar({ rango: e.target.value || undefined })} /></Campo>
      )}
      <Campo label="Otras propiedades (caseras)" ancho={4} ayuda="Separadas por comas; se enseñan pero no tienen regla automática">
        <input value={(o.otrasPropiedades ?? []).join(', ')} placeholder="Foco arcano, Vampírica" onChange={(e) => cambiar({ otrasPropiedades: e.target.value.split(',').map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) })} />
      </Campo>
      <DanosExtra o={o} cambiar={cambiar} />
    </Seccion>
  );
}

const subirDado = (d: string) => ({ '1d4': '1d6', '1d6': '1d8', '1d8': '1d10', '1d10': '1d12' } as Record<string, string>)[d] ?? d;

function Dado({ valor, onCambio }: { valor?: string; onCambio: (v: string) => void }) {
  return (
    <>
      <input list="ed-dados" value={valor ?? ''} placeholder="1d8" onChange={(e) => onCambio(e.target.value.replace(/\s+/g, ''))} />
      <datalist id="ed-dados">{DADOS.map((d) => <option key={d} value={d} />)}</datalist>
    </>
  );
}

function TipoDano({ valor, onCambio }: { valor?: string; onCambio: (v: string) => void }) {
  return (
    <>
      <input list="ed-danos" value={valor ?? ''} placeholder="cortante" onChange={(e) => onCambio(e.target.value)} />
      <datalist id="ed-danos">{TIPOS_DANO.map((d) => <option key={d} value={d} />)}</datalist>
    </>
  );
}

function DanosExtra({ o, cambiar }: Sec) {
  const lista = o.danosExtra ?? [];
  const fijar = (i: number, c: Partial<DanoExtra>) => cambiar({ danosExtra: lista.map((x, j) => (j === i ? { ...x, ...c } : x)) });
  return (
    <div className="campo" style={{ gridColumn: 'span 8' }}>
      <span className="k">Daño adicional</span>
      {lista.map((x, i) => (
        <div key={i} className="fila-extra">
          <span>+</span>
          <Dado valor={x.dado} onCambio={(v) => fijar(i, { dado: v })} />
          <TipoDano valor={x.tipo} onCambio={(v) => fijar(i, { tipo: v })} />
          <input value={x.condicion ?? ''} placeholder="Condición (opcional): contra muertos vivientes" onChange={(e) => fijar(i, { condicion: e.target.value || undefined })} />
          <button type="button" className="ibtn" aria-label="Quitar" onClick={() => cambiar({ danosExtra: lista.filter((_, j) => j !== i) })}><Icono d={UI.cruz} /></button>
        </div>
      ))}
      <button type="button" className="chip anadir-fila" onClick={() => cambiar({ danosExtra: [...lista, { dado: '1d6', tipo: 'fuego' }] })}>
        <Icono d={UI.mas} size={13} />Añadir daño adicional
      </button>
    </div>
  );
}

// ── Armaduras y escudos ───────────────────────────────────────────

const PIEZAS_ARMADURA: TipoRanura[] = ['armadura', 'cabeza', 'guantes', 'botas'];
const ICONO_PIEZA: Partial<Record<TipoRanura, ClaveIcono>> = { armadura: 'armor', cabeza: 'helm', guantes: 'gloves', botas: 'boots' };
const ARMADURA_NUEVA: DatosArmadura = { tipo: 'ligera', caBase: 11 };

/** Cambiar de pieza: la del cuerpo sustituye la CA; casco, guantes o botas suman a la CA como un escudo. */
const cambiosDePieza = (o: Objeto, r: TipoRanura): Partial<Objeto> => (r === 'armadura'
  ? { ranuraEquipo: r, armadura: o.armadura ?? ARMADURA_NUEVA, bonoCa: undefined }
  : { ranuraEquipo: r, armadura: undefined, bonoCa: o.bonoCa ?? 1 });

/** Elegir el icono de un casco, unos guantes, un anillo… lleva el objeto a esa ranura si su tipo se equipa ahí. */
function ranuraDelIcono(o: Objeto, k: ClaveIcono): Partial<Objeto> {
  const r = (Object.keys(ICONO_RANURA) as TipoRanura[]).find((x) => ICONO_RANURA[x] === k) ?? (k === 'armor' ? 'armadura' : undefined);
  if (!r || r === o.ranuraEquipo) return {};
  if (o.tipo === 'armadura' && PIEZAS_ARMADURA.includes(r)) return cambiosDePieza(o, r);
  if (o.tipo === 'equipable' && RANURAS_EQUIPABLE.includes(r)) return { ranuraEquipo: r, categoria: CATEGORIA_EQUIPABLE[r] ?? 'Varios' };
  return {};
}

function SeccionArmadura({ o, cambiar }: Sec) {
  const pieza = o.ranuraEquipo && o.ranuraEquipo !== 'armadura' ? o.ranuraEquipo : null;
  const elegirPieza = (r: TipoRanura) => cambiar({ ...cambiosDePieza(o, r), icono: ICONO_PIEZA[r] ?? o.icono });
  const donde = (
    <div className="campo" style={{ gridColumn: 'span 8' }}>
      <span className="k">Dónde se lleva</span>
      <Chips opciones={PIEZAS_ARMADURA} valor={o.ranuraEquipo ?? 'armadura'} nombre={(r) => (r === 'armadura' ? 'Cuerpo' : NOMBRE_RANURA[r])} onCambio={elegirPieza} />
    </div>
  );
  if (pieza) {
    return (
      <Seccion titulo="Armadura" nota={`Equipada en ${NOMBRE_RANURA[pieza].toLowerCase()} suma su CA a la que ya tengas, como un escudo. Solo la del cuerpo sustituye la CA sin armadura.`}>
        {donde}
        <Campo label="CA que suma" ayuda="Lo normal es +1"><Numero valor={o.bonoCa} min={0} onCambio={(n) => cambiar({ bonoCa: n ?? 0 })} /></Campo>
        <Campo label="Bono mágico" ayuda="+X a la CA"><Numero valor={o.bonoMagico} vacio="+0" onCambio={(n) => cambiar({ bonoMagico: n || undefined })} /></Campo>
      </Seccion>
    );
  }
  const a = o.armadura ?? ARMADURA_NUEVA;
  const fijar = (c: Partial<typeof a>) => cambiar({ armadura: { ...a, ...c } });
  const tope = a.desMax !== undefined ? a.desMax : DES_MAX_POR_TIPO[a.tipo];
  const plantilla = (nombre: string) => {
    const x = ARMADURAS.find((y) => y.nombre === nombre);
    if (!x) return;
    cambiar({
      nombre: o.nombre.trim() ? o.nombre : x.nombre, pesoKg: x.pesoKg, valorPo: x.valorPo,
      armadura: { tipo: x.tipo, caBase: x.caBase, fueMin: x.fueMin, sigiloDesventaja: x.sigilo },
    });
  };
  return (
    <Seccion titulo="Armadura" nota="Equipada en el cuerpo sustituye a la CA sin armadura: CA base + DES (con el tope de su tipo) + bonos.">
      {donde}
      <Campo label="Partir de una armadura del manual" ancho={3}>
        <select value="" onChange={(e) => plantilla(e.target.value)}>
          <option value="">Elegir plantilla…</option>
          {(['ligera', 'media', 'pesada'] as const).map((t) => (
            <optgroup key={t} label={NOMBRE_TIPO_ARMADURA[t]}>{ARMADURAS.filter((x) => x.tipo === t).map((x) => <option key={x.nombre}>{x.nombre}</option>)}</optgroup>
          ))}
        </select>
      </Campo>
      <div className="campo" style={{ gridColumn: 'span 5' }}>
        <span className="k">Tipo</span>
        <Chips opciones={['ligera', 'media', 'pesada', 'ropa'] as const} valor={a.tipo} nombre={(t) => NOMBRE_TIPO_ARMADURA[t]} onCambio={(t) => fijar({ tipo: t, desMax: undefined, caBase: t === 'ropa' ? 10 : a.caBase })} />
      </div>
      {a.tipo !== 'ropa' && (
        <>
          <Campo label="CA base"><Numero valor={a.caBase} min={0} onCambio={(n) => fijar({ caBase: n ?? 10 })} /></Campo>
          <Campo label="Tope de DES" ayuda={a.tipo === 'pesada' ? 'La pesada no suma DES' : tope == null ? 'Sin tope' : `Hasta +${tope}`}>
            <select value={tope == null ? 'sin' : String(tope)} onChange={(e) => fijar({ desMax: e.target.value === 'sin' ? null : Number(e.target.value) })}>
              <option value="sin">Sin tope</option>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? 'No suma DES' : `+${n}`}</option>)}
            </select>
          </Campo>
          <Campo label="FUE mínima" ayuda="Si no llega: −10 pies"><Numero valor={a.fueMin} min={0} vacio="—" onCambio={(n) => fijar({ fueMin: n || undefined })} /></Campo>
        </>
      )}
      <Campo label="Bono mágico" ayuda="+X a la CA"><Numero valor={o.bonoMagico} vacio="+0" onCambio={(n) => cambiar({ bonoMagico: n || undefined })} /></Campo>
      {a.tipo !== 'ropa' && (
        <label className="check" style={{ gridColumn: 'span 4' }}>
          <input type="checkbox" checked={!!a.sigiloDesventaja} onChange={(e) => fijar({ sigiloDesventaja: e.target.checked || undefined })} />
          Desventaja en pruebas de Sigilo
        </label>
      )}
    </Seccion>
  );
}

function SeccionEscudo({ o, cambiar }: Sec) {
  return (
    <Seccion titulo="Escudo" nota="Va en la mano secundaria cuerpo a cuerpo. No se puede llevar con un arma a dos manos.">
      <Campo label="CA del escudo" ayuda="Un escudo normal da +2"><Numero valor={o.bonoCa} min={0} onCambio={(n) => cambiar({ bonoCa: n ?? 0 })} /></Campo>
      <Campo label="Bono mágico" ayuda="+X a la CA"><Numero valor={o.bonoMagico} vacio="+0" onCambio={(n) => cambiar({ bonoMagico: n || undefined })} /></Campo>
    </Seccion>
  );
}

function SeccionEquipable({ o, cambiar }: Sec) {
  return (
    <Seccion titulo="Dónde se lleva">
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <Chips
          opciones={RANURAS_EQUIPABLE} valor={o.ranuraEquipo ?? undefined} nombre={(r) => NOMBRE_RANURA[r]}
          onCambio={(r) => cambiar({ ranuraEquipo: r, categoria: CATEGORIA_EQUIPABLE[r] ?? 'Varios', icono: ICONO_RANURA[r] ?? o.icono })}
        />
      </div>
    </Seccion>
  );
}

function SeccionRanuraOpcional({ o, cambiar }: Sec) {
  return (
    <Seccion titulo="¿Se equipa?">
      <Campo label="Ranura" ancho={3}>
        <select value={o.ranuraEquipo ?? ''} onChange={(e) => cambiar({ ranuraEquipo: (e.target.value || null) as TipoRanura | null })}>
          <option value="">No se equipa</option>
          {(Object.keys(NOMBRE_RANURA) as TipoRanura[]).map((r) => <option key={r} value={r}>{NOMBRE_RANURA[r]}</option>)}
        </select>
      </Campo>
    </Seccion>
  );
}

// ── Comida y materiales ───────────────────────────────────────────

function SeccionComida({ o, cambiar }: Sec) {
  const n = o.saciedad ?? 0;
  return (
    <Seccion titulo="Comida">
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">¿Cuánta saciedad llena cada unidad?</span>
        <div className="saciedad-sel" role="radiogroup" aria-label="Saciedad">
          {Array.from({ length: SACIEDAD_MAX + 1 }, (_, i) => (
            <button key={i} type="button" role="radio" aria-checked={n === i} className={n === i ? 'on' : ''} onClick={() => cambiar({ saciedad: i })}>
              <b>{i === 0 ? '0' : `+${i}`}</b>
            </button>
          ))}
        </div>
        <span className="ayuda">
          {n === 0 ? 'No se come sola: es un ingrediente para cocinar.' : `Sube ${n} de ${SACIEDAD_MAX} puntos al comerla. La saciedad baja 1 cada 30–90 min en la mazmorra, 1 con un descanso corto y 4 con uno largo.`}
        </span>
      </div>
      <div className="campo" style={{ gridColumn: 'span 8' }}>
        <span className="k">Tipo de comida</span>
        <Chips opciones={SUBTIPOS.comida!} valor={o.subtipo} onCambio={(v) => cambiar({ subtipo: v, saciedad: v === 'ingrediente' && o.saciedad == null ? 0 : o.saciedad })} />
      </div>
    </Seccion>
  );
}

function SeccionSubtipo({ o, cambiar, opciones }: Sec & { opciones: string[] }) {
  return (
    <Seccion titulo="Clase">
      <div className="campo" style={{ gridColumn: 'span 8' }}><Chips opciones={opciones} valor={o.subtipo} onCambio={(v) => cambiar({ subtipo: v })} /></div>
    </Seccion>
  );
}

// ── Magia: sintonización, cargas y modificadores ──────────────────

function SeccionMagia({ o, cambiar }: Sec) {
  const sinRanura = !o.ranuraEquipo;
  const cuando = [
    o.ranuraEquipo && !o.funcionaSinEquipar ? 'equipado' : sinRanura && !o.funcionaSinEquipar && !o.requiereSintonizacion ? 'nunca: márcalo como «funciona con solo llevarlo»' : 'en el inventario de un personaje',
    o.requiereSintonizacion ? 'y sintonizado' : '',
  ].filter(Boolean).join(' ');
  return (
    <Seccion titulo="Magia y modificadores" nota={`Los modificadores cambian solos las estadísticas del personaje mientras el objeto está ${cuando}.`}>
      <label className="check" style={{ gridColumn: 'span 3' }}>
        <input type="checkbox" checked={!!o.requiereSintonizacion} onChange={(e) => cambiar({ requiereSintonizacion: e.target.checked })} />
        Requiere sintonización
      </label>
      <label className="check" style={{ gridColumn: 'span 5' }}>
        <input type="checkbox" checked={!!o.funcionaSinEquipar} onChange={(e) => cambiar({ funcionaSinEquipar: e.target.checked || undefined })} />
        Funciona con solo llevarlo encima (sin equiparlo)
      </label>
      <Campo label="Cargas"><Numero valor={o.cargas} min={0} vacio="—" onCambio={(n) => cambiar({ cargas: n })} /></Campo>
      <Campo label="Cargas máximas"><Numero valor={o.cargasMax} min={0} vacio="—" onCambio={(n) => cambiar({ cargasMax: n || undefined, cargas: o.cargas ?? n })} /></Campo>
      <Campo label="Recarga" ancho={2}><input value={o.recarga ?? ''} placeholder="Al amanecer, 1d6+1…" onChange={(e) => cambiar({ recarga: e.target.value || undefined })} /></Campo>
      <EditorModificadores lista={o.modificadores ?? []} onLista={(modificadores) => cambiar({ modificadores })} />
    </Seccion>
  );
}

// ── Al usar: efecto temporal ──────────────────────────────────────

const UNIDADES: [string, number][] = [['rondas', RONDA], ['minutos', MINUTO], ['horas', HORA]];

/** Duración de un efecto: N rondas, minutos u horas, hasta un descanso o hasta quitarlo. */
export function CamposDuracion({ valor, onCambio }: { valor: Duracion; onCambio: (d: Duracion) => void }) {
  const unidad = valor.tipo === 'tiempo' ? ([...UNIDADES].reverse().find(([, s]) => valor.segundos % s === 0) ?? UNIDADES[0]) : UNIDADES[1];
  const cantidad = valor.tipo === 'tiempo' ? Math.max(1, Math.round(valor.segundos / unidad[1])) : 1;
  const modo = valor.tipo === 'tiempo' ? unidad[0] : valor.tipo === 'descanso' ? `descanso-${valor.descanso}` : 'indefinida';
  const elegir = (m: string, n = cantidad) => {
    const u = UNIDADES.find(([k]) => k === m);
    if (u) onCambio({ tipo: 'tiempo', segundos: Math.max(1, n) * u[1] });
    else if (m === 'indefinida') onCambio({ tipo: 'indefinida' });
    else onCambio({ tipo: 'descanso', descanso: m === 'descanso-corto' ? 'corto' : 'largo' });
  };
  return (
    <>
      {valor.tipo === 'tiempo' && <Campo label="Dura"><Numero valor={cantidad} min={1} onCambio={(n) => elegir(modo, n ?? 1)} /></Campo>}
      <Campo label={valor.tipo === 'tiempo' ? 'Unidad' : 'Dura'} ancho={valor.tipo === 'tiempo' ? 2 : 4}>
        <select value={modo} onChange={(e) => elegir(e.target.value)}>
          {UNIDADES.map(([k]) => <option key={k} value={k}>{k}</option>)}
          <option value="descanso-corto">hasta un descanso corto</option>
          <option value="descanso-largo">hasta un descanso largo</option>
          <option value="indefinida">hasta quitarlo</option>
        </select>
      </Campo>
    </>
  );
}

const EFECTOS_TIRADA: { id: EfectoTirada; texto: string }[] = [
  { id: 'curacion', texto: 'Cura a quien lo usa' },
  { id: 'dano', texto: 'Hace daño' },
  { id: 'otro', texto: 'Solo tirar' },
];

/** [5e] Pociones de curación del Manual del Jugador. */
const POCIONES: [string, string][] = [['Curación', '2d4+2'], ['Mayor', '4d4+4'], ['Superior', '8d4+8'], ['Suprema', '10d4+20']];

/** Los dados que tira al usarlo y qué hace con el resultado; enseña el rango para ver que se ha entendido. */
function CamposTirada({ o, cambiar }: Sec) {
  const t = o.tiradaUso;
  const fijar = (c: Partial<TiradaUso>) => {
    const nueva = { formula: '', efecto: (o.tipo === 'pocion' ? 'curacion' : 'otro') as EfectoTirada, ...t, ...c };
    cambiar({ tiradaUso: nueva.formula ? nueva : undefined });
  };
  const f = t?.formula ? parsearFormula(t.formula) : null;
  const r = f && rango(f.seleccion, f.modificador);
  return (
    <>
      <Campo label="Dados al usarlo" ancho={2} ayuda="2d4+2, 1d6 + 1d4…">
        <input value={t?.formula ?? ''} placeholder="2d4+2" onChange={(e) => fijar({ formula: e.target.value })} aria-invalid={!!t?.formula && !f} />
      </Campo>
      <Campo label="Con el resultado" ancho={2}>
        <select value={t?.efecto ?? (o.tipo === 'pocion' ? 'curacion' : 'otro')} onChange={(e) => fijar({ efecto: e.target.value as EfectoTirada })}>
          {EFECTOS_TIRADA.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
        </select>
      </Campo>
      <div className="campo" style={{ gridColumn: 'span 4' }}>
        <span className="k">Resultado</span>
        {r ? (
          <span className="ayuda tirada-rango">De <b>{r.min}</b> a <b>{r.max}</b> · media <b>{fmtNum(r.media)}</b>{t?.efecto === 'curacion' ? ' PV, sin pasar del máximo' : ''}</span>
        ) : t?.formula ? (
          <span className="ayuda mal">No se entiende: usa d4, d6, d8, d10, d12, d20 o d100</span>
        ) : (
          <span className="ayuda">Sin dados{o.efectos && /\d*d\d+/.test(o.efectos) ? ': se tirarán los que diga «Efectos»' : ''}</span>
        )}
        {o.tipo === 'pocion' && (
          <div className="chips">
            {POCIONES.map(([n, x]) => (
              <button key={n} type="button" className={`chip ${t?.formula === x ? 'on' : ''}`} onClick={() => fijar({ formula: x, efecto: 'curacion' })}>{n} {x}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SeccionAlUsar({ o, cambiar }: Sec) {
  const ef = o.alUsar;
  const fijar = (c: Partial<PlantillaEfecto>) => cambiar({ alUsar: { ...ef!, ...c } });
  return (
    <Seccion
      titulo="Al usarlo"
      nota="Doble clic en el objeto lo usa: gasta una carga (si tiene cargas máximas) o una unidad y tira sus dados en la mesa 3D con el color de quien lo usa. Cuando se paran, aplica el efecto. Además puede dar un efecto temporal a quien lo usa."
    >
      <CamposTirada o={o} cambiar={cambiar} />
      <label className="check" style={{ gridColumn: 'span 8' }}>
        <input
          type="checkbox" checked={!!ef}
          onChange={(e) => cambiar({ alUsar: e.target.checked ? { nombre: o.nombre || 'Efecto', duracion: { tipo: 'tiempo', segundos: HORA }, modificadores: [] } : undefined })}
        />
        Da un efecto temporal a quien lo usa
      </label>
      {ef && (
        <>
          <Campo label="Nombre del efecto" ancho={4}><input value={ef.nombre} onChange={(e) => fijar({ nombre: e.target.value })} /></Campo>
          <CamposDuracion valor={ef.duracion} onCambio={(duracion) => fijar({ duracion })} />
          <EditorModificadores lista={ef.modificadores} onLista={(modificadores) => fijar({ modificadores })} ayuda="Qué cambia mientras dura: FUE 21, +2 CA, resistencia al fuego…" />
        </>
      )}
    </Seccion>
  );
}

const ATAJOS: [string, Modificador][] = [
  ['+1 CA', { objetivo: 'ca', valor: 1 }],
  ['+1 salvaciones', { objetivo: 'salv:todas', valor: 1 }],
  ['+2 FUE', { objetivo: 'car:fue', valor: 2 }],
  ['FUE 19', { objetivo: 'car:fue', valor: 19, fijar: true }],
  ['+1 ataque', { objetivo: 'ataque', valor: 1 }],
  ['+1 daño', { objetivo: 'dano', valor: 1 }],
  ['+5 Percepción pasiva', { objetivo: 'pasiva:percepcion', valor: 5 }],
  ['+10 pies de velocidad', { objetivo: 'vel:caminar', valor: 10 }],
  ['Resistencia', { objetivo: 'resistencia', texto: 'fuego' }],
  ['Visión en la oscuridad', { objetivo: 'sentido:oscuridad', valor: 18, fijar: true }],
];

export function EditorModificadores({ lista, onLista, ayuda }: { lista: Modificador[]; onLista: (l: Modificador[]) => void; ayuda?: string }) {
  const fijar = (i: number, m: Modificador) => onLista(lista.map((x, j) => (j === i ? m : x)));
  const anadir = (m: Modificador) => onLista([...lista, m]);
  return (
    <div className="campo mods" style={{ gridColumn: 'span 8' }}>
      <span className="k">Modificadores</span>
      {lista.length === 0 && <span className="ayuda">{ayuda ?? 'Sin modificadores. Añade los que tenga: +X a una característica, CA, ataque, daño, salvaciones, pasivas, velocidad, resistencias…'}</span>}
      {lista.map((m, i) => <FilaMod key={i} m={m} onCambio={(x) => fijar(i, x)} onQuitar={() => onLista(lista.filter((_, j) => j !== i))} />)}
      <div className="chips">
        <button type="button" className="chip on anadir-fila" onClick={() => anadir({ objetivo: 'car:fue', valor: 1 })}><Icono d={UI.mas} size={13} />Añadir modificador</button>
        {ATAJOS.map(([t, m]) => <button key={t} type="button" className="chip" onClick={() => anadir(m)}>{t}</button>)}
      </div>
    </div>
  );
}

function FilaMod({ m, onCambio, onQuitar }: { m: Modificador; onCambio: (m: Modificador) => void; onQuitar: () => void }) {
  const def = DEF_OBJETIVO[m.objetivo];
  const cambiarObjetivo = (id: ObjetivoMod) => {
    const d = DEF_OBJETIVO[id];
    const defecto: Record<string, Partial<Modificador>> = {
      numero: { valor: m.valor ?? 1 }, dano: { texto: TIPOS_DANO[5] }, condicion: { texto: CONDICIONES[7] },
      habilidad: { texto: 'percepcion' }, caracteristica: { texto: 'con' }, texto: { texto: '' }, dado: { texto: '1d4 fuego' },
    };
    onCambio({ objetivo: id, ...defecto[d.clase] });
  };
  return (
    <div className="fila-mod">
      <select value={m.objetivo} onChange={(e) => cambiarObjetivo(e.target.value as ObjetivoMod)} aria-label="Qué modifica">
        {OBJETIVOS.map((g) => (
          <optgroup key={g.grupo} label={g.grupo}>{g.items.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}</optgroup>
        ))}
      </select>
      {def.clase === 'numero' && (
        <>
          {def.fijable && (
            <select value={m.fijar ? 'fijar' : 'sumar'} onChange={(e) => onCambio({ ...m, fijar: e.target.value === 'fijar' || undefined })} aria-label="Cómo">
              <option value="sumar">Suma</option>
              <option value="fijar">Pasa a ser al menos</option>
            </select>
          )}
          <input type="number" aria-label="Valor" value={m.valor ?? 0} onChange={(e) => onCambio({ ...m, valor: Number(e.target.value) })} />
          {def.unidad && <span className="unidad">{def.unidad}</span>}
        </>
      )}
      {def.clase === 'dano' && <select value={m.texto} onChange={(e) => onCambio({ ...m, texto: e.target.value })}>{TIPOS_DANO.map((t) => <option key={t}>{t}</option>)}<option value="daño no mágico">daño no mágico</option></select>}
      {def.clase === 'condicion' && <select value={m.texto} onChange={(e) => onCambio({ ...m, texto: e.target.value })}>{CONDICIONES.map((t) => <option key={t}>{t}</option>)}</select>}
      {def.clase === 'habilidad' && <select value={m.texto} onChange={(e) => onCambio({ ...m, texto: e.target.value })}>{HABILIDADES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}
      {def.clase === 'caracteristica' && <select value={m.texto} onChange={(e) => onCambio({ ...m, texto: e.target.value })}>{CARACTERISTICAS.map(([k, , n]) => <option key={k} value={k}>{n}</option>)}</select>}
      {(def.clase === 'texto' || def.clase === 'dado') && (
        <input className="ancho" value={m.texto ?? ''} placeholder={def.clase === 'dado' ? '1d4 fuego' : m.objetivo === 'nota' ? 'Respiras bajo el agua' : 'tiradas de salvación contra veneno'} onChange={(e) => onCambio({ ...m, texto: e.target.value })} />
      )}
      <span className="mod-texto">{describirMod(m)}</span>
      <button type="button" className="ibtn" aria-label="Quitar modificador" onClick={onQuitar}><Icono d={UI.cruz} /></button>
    </div>
  );
}

// ── Textos ────────────────────────────────────────────────────────

function SeccionTextos({ o, cambiar, tipo }: Sec & { tipo: TipoObjeto }) {
  const pistaEfecto: Partial<Record<TipoObjeto, string>> = {
    pocion: 'Recuperas 2d4+2 PV.', pergamino: 'Conjuro: Bola de fuego (nivel 3), CD 15.', comida: '+1d4 PV temporales.',
  };
  return (
    <Seccion titulo="Descripción">
      <Campo label={tipo === 'pergamino' ? 'Conjuro y efecto' : 'Efectos'} ancho={8}>
        <textarea rows={2} value={o.efectos ?? ''} placeholder={pistaEfecto[tipo] ?? 'Gasta 1 carga como reacción para…'} onChange={(e) => cambiar({ efectos: e.target.value || undefined })} />
      </Campo>
      <Campo label="Descripción" ancho={4}>
        <textarea rows={3} value={o.descripcion ?? ''} onChange={(e) => cambiar({ descripcion: e.target.value || undefined })} />
      </Campo>
      <Campo label="Notas de la party" ancho={4}>
        <textarea rows={3} value={o.notas ?? ''} onChange={(e) => cambiar({ notas: e.target.value || undefined })} />
      </Campo>
    </Seccion>
  );
}

// ── Vista previa: ranura y cambios en el personaje ────────────────

/** El estado con el borrador en manos de `pj`, equipado en su ranura y sintonizado si lo pide. */
function simular(e: Estado, o: Objeto, pj: Personaje): Estado {
  const sim: Objeto = { ...o, id: o.id || '__previa', propietario: { tipo: 'personaje', id: pj.id }, equipadoEn: null, sintonizado: !!o.requiereSintonizacion };
  let r: Estado = { ...e, objetos: [...e.objetos.filter((x) => x.id !== sim.id), sim] };
  if (sim.ranuraEquipo) {
    const yaEquipado = o.equipadoEn && o.propietario.tipo === 'personaje' && o.propietario.id === pj.id ? o.equipadoEn : null;
    try {
      r = moverObjeto(r, sim.id, { propietario: sim.propietario, equipar: yaEquipado ?? { ranura: sim.ranuraEquipo, indice: sim.ranuraEquipo === 'cuerpoACuerpo' && o.tipo === 'escudo' ? 1 : 0 } }, '');
    } catch { /* sin espacio o sin carga: se ve como si lo llevara sin equipar */ }
  }
  return r;
}

type Cambio = { nombre: string; antes: string; despues: string; mejor: boolean };

function cambios(a: Hoja, b: Hoja): Cambio[] {
  const r: Cambio[] = [];
  const num = (nombre: string, x: Valor | undefined, y: Valor | undefined, signo = false, u = '') => {
    if (!x || !y || x.total === y.total) return;
    const f = (n: number) => (signo ? conSigno(n) : fmtNum(n)) + u;
    r.push({ nombre, antes: f(x.total), despues: f(y.total), mejor: y.total > x.total });
  };
  for (const [k, abrev] of CARACTERISTICAS) num(abrev, a.car[k], b.car[k]);
  num('CA', a.ca, b.ca);
  num('PV máximos', a.pvMax, b.pvMax);
  num('Iniciativa', a.iniciativa, b.iniciativa, true);
  num('Velocidad', a.velocidad.caminar, b.velocidad.caminar, false, ' pies');
  for (const m of ['volar', 'nadar', 'trepar', 'excavar'] as const) num(`Velocidad (${m})`, a.velocidad[m], b.velocidad[m], false, ' pies');
  num('Percepción pasiva', a.pasivas.percepcion, b.pasivas.percepcion);
  num('Investigación pasiva', a.pasivas.investigacion, b.pasivas.investigacion);
  num('Perspicacia pasiva', a.pasivas.perspicacia, b.pasivas.perspicacia);
  num('CD de conjuros', a.conjuros?.cd, b.conjuros?.cd);
  num('Ataque de conjuro', a.conjuros?.ataque, b.conjuros?.ataque, true);
  num('Competencia', a.competencia, b.competencia, true);
  for (const [k, abrev] of CARACTERISTICAS) num(`Salvación ${abrev}`, a.salvaciones[k], b.salvaciones[k], true);
  for (const [k, n] of HABILIDADES) num(n, a.habilidades[k], b.habilidades[k], true);
  if (a.cargaMax !== b.cargaMax) r.push({ nombre: 'Carga máxima', antes: `${a.cargaMax} kg`, despues: `${b.cargaMax} kg`, mejor: b.cargaMax > a.cargaMax });
  for (const atq of b.ataques) {
    const prev = a.ataques.find((x) => x.ranura === atq.ranura && x.indice === atq.indice);
    const t = (x: typeof atq | undefined) => (x ? `${conSigno(x.bono.total)} · ${x.dano}` : '—');
    if (t(prev) !== t(atq) || prev?.objeto.id !== atq.objeto.id) {
      r.push({ nombre: atq.indice === 0 ? NOMBRE_RANURA[atq.ranura] : `${NOMBRE_RANURA[atq.ranura]} (secundaria)`, antes: t(prev), despues: t(atq), mejor: true });
    }
  }
  const textos = (lista: (h: Hoja) => { texto: string }[], etiqueta: string) => {
    const antes = new Set(lista(a).map((x) => x.texto));
    for (const x of lista(b)) if (!antes.has(x.texto)) r.push({ nombre: etiqueta, antes: '', despues: x.texto, mejor: etiqueta !== 'Vulnerable' && etiqueta !== 'Desventaja' });
  };
  textos((h) => h.resistencias, 'Resistencia');
  textos((h) => h.inmunidades, 'Inmunidad');
  textos((h) => h.inmuneCondiciones, 'Inmune a');
  textos((h) => h.vulnerabilidades, 'Vulnerable');
  textos((h) => h.ventajas, 'Ventaja');
  textos((h) => h.desventajas, 'Desventaja');
  textos((h) => h.notas, 'Efecto');
  textos((h) => h.sentidos.map((s) => ({ texto: `${s.nombre} ${fmtNum(s.metros)} m` })), 'Sentido');
  return r;
}

function VistaPrevia({ o }: { o: Objeto }) {
  const { estado } = useCofre();
  const dueno = o.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (o.propietario as { id: string }).id) : undefined;
  const [verId, setVerId] = useState<string>(dueno?.id ?? estado.personajes[0]?.id ?? '');
  const pj = dueno ?? estado.personajes.find((p) => p.id === verId);
  const lista = useMemo(() => {
    if (!pj) return [];
    const sinElObjeto: Estado = { ...estado, objetos: estado.objetos.filter((x) => x.id !== o.id) };
    return cambios(hoja(sinElObjeto, pj), hoja(simular(estado, o, pj), pj));
  }, [estado, o, pj]);
  const subtitulo = [claseDe(o), capital(o.rareza)];
  const nombre = o.nombre.trim() || 'Sin nombre';

  return (
    <aside className="ed-previa" aria-label="Vista previa">
      <span className="k">Vista previa</span>
      <div className={`previa-ficha ${CLASE_RAREZA[o.rareza]}`}>
        <Ranura objeto={{ ...o, nombre, cantidad: o.cantidad }} extra="hov" style={{ width: 72, height: 72, cursor: 'default' }} aria-hidden="true" />
        <div>
          <b className="tt-nombre">{nombre}</b>
          <span className="tt-sub">{subtitulo.join(' · ')}{o.requiereSintonizacion ? ' · Sintonización' : ''}</span>
          {o.categoria === 'Comida' && <span className="previa-sac">{o.saciedad ? `+${o.saciedad} saciedad` : 'No se come sola'}</span>}
        </div>
      </div>
      {!!o.modificadores?.length && (
        <ul className="tt-mods">{o.modificadores.map((m, i) => <li key={i}>{describirMod(m)}</li>)}</ul>
      )}

      {estado.personajes.length > 0 && (
        <div className="previa-efecto">
          <div className="previa-quien">
            <span className="k">Efecto en</span>
            {dueno ? <b>{dueno.nombre}</b> : (
              <select value={verId} onChange={(e) => setVerId(e.target.value)} aria-label="Ver el efecto en">
                {estado.personajes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </div>
          <span className="ayuda">
            {o.ranuraEquipo ? `Equipado en ${NOMBRE_RANURA[o.ranuraEquipo].toLowerCase()}` : o.funcionaSinEquipar ? 'Llevándolo encima' : 'En el inventario'}
            {o.requiereSintonizacion ? ' y sintonizado' : ''}
          </span>
          {lista.length === 0 ? (
            <p className="vacio">No cambia ninguna estadística.</p>
          ) : (
            <ul className="previa-cambios">
              {lista.map((c, i) => (
                <li key={i}>
                  <span>{c.nombre}</span>
                  {c.antes && <span className="antes">{c.antes}</span>}
                  {c.antes && <span aria-hidden="true">→</span>}
                  <b className={c.mejor ? 'sube' : 'baja'}>{c.despues}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
