// Pantalla 7 del diseño (alta y edición de objetos), menú contextual de un objeto y confirmación de borrado.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { objetoEnBlanco, type DatosObjeto } from '../domain/objetos';
import { CLASE_RAREZA, NOMBRE_RANURA, RAREZAS, nombreDe } from '../domain/reglas';
import type { Categoria, Objeto, Personaje, Propietario, TipoRanura } from '../domain/tipos';
import { guardarImagen } from '../store/archivos';
import { useCofre } from '../store/cofre';
import { useSintonia, useEscape } from './Dialogos';
import { ICONOS, UI, type ClaveIcono } from './iconos';
import { ListaMenu, type OpcionMenu } from './Menus';
import { EditarPersonaje } from './EditarPersonaje';
import { Esquinas, Icono, Ranura } from './piezas';
import { FichaObjeto } from './Tooltip';

type Avisar = (texto: string, error?: boolean) => void;

interface Acciones {
  nuevo: (propietario: Propietario) => void;
  editar: (o: Objeto) => void;
  /** Menú contextual (clic derecho) de un objeto. */
  menu: (e: React.MouseEvent, o: Objeto) => void;
  /** Sin personaje, abre el alta de uno nuevo. */
  editarPersonaje: (p?: Personaje) => void;
}

const C = createContext<Acciones>({ nuevo: () => {}, editar: () => {}, menu: () => {}, editarPersonaje: () => {} });
export const useObjetos = () => useContext(C);

export function ObjetosProvider({ lienzo, escala, onAviso, children }: {
  lienzo: RefObject<HTMLDivElement>;
  escala: number;
  onAviso: Avisar;
  children: ReactNode;
}) {
  const { estado, mover, eliminarObjeto } = useCofre();
  const sintonia = useSintonia();
  const [form, setForm] = useState<{ objeto?: Objeto; propietario: Propietario } | null>(null);
  const [menu, setMenu] = useState<{ objeto: Objeto; x: number; y: number } | null>(null);
  const [borrar, setBorrar] = useState<Objeto | null>(null);
  const [pj, setPj] = useState<{ p?: Personaje } | null>(null);

  const nuevo = useCallback((propietario: Propietario) => setForm({ propietario }), []);
  const editar = useCallback((objeto: Objeto) => setForm({ objeto, propietario: objeto.propietario }), []);
  const abrirMenu = useCallback((e: React.MouseEvent, objeto: Objeto) => {
    e.preventDefault();
    const base = lienzo.current?.getBoundingClientRect();
    if (!base) return;
    const x = (e.clientX - base.left) / escala, y = (e.clientY - base.top) / escala;
    setMenu({ objeto, x: Math.min(x, 1920 - 250), y: Math.min(y, 1080 - 380) });
  }, [lienzo, escala]);

  const opciones = (o: Objeto): OpcionMenu[] => {
    const destinos: { p: Propietario; texto: string }[] = [
      ...estado.personajes.map((p) => ({ p: { tipo: 'personaje', id: p.id } as Propietario, texto: p.nombre })),
      { p: { tipo: 'alijo' } as Propietario, texto: 'Alijo de la party' },
    ].filter((d) => JSON.stringify(d.p) !== JSON.stringify(o.propietario));
    return [
      { texto: 'Editar objeto', icono: UI.lapiz, onClick: () => editar(o) },
      ...(o.requiereSintonizacion && o.propietario.tipo === 'personaje'
        ? [{ texto: o.sintonizado ? 'Quitar sintonización' : 'Sintonizar', icono: ICONOS.ring, onClick: () => sintonia(o) }]
        : []),
      { titulo: 'Dar a' },
      ...destinos.map((d) => ({
        texto: d.texto, icono: d.p.tipo === 'alijo' ? UI.cofre : UI.persona,
        onClick: () => {
          const v = mover(o.id, { propietario: d.p });
          if (!v.ok) onAviso(v.motivo, true);
        },
      })),
      'separador',
      { texto: 'Eliminar objeto', icono: UI.papelera, peligro: true, onClick: () => setBorrar(o) },
    ];
  };

  const editarPersonaje = useCallback((p?: Personaje) => setPj({ p }), []);
  const valor = useMemo(() => ({ nuevo, editar, menu: abrirMenu, editarPersonaje }), [nuevo, editar, abrirMenu, editarPersonaje]);

  return (
    <C.Provider value={valor}>
      {children}
      {menu && (
        <ListaMenu opciones={opciones(menu.objeto)} onCerrar={() => setMenu(null)} className="flotante" style={{ left: menu.x, top: menu.y }} />
      )}
      {form && (
        <FormularioObjeto
          objeto={form.objeto} propietario={form.propietario} onAviso={onAviso}
          onCerrar={() => setForm(null)} onEliminar={(o) => setBorrar(o)}
        />
      )}
      {pj && <EditarPersonaje p={pj.p} onCerrar={() => setPj(null)} onAviso={onAviso} />}
      {borrar && (
        <ConfirmarBorrado
          objeto={borrar} dueno={nombreDe(estado, borrar.propietario)} onCancelar={() => setBorrar(null)}
          onBorrar={() => {
            eliminarObjeto(borrar.id);
            onAviso(`${borrar.nombre} eliminado`);
            setBorrar(null);
            setForm(null);
          }}
        />
      )}
    </C.Provider>
  );
}

function ConfirmarBorrado({ objeto, dueno, onCancelar, onBorrar }: { objeto: Objeto; dueno: string; onCancelar: () => void; onBorrar: () => void }) {
  useEscape(onCancelar);
  return (
    <>
      <div className="velo arriba" onClick={onCancelar} />
      <section role="alertdialog" aria-modal="true" aria-labelledby="cb-t" className="panel dialogo arriba">
        <Esquinas />
        <header><h2 id="cb-t">¿Eliminar objeto?</h2></header>
        <div className="cb-objeto">
          <Ranura objeto={objeto} aria-hidden="true" style={{ width: 60, height: 60, cursor: 'default' }} />
          <div>
            <b className={CLASE_RAREZA[objeto.rareza]} style={{ color: 'var(--rc)' }}>{objeto.nombre}{objeto.cantidad > 1 ? ` ×${objeto.cantidad}` : ''}</b>
            <span>Lo tiene: {dueno}</span>
          </div>
        </div>
        <p>Se borra para toda la party y no se puede deshacer.</p>
        <div className="acciones">
          <button type="button" className="btn sec" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn peligro" onClick={onBorrar}>Eliminar</button>
        </div>
      </section>
    </>
  );
}

// ── Formulario ─────────────────────────────────────────────────────

const CATEGORIAS: Categoria[] = ['Armas', 'Armaduras', 'Pociones', 'Pergaminos', 'Materiales', 'Comida', 'Llaves/misión', 'Varios'];
const SUBTIPOS: Partial<Record<Categoria, string[]>> = {
  Comida: ['ración', 'plato', 'ingrediente'],
  Materiales: ['hierba', 'mineral', 'parte de criatura', 'reactivo'],
};
const ICONO_CATEGORIA: Record<Categoria, ClaveIcono> = {
  Armas: 'sword', Armaduras: 'armor', Pociones: 'potion', Pergaminos: 'scroll', Materiales: 'herb', Comida: 'bread', 'Llaves/misión': 'key', Varios: 'bag',
};
const RANURAS: TipoRanura[] = ['cabeza', 'capa', 'armadura', 'guantes', 'botas', 'amuleto', 'anillo', 'cuerpoACuerpo', 'distancia'];
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Campos numéricos como texto, para admitir la coma decimal mientras se escribe. */
type Numeros = { cantidad: string; pesoKg: string; valorPo: string; bonoMagico: string; bonoCa: string; cargas: string; cargasMax: string; saciedad: string };
const aTexto = (n: number | undefined) => (n === undefined || n === null ? '' : String(n).replace('.', ','));
const aNumero = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

function datosDe(o: Objeto | undefined, propietario: Propietario): DatosObjeto {
  if (!o) return objetoEnBlanco(propietario);
  const { id: _id, equipadoEn: _e, posicion: _p, sintonizado: _s, ...d } = o;
  return d;
}

function FormularioObjeto({ objeto, propietario, onAviso, onCerrar, onEliminar }: {
  objeto?: Objeto;
  propietario: Propietario;
  onAviso: Avisar;
  onCerrar: () => void;
  onEliminar: (o: Objeto) => void;
}) {
  const { estado, crearObjeto, editarObjeto } = useCofre();
  const [d, setD] = useState<DatosObjeto>(() => datosDe(objeto, propietario));
  const [num, setNum] = useState<Numeros>(() => ({
    cantidad: aTexto(d.cantidad), pesoKg: aTexto(d.pesoKg), valorPo: aTexto(d.valorPo), bonoMagico: aTexto(d.bonoMagico),
    bonoCa: aTexto(d.bonoCa), cargas: aTexto(d.cargas), cargasMax: aTexto(d.cargasMax), saciedad: aTexto(d.saciedad),
  }));
  const [iconoElegido, setIconoElegido] = useState(!!objeto);
  const [error, setError] = useState<string | null>(null);
  useEscape(onCerrar);

  const fijar = <K extends keyof DatosObjeto>(k: K, v: DatosObjeto[K]) => { setD((x) => ({ ...x, [k]: v })); setError(null); };
  const fijarNum = (k: keyof Numeros, v: string) => { setNum((x) => ({ ...x, [k]: v })); setError(null); };

  const esArma = d.categoria === 'Armas' || d.ranuraEquipo === 'cuerpoACuerpo' || d.ranuraEquipo === 'distancia';
  const datosFinales = (): DatosObjeto => ({
    ...d,
    cantidad: aNumero(num.cantidad) ?? NaN,
    pesoKg: aNumero(num.pesoKg) ?? 0,
    valorPo: aNumero(num.valorPo) ?? 0,
    bonoMagico: esArma ? aNumero(num.bonoMagico) : undefined,
    bonoCa: aNumero(num.bonoCa),
    cargas: aNumero(num.cargas),
    cargasMax: aNumero(num.cargasMax),
    saciedad: d.categoria === 'Comida' ? aNumero(num.saciedad) : undefined,
    subtipo: SUBTIPOS[d.categoria]?.includes(d.subtipo ?? '') ? d.subtipo : undefined,
    dado: esArma && d.dado?.trim() ? d.dado.trim() : undefined,
    tipoDano: esArma && d.tipoDano?.trim() ? d.tipoDano.trim() : undefined,
    propiedades: esArma ? d.propiedades?.filter(Boolean) : undefined,
    ranuraEquipo: d.ranuraEquipo || null,
  });

  const vista: Objeto = {
    ...datosFinales(), id: objeto?.id ?? 'vista', nombre: d.nombre.trim() || 'Objeto sin nombre',
    cantidad: Math.max(1, Math.floor(aNumero(num.cantidad) ?? 1)),
    equipadoEn: objeto?.equipadoEn ?? null, sintonizado: objeto?.sintonizado,
  };

  const guardar = () => {
    const datos = datosFinales();
    const r = objeto ? editarObjeto(objeto.id, datos) : crearObjeto(datos);
    if (!r.ok) return setError(r.motivo);
    onAviso(objeto ? `${datos.nombre.trim()} guardado` : `${datos.nombre.trim()} añadido a ${nombreDe(estado, datos.propietario)}`);
    onCerrar();
  };

  const subir = async (f: File | undefined) => {
    if (!f) return;
    try { fijar('imagenUrl', await guardarImagen(f, 'objeto')); } catch { setError('No se ha podido leer la imagen'); }
  };

  const duenos: { p: Propietario; texto: string; color?: string }[] = [
    ...estado.personajes.map((p) => ({ p: { tipo: 'personaje', id: p.id } as Propietario, texto: p.nombre.split(' ')[0], color: p.color })),
    { p: { tipo: 'alijo' }, texto: 'Alijo de la party' },
  ];
  const esDueno = (p: Propietario) => JSON.stringify(p) === JSON.stringify(d.propietario);

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="fo-t" className="panel dialogo fo">
        <Esquinas />
        <header className="fo-cab">
          <h2 id="fo-t">{objeto ? 'Editar objeto' : 'Añadir objeto'}</h2>
          {objeto?.creadoPor && <span className="fo-autor">Creado por {objeto.creadoPor}</span>}
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>

        <form className="fo-cuerpo" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
          <div className="fo-campos">
            <div className="fo-fila" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
              <label className="fo-c"><span className="k">Nombre</span>
                <input id="fo-nombre" className="fo-in" value={d.nombre} autoFocus placeholder="Brazales de la Marea Gris" onChange={(e) => fijar('nombre', e.target.value)} />
              </label>
              <label className="fo-c"><span className="k">Categoría</span>
                <select id="fo-cat" className="fo-in" value={d.categoria} onChange={(e) => {
                  const c = e.target.value as Categoria;
                  setD((x) => ({ ...x, categoria: c, icono: iconoElegido ? x.icono : ICONO_CATEGORIA[c] }));
                }}>
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="fo-c"><span className="k">Subtipo</span>
                <select id="fo-sub" className="fo-in" value={d.subtipo ?? ''} disabled={!SUBTIPOS[d.categoria]} onChange={(e) => fijar('subtipo', e.target.value || undefined)}>
                  <option value="">{SUBTIPOS[d.categoria] ? 'Elige…' : '—'}</option>
                  {SUBTIPOS[d.categoria]?.map((s) => <option key={s} value={s}>{capital(s)}</option>)}
                </select>
              </label>
            </div>

            <div className="fo-imagen">
              <div className="fo-c">
                <span className="k">Imagen del objeto</span>
                <label className="fo-subir">
                  {d.imagenUrl ? <img src={d.imagenUrl} alt="" /> : <><Icono d={UI.subir} /><span>Subir imagen</span><small>Cuadrada, se reduce a 256 px</small></>}
                  <input id="fo-img" type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {d.imagenUrl && <button type="button" className="fo-link" onClick={() => fijar('imagenUrl', undefined)}>Quitar imagen</button>}
              </div>
              <div className="fo-c" style={{ flex: 1 }}>
                <span className="k">O un icono</span>
                <div className="fo-iconos" role="radiogroup" aria-label="Icono">
                  {(Object.keys(ICONOS) as ClaveIcono[]).map((k) => (
                    <button
                      key={k} type="button" role="radio" aria-checked={d.icono === k} aria-label={k}
                      className={`slot ${d.icono === k ? `has ${CLASE_RAREZA[d.rareza]} fo-ic-on` : ''}`}
                      onClick={() => { fijar('icono', k); setIconoElegido(true); }}
                    >
                      <Icono d={ICONOS[k]} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="fo-c"><span className="k">Rareza</span>
              <div className="fo-chips">
                {RAREZAS.map((r) => (
                  <button key={r} type="button" className={`chip ${CLASE_RAREZA[r]} ${d.rareza === r ? 'on' : ''}`} aria-pressed={d.rareza === r} style={{ color: 'var(--rc)', borderColor: d.rareza === r ? 'var(--rc)' : undefined }} onClick={() => fijar('rareza', r)}>
                    {capital(r)}
                  </button>
                ))}
              </div>
            </div>

            <div className="fo-fila" style={{ gridTemplateColumns: 'repeat(4, 1fr) auto' }}>
              <label className="fo-c"><span className="k">Cantidad</span><input id="fo-cant" className="fo-in" inputMode="numeric" value={num.cantidad} onChange={(e) => fijarNum('cantidad', e.target.value)} /></label>
              <label className="fo-c"><span className="k">Peso (kg, por unidad)</span><input id="fo-peso" className="fo-in" inputMode="decimal" value={num.pesoKg} onChange={(e) => fijarNum('pesoKg', e.target.value)} /></label>
              <label className="fo-c"><span className="k">Valor (PO, por unidad)</span><input id="fo-valor" className="fo-in" inputMode="decimal" value={num.valorPo} onChange={(e) => fijarNum('valorPo', e.target.value)} /></label>
              <label className="fo-c"><span className="k">Ranura de equipo</span>
                <select id="fo-ranura" className="fo-in" value={d.ranuraEquipo ?? ''} onChange={(e) => fijar('ranuraEquipo', (e.target.value || null) as TipoRanura | null)}>
                  <option value="">No se equipa</option>
                  {RANURAS.map((r) => <option key={r} value={r}>{NOMBRE_RANURA[r]}</option>)}
                </select>
              </label>
              <label className="fo-check"><input id="fo-sint" type="checkbox" checked={!!d.requiereSintonizacion} onChange={(e) => fijar('requiereSintonizacion', e.target.checked)} />Requiere sintonización</label>
            </div>

            <h3 className="est-sec">Propiedades</h3>
            {esArma && (
              <div className="fo-fila" style={{ gridTemplateColumns: '1fr 1fr 1fr 2fr' }}>
                <label className="fo-c"><span className="k">Dado de daño</span><input id="fo-dado" className="fo-in" placeholder="1d8" value={d.dado ?? ''} onChange={(e) => fijar('dado', e.target.value)} /></label>
                <label className="fo-c"><span className="k">Tipo de daño</span><input id="fo-tipo" className="fo-in" placeholder="cortante" value={d.tipoDano ?? ''} onChange={(e) => fijar('tipoDano', e.target.value)} /></label>
                <label className="fo-c"><span className="k">Bono mágico</span><input id="fo-magia" className="fo-in" inputMode="numeric" placeholder="+1" value={num.bonoMagico} onChange={(e) => fijarNum('bonoMagico', e.target.value.replace('+', ''))} /></label>
                <label className="fo-c"><span className="k">Propiedades (separadas por comas)</span><input id="fo-props" className="fo-in" placeholder="Versátil (1d10), Sutil" value={(d.propiedades ?? []).join(', ')} onChange={(e) => fijar('propiedades', e.target.value.split(',').map((x) => x.trim()))} /></label>
              </div>
            )}
            <div className="fo-fila" style={{ gridTemplateColumns: d.categoria === 'Comida' ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)' }}>
              <label className="fo-c"><span className="k">Bono a CA</span><input id="fo-ca" className="fo-in" inputMode="numeric" placeholder="—" value={num.bonoCa} onChange={(e) => fijarNum('bonoCa', e.target.value.replace('+', ''))} /></label>
              <label className="fo-c"><span className="k">Cargas</span><input id="fo-cargas" className="fo-in" inputMode="numeric" placeholder="—" value={num.cargas} onChange={(e) => fijarNum('cargas', e.target.value)} /></label>
              <label className="fo-c"><span className="k">Cargas máximas</span><input id="fo-cmax" className="fo-in" inputMode="numeric" placeholder="—" value={num.cargasMax} onChange={(e) => fijarNum('cargasMax', e.target.value)} /></label>
              <label className="fo-c"><span className="k">Recarga</span><input id="fo-recarga" className="fo-in" placeholder="Al amanecer" value={d.recarga ?? ''} onChange={(e) => fijar('recarga', e.target.value || undefined)} /></label>
              {d.categoria === 'Comida' && (
                <label className="fo-c"><span className="k">Saciedad</span><input id="fo-sac" className="fo-in" inputMode="numeric" placeholder="+30" value={num.saciedad} onChange={(e) => fijarNum('saciedad', e.target.value.replace('+', ''))} /></label>
              )}
            </div>
            <label className="fo-c"><span className="k">Efectos</span>
              <textarea id="fo-efectos" className="fo-in" rows={2} value={d.efectos ?? ''} onChange={(e) => fijar('efectos', e.target.value || undefined)} />
            </label>
            <div className="fo-fila" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="fo-c"><span className="k">Descripción</span>
                <textarea id="fo-desc" className="fo-in" rows={2} value={d.descripcion ?? ''} onChange={(e) => fijar('descripcion', e.target.value || undefined)} />
              </label>
              <label className="fo-c"><span className="k">Notas de la party</span>
                <textarea id="fo-notas" className="fo-in" rows={2} value={d.notas ?? ''} onChange={(e) => fijar('notas', e.target.value || undefined)} />
              </label>
            </div>
            <div className="fo-c"><span className="k">Propietario</span>
              <div className="fo-chips">
                {duenos.map((x) => (
                  <button key={x.texto} type="button" className={`chip fo-dueno ${esDueno(x.p) ? 'on' : ''}`} aria-pressed={esDueno(x.p)} onClick={() => fijar('propietario', x.p)}>
                    {x.color ? <span className="punto" style={{ background: x.color }} /> : <Icono d={UI.cofre} size={14} />}{x.texto}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="fo-vista" aria-label="Vista previa">
            <h3 className="est-sec">Vista previa</h3>
            <div className="fo-estados">
              <div><Ranura objeto={vista} aria-hidden="true" style={{ cursor: 'default' }} /><span>Inventario</span></div>
              <div><Ranura objeto={vista} extra="hov" aria-hidden="true" style={{ cursor: 'default' }} /><span>Hover</span></div>
              <div><Ranura objeto={{ ...vista, cantidad: 1 }} extra="big" aria-hidden="true" style={{ cursor: 'default' }} /><span>Equipado</span></div>
            </div>
            <FichaObjeto objeto={vista} left={0} top={0} vista />
          </aside>
        </form>

        <footer className="fo-pie">
          {objeto && <button type="button" className="btn peligro-sec" onClick={() => onEliminar(objeto)}>Eliminar objeto</button>}
          {error && <span className="fo-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{objeto ? 'Guardar cambios' : 'Añadir objeto'}</button>
        </footer>
      </section>
    </>
  );
}
