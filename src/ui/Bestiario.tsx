// Bestiario: criaturas con las que se ha cruzado la party. Cartas con lo esencial, ficha completa al pulsar
// y un formulario donde solo el nombre es obligatorio: lo que no se sabe sale como «sin descubrir».

import { useRef, useState, type ReactNode } from 'react';
import {
  ACTITUDES, conocido, criaturaVacia, fichaDeBotin, habilidadOculta, habilidadVacia, pxPorDesafio, TIPOS_HABILIDAD, valorDesafio,
} from '../domain/bestiario';
import { CARACTERISTICAS } from '../domain/catalogo';
import { CLASE_RAREZA, conSigno, modificador } from '../domain/reglas';
import type { Actitud, BotinCriatura, Caracteristica, Criatura, HabilidadCriatura, TipoHabilidad } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useAvisar } from './avisos';
import { useDetalle } from './DetalleObjeto';
import { useEscape } from './Dialogos';
import { Campo, Numero, Seccion } from './EditorObjeto';
import { ICONOS, UI } from './iconos';
import { Esquinas, Icono } from './piezas';

type Datos = Omit<Criatura, 'id' | 'creada' | 'actualizada'>;
type Orden = 'recientes' | 'nombre' | 'desafio' | 'encuentros';

const claseActitud = (a: Actitud) => a.replace(' ', '-');
const ICONO_ACTITUD: Record<Actitud, string> = { agresiva: UI.garra, 'no agresiva': UI.mano, desconocida: UI.lupa };
const textoActitud = (a: Actitud) => ACTITUDES.find((x) => x.id === a)!.texto;
const subtitulo = (c: Datos) => [c.tamano, c.tipo, c.alineamiento].filter(Boolean).join(' · ') || 'Tipo y tamaño sin descubrir';

export function Bestiario({ busqueda }: { busqueda: string }) {
  const { estado } = useCofre();
  const [filtro, setFiltro] = useState<Actitud | null>(null);
  const [orden, setOrden] = useState<Orden>('recientes');
  const [ver, setVer] = useState<string | null>(null);
  const [editar, setEditar] = useState<{ id?: string } | null>(null);

  const todas = estado.bestiario ?? [];
  const q = busqueda.trim().toLocaleLowerCase('es');
  const visibles = todas
    .filter((c) => !filtro || c.actitud === filtro)
    .filter((c) => !q || c.nombre.toLocaleLowerCase('es').includes(q))
    .sort(orden === 'nombre' ? (a, b) => a.nombre.localeCompare(b.nombre, 'es')
      : orden === 'desafio' ? (a, b) => valorDesafio(b.desafio) - valorDesafio(a.desafio)
      : orden === 'encuentros' ? (a, b) => (b.encuentros ?? 0) - (a.encuentros ?? 0)
      : (a, b) => b.actualizada - a.actualizada);
  const cuenta = (a: Actitud) => todas.filter((c) => c.actitud === a).length;
  const viendo = todas.find((c) => c.id === ver);

  return (
    <main className="bestiario">
      <header className="panel bib-cab">
        <Esquinas />
        <div className="bib-titulo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.calavera} /></svg>
          <div>
            <h1>Bestiario</h1>
            <span>{todas.length} criaturas · {cuenta('agresiva')} agresivas · {cuenta('no agresiva')} no agresivas · lo que no se sabe queda sin descubrir</span>
          </div>
        </div>
        <div className="bib-filtros">
          <div className="filtros" role="group" aria-label="Actitud">
            <button type="button" className={`chip ${!filtro ? 'on' : ''}`} aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todas</button>
            {ACTITUDES.map((a) => <button key={a.id} type="button" className={`chip ${filtro === a.id ? 'on' : ''}`} aria-pressed={filtro === a.id} onClick={() => setFiltro(a.id)}>{a.texto}</button>)}
          </div>
          <label className="orden">
            Ordenar
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="recientes">Más recientes</option>
              <option value="nombre">Nombre</option>
              <option value="desafio">Desafío</option>
              <option value="encuentros">Encuentros</option>
            </select>
          </label>
          <button type="button" className="btn pri cr-nueva" onClick={() => setEditar({})}><Icono d={UI.mas} />Nueva criatura</button>
        </div>
      </header>

      {visibles.length === 0 ? (
        <div className="bib-vacia">
          <h2>{todas.length ? 'Ninguna coincide' : 'Aún no hay criaturas'}</h2>
          <p>{todas.length ? 'Prueba con otro filtro o busca otro nombre.' : 'Apunta la primera criatura con la que os habéis cruzado: basta con el nombre.'}</p>
        </div>
      ) : (
        <ul className="cr-rejilla" aria-label="Criaturas">
          {visibles.map((c) => <li key={c.id}><Carta c={c} onAbrir={() => setVer(c.id)} /></li>)}
        </ul>
      )}

      {viendo && !editar && <FichaCriatura c={viendo} onCerrar={() => setVer(null)} onEditar={() => setEditar({ id: viendo.id })} />}
      {editar && (
        <EditorCriatura
          key={editar.id ?? 'nueva'} inicial={todas.find((c) => c.id === editar.id)}
          onCerrar={() => setEditar(null)}
          onGuardada={(id) => { setEditar(null); setVer(id); }}
          onEliminada={() => { setEditar(null); setVer(null); }}
        />
      )}
    </main>
  );
}

function Carta({ c, onAbrir }: { c: Criatura; onAbrir: () => void }) {
  const { estado } = useCofre();
  const sabido = Math.round(conocido(c) * 100);
  return (
    <button type="button" className={`cr-carta ${claseActitud(c.actitud)}`} onClick={onAbrir}>
      <span className="cr-arte">
        {c.imagenUrl ? <img src={c.imagenUrl} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.calavera} /></svg>}
        <span className="cr-actitud"><Icono d={ICONO_ACTITUD[c.actitud]} size={13} />{textoActitud(c.actitud)}</span>
        {c.desafio && <span className="cr-vd">VD {c.desafio}</span>}
      </span>
      <span className="cr-nombre">{c.nombre}</span>
      <span className="cr-sub">{subtitulo(c)}</span>
      <span className="cr-mini">
        <span><Icono d={UI.escudoCa} size={14} />CA <b>{c.ca ?? '?'}</b></span>
        <span><Icono d={UI.corazon} size={14} />PV <b>{c.pv ?? '?'}</b></span>
        <span>{c.encuentros ?? 0} enc. · {c.derrotadas ?? 0} abat.</span>
      </span>
      <span className="cr-botin-mini">
        {c.botin.map((b, i) => {
          const f = fichaDeBotin(estado, b);
          return f
            ? <span key={i} className={`slot has ${CLASE_RAREZA[f.rareza]}`} title={f.nombre}>{f.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f.icono]} />}</span>
            : <span key={i} className="slot has r-c" title={b.nombre}><Icono d={ICONOS.bag} /></span>;
        })}
      </span>
      <span className="cr-sabido"><span><span style={{ width: `${sabido}%` }} /></span>{sabido} % conocido</span>
    </button>
  );
}

// ── Ficha ──────────────────────────────────────────────────────────

const DETALLES: [keyof Criatura, string][] = [
  ['salvaciones', 'Tiradas de salvación'], ['pericias', 'Pericias'], ['resistencias', 'Resistencias'], ['inmunidades', 'Inmunidades'],
  ['vulnerabilidades', 'Vulnerabilidades'], ['sentidos', 'Sentidos'], ['idiomas', 'Idiomas'],
];

function FichaCriatura({ c, onCerrar, onEditar }: { c: Criatura; onCerrar: () => void; onEditar: () => void }) {
  const { estado, registrarEncuentro, guardarCriatura, prepararImagen } = useCofre();
  const detalle = useDetalle();
  const avisar = useAvisar();
  const fichero = useRef<HTMLInputElement>(null);
  useEscape(onCerrar);

  const imagen = async (f: File | undefined) => {
    if (!f) return;
    const r = guardarCriatura({ ...c, imagenUrl: await prepararImagen(f, 900) }, c.id);
    if (!r.ok) avisar(r.motivo, true);
  };
  const px = c.px ?? pxPorDesafio(c.desafio);
  const sabidos = DETALLES.filter(([k]) => c[k]);
  const ocultos = DETALLES.filter(([k]) => !c[k]).map(([, t]) => t.toLowerCase());
  const dato = (titulo: string, icono: string | null, valor: ReactNode, extra?: string, texto = false) => (
    <div className={`cr-dato ${valor === undefined || valor === '' ? 'oculto' : ''} ${texto ? 'texto' : ''}`}>
      <span>{icono && <Icono d={icono} size={13} />}{titulo}</span>
      <b>{valor === undefined || valor === '' ? '?' : valor}</b>
      {extra && <small>{extra}</small>}
    </div>
  );

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="cr-t" className={`panel dialogo cr ${claseActitud(c.actitud)}`}>
        <Esquinas />
        <button type="button" className="ibtn vo-cerrar" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        <div className="cr-izq">
          <div className={`cr-imagen ${c.imagenUrl ? '' : 'vacia'}`}>
            {c.imagenUrl ? (
              <>
                <img className="cr-imagen-fondo" src={c.imagenUrl} alt="" aria-hidden="true" />
                <img src={c.imagenUrl} alt={c.nombre} />
              </>
            ) : (
              <button type="button" className="cr-imagen-subir" onClick={() => fichero.current?.click()}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.calavera} /></svg>
                <span>Sube una imagen de la criatura</span>
              </button>
            )}
          </div>
          <div className="vo-imagen-acc">
            <button type="button" className="pbtn" onClick={() => fichero.current?.click()}><Icono d={UI.camara} />{c.imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}</button>
            {c.imagenUrl && <button type="button" className="pbtn" onClick={() => guardarCriatura({ ...c, imagenUrl: undefined }, c.id)}><Icono d={UI.papelera} />Quitar</button>}
            <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { void imagen(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="cr-encuentros">
            <div><b>{c.encuentros ?? 0}</b>encuentros</div>
            <div><b>{c.derrotadas ?? 0}</b>abatidas</div>
            <button type="button" className="pbtn" title="Os la habéis vuelto a encontrar" onClick={() => { registrarEncuentro(c.id, false); avisar(`${c.nombre}: un encuentro más`); }}><Icono d={UI.mas} />Encuentro</button>
            <button type="button" className="pbtn" title="Encuentro en el que la habéis abatido" onClick={() => { registrarEncuentro(c.id, true); avisar(`${c.nombre}: abatida`); }}><Icono d={UI.calavera} />Abatida</button>
          </div>
        </div>

        <div className="cr-dcha">
          <header className="cr-ficha-cab">
            <h2 id="cr-t">{c.nombre}</h2>
            <span className="cr-ficha-sub">
              <span className="cr-actitud grande"><Icono d={ICONO_ACTITUD[c.actitud]} size={15} />{textoActitud(c.actitud)}</span>
              {subtitulo(c)}
            </span>
          </header>
          <div className="cr-bloque">
            <div className="cr-combate">
              {dato('Clase de armadura', UI.escudoCa, c.ca, c.caNota)}
              {dato('Puntos de vida', UI.corazon, c.pv, c.pvDados)}
              {dato('Velocidad', null, c.velocidad, undefined, true)}
              {dato('Desafío', null, c.desafio, px !== undefined ? `${px} PX` : undefined)}
            </div>
            <div className="cr-cars">
              {CARACTERISTICAS.map(([k, a]) => {
                const v = c.caracteristicas?.[k];
                return (
                  <div key={k} className={v === undefined ? 'oculto' : ''}>
                    <span>{a}</span><b>{v ?? '?'}</b><span>{v === undefined ? '—' : conSigno(modificador(v))}</span>
                  </div>
                );
              })}
            </div>
            {sabidos.length > 0 && <dl className="cr-detalles">{sabidos.map(([k, t]) => <div key={k}><dt>{t}</dt><dd>{c[k] as string}</dd></div>)}</dl>}
            {ocultos.length > 0 && <p className="cr-ocultos">Sin descubrir: {ocultos.join(', ')}.</p>}
            {TIPOS_HABILIDAD.map((t) => {
              const habs = c.habilidades.filter((h) => h.tipo === t.id);
              if (!habs.length) return null;
              return (
                <section key={t.id} className="cr-habs">
                  <h3 className="est-sec">{t.texto}</h3>
                  {habs.map((h) => (habilidadOculta(h) ? (
                    <div key={h.id} className="cr-hab hueco">
                      <span className="cr-interrogante">?</span>
                      <div><b>{t.uno} sin descubrir</b><p>Sabéis que tiene algo más, pero aún no lo ha usado.</p></div>
                    </div>
                  ) : (
                    <div key={h.id} className="cr-hab">
                      <div>
                        <b>{h.nombre || `${t.uno} sin nombre`}.</b>{h.detalle && <span className="cr-hab-det"> {h.detalle}</span>}
                        {h.descripcion && <p>{h.descripcion}</p>}
                      </div>
                    </div>
                  )))}
                </section>
              );
            })}
            <section className="cr-botin">
              <h3 className="est-sec">Botín</h3>
              {c.botin.length === 0 ? <p className="cr-ocultos">Aún no se sabe qué deja.</p> : (
                <ul>
                  {c.botin.map((b, i) => {
                    const f = fichaDeBotin(estado, b);
                    const contenido = (
                      <>
                        <span className={`slot has ${f ? CLASE_RAREZA[f.rareza] : 'r-c'}`}>
                          {f?.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f?.icono ?? 'bag']} />}
                          {b.cantidad && <span className="qty">{b.cantidad}</span>}
                        </span>
                        <span className="cr-botin-txt">
                          <b className={f ? CLASE_RAREZA[f.rareza] : ''}>{f?.nombre ?? b.nombre}</b>
                          <span>{[f ? f.rareza : 'No está en la biblioteca', b.nota].filter(Boolean).join(' · ')}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={i}>
                        {f ? <button type="button" className="cr-botin-item" onClick={() => detalle.verFicha(f)}>{contenido}</button> : <div className="cr-botin-item">{contenido}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {(c.lugar || c.notas) && (
              <section className="cr-notas">
                <h3 className="est-sec">Notas de la party</h3>
                {c.lugar && <p><b>Dónde:</b> {c.lugar}</p>}
                {c.notas && <p>{c.notas}</p>}
              </section>
            )}
          </div>
          <footer className="vo-pie">
            <span className="vo-dueno">{c.creadaPor ? <>Apuntada por <b>{c.creadaPor}</b></> : null}</span>
            <button type="button" className="btn pri" onClick={onEditar}><Icono d={UI.lapiz} size={16} /> Editar</button>
          </footer>
        </div>
      </section>
    </>
  );
}

// ── Formulario ─────────────────────────────────────────────────────

function EditorCriatura({ inicial, onCerrar, onGuardada, onEliminada }: {
  inicial?: Criatura; onCerrar: () => void; onGuardada: (id: string) => void; onEliminada: () => void;
}) {
  const { estado, guardarCriatura, eliminarCriatura, prepararImagen } = useCofre();
  const avisar = useAvisar();
  const [c, setC] = useState<Datos>(() => (inicial ? structuredClone(inicial) : criaturaVacia()));
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const fichero = useRef<HTMLInputElement>(null);
  useEscape(onCerrar);
  const cambiar = (x: Partial<Datos>) => { setError(null); setC((v) => ({ ...v, ...x })); };
  const texto = (k: keyof Datos, label: string, ancho: number, placeholder = 'Sin descubrir') => (
    <Campo label={label} ancho={ancho}><input value={(c[k] as string | undefined) ?? ''} placeholder={placeholder} onChange={(e) => cambiar({ [k]: e.target.value } as Partial<Datos>)} /></Campo>
  );
  const numero = (k: 'ca' | 'pv' | 'px' | 'encuentros' | 'derrotadas', label: string, ancho = 1, placeholder = '?') => (
    <Campo label={label} ancho={ancho}><Numero valor={c[k]} min={0} vacio={placeholder} onCambio={(n) => cambiar({ [k]: n } as Partial<Datos>)} /></Campo>
  );
  const fijarHab = (i: number, h: Partial<HabilidadCriatura>) => cambiar({ habilidades: c.habilidades.map((x, j) => (j === i ? { ...x, ...h } : x)) });
  const fijarBotin = (i: number, b: Partial<BotinCriatura>) => cambiar({ botin: c.botin.map((x, j) => (j === i ? { ...x, ...b } : x)) });
  const fichas = estado.biblioteca ?? [];

  const guardar = () => {
    const r = guardarCriatura(c, inicial?.id);
    if (!r.ok) { setError(r.motivo); return; }
    avisar(inicial ? `${c.nombre.trim()}: cambios guardados` : `${c.nombre.trim()} añadida al bestiario`);
    onGuardada(r.id);
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="crf-t" className="panel editor editor-criatura">
        <Esquinas />
        <header className="ed-cab">
          <h2 id="crf-t">{inicial ? `Editar ${inicial.nombre}` : 'Nueva criatura'}</h2>
          <span className="ed-paso">Solo el nombre es obligatorio · lo que dejéis vacío saldrá como «sin descubrir»</span>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        </header>
        <div className="ed-cuerpo">
          <form className="ed-form" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
            <Seccion titulo="Quién es">
              {texto('nombre', 'Nombre', 4, 'Huargo, Bicho del pantano…')}
              {texto('tipo', 'Tipo', 2, 'Bestia, No muerto…')}
              {texto('tamano', 'Tamaño', 2, 'Mediano, Grande…')}
              <div className="campo" style={{ gridColumn: 'span 8' }}>
                <span className="k">Actitud</span>
                <div className="chips" role="radiogroup">
                  {ACTITUDES.map((a) => <button key={a.id} type="button" role="radio" aria-checked={c.actitud === a.id} className={`chip ${c.actitud === a.id ? 'on' : ''}`} onClick={() => cambiar({ actitud: a.id })}>{a.texto}</button>)}
                </div>
              </div>
            </Seccion>
            <Seccion titulo="Combate">
              {numero('ca', 'CA')}
              {texto('caNota', 'De qué', 2, 'armadura natural')}
              {numero('pv', 'PV')}
              {texto('pvDados', 'Dados de golpe', 2, '4d10+4')}
              {texto('velocidad', 'Velocidad', 2, '9 m, nadar 6 m')}
              {texto('desafio', 'Valor de desafío', 2, '1/2, 3…')}
              {numero('px', 'PX', 2, pxPorDesafio(c.desafio) !== undefined ? `${pxPorDesafio(c.desafio)} (por el VD)` : '?')}
              {texto('alineamiento', 'Alineamiento', 4)}
            </Seccion>
            <Seccion titulo="Características">
              <div className="cars-pj" style={{ gridColumn: 'span 8' }}>
                {CARACTERISTICAS.map(([k, a]) => (
                  <label key={k} className="car-pj">
                    <span className="k">{a}</span>
                    <Numero valor={c.caracteristicas?.[k]} min={1} max={30} vacio="?" onCambio={(n) => cambiar({ caracteristicas: { ...c.caracteristicas, [k]: n } as Partial<Record<Caracteristica, number>> })} />
                    <span className="car-mod">{c.caracteristicas?.[k] !== undefined ? conSigno(modificador(c.caracteristicas[k]!)) : '—'}</span>
                  </label>
                ))}
              </div>
            </Seccion>
            <Seccion titulo="Defensas y sentidos">
              {texto('salvaciones', 'Tiradas de salvación', 4, 'DES +4, SAB +2')}
              {texto('pericias', 'Habilidades (pericias)', 4, 'Percepción +4, Sigilo +6')}
              {texto('resistencias', 'Resistencias', 4)}
              {texto('inmunidades', 'Inmunidades', 4)}
              {texto('vulnerabilidades', 'Vulnerabilidades', 4)}
              {texto('sentidos', 'Sentidos', 4, 'Visión en la oscuridad 18 m')}
              {texto('idiomas', 'Idiomas', 8)}
            </Seccion>
            <Seccion titulo="Rasgos y acciones" nota="Una habilidad sin nombre ni descripción sale como «sin descubrir»: sabéis que la tiene pero aún no la ha usado.">
              <div className="habs-crf" style={{ gridColumn: 'span 8' }}>
                {c.habilidades.map((h, i) => (
                  <div key={h.id} className="hab-crf">
                    <select aria-label="Tipo" value={h.tipo} onChange={(e) => fijarHab(i, { tipo: e.target.value as TipoHabilidad })}>
                      {TIPOS_HABILIDAD.map((t) => <option key={t.id} value={t.id}>{t.uno}</option>)}
                    </select>
                    <input aria-label="Nombre de la habilidad" value={h.nombre ?? ''} placeholder="Sin descubrir" onChange={(e) => fijarHab(i, { nombre: e.target.value })} />
                    <input aria-label="Ataque y daño" value={h.detalle ?? ''} placeholder="+5, 2d6+3 perforante" onChange={(e) => fijarHab(i, { detalle: e.target.value })} />
                    <button type="button" className="ibtn" aria-label="Quitar habilidad" onClick={() => cambiar({ habilidades: c.habilidades.filter((_, j) => j !== i) })}><Icono d={UI.cruz} /></button>
                    <textarea aria-label="Qué hace" rows={2} value={h.descripcion ?? ''} placeholder="Qué hace (vacío si no lo sabéis)" onChange={(e) => fijarHab(i, { descripcion: e.target.value })} />
                  </div>
                ))}
                <div className="chips">
                  <button type="button" className="chip on chip-i anadir-fila" onClick={() => cambiar({ habilidades: [...c.habilidades, habilidadVacia('accion')] })}><Icono d={UI.mas} />Añadir habilidad</button>
                  <button type="button" className="chip chip-i" title="Para una habilidad que sabéis que tiene pero aún no ha usado" onClick={() => cambiar({ habilidades: [...c.habilidades, habilidadVacia('rasgo')] })}>? Habilidad sin descubrir</button>
                </div>
              </div>
            </Seccion>
            <Seccion titulo="Botín que deja" nota="Escribe el nombre de un objeto de la biblioteca para enlazarlo (se ve su ficha al pulsarlo) o cualquier otra cosa como texto.">
              <datalist id="biblioteca-nombres">{fichas.map((f) => <option key={f.id} value={f.nombre} />)}</datalist>
              <div className="habs-crf" style={{ gridColumn: 'span 8' }}>
                {c.botin.map((b, i) => {
                  const f = fichaDeBotin(estado, b);
                  return (
                    <div key={i} className="botin-crf">
                      <span className={`slot has ${f ? CLASE_RAREZA[f.rareza] : 'r-c'}`}>{f?.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f?.icono ?? 'bag']} />}</span>
                      <input
                        list="biblioteca-nombres" aria-label="Objeto" placeholder="Busca en la biblioteca o escribe" value={f?.nombre ?? b.nombre ?? ''}
                        onChange={(e) => {
                          const n = e.target.value;
                          const ficha = fichas.find((x) => x.nombre.toLocaleLowerCase('es') === n.trim().toLocaleLowerCase('es'));
                          fijarBotin(i, { fichaId: ficha?.id, nombre: ficha ? undefined : n });
                        }}
                      />
                      <input aria-label="Cantidad" placeholder="1, 2d4…" value={b.cantidad ?? ''} onChange={(e) => fijarBotin(i, { cantidad: e.target.value })} />
                      <input aria-label="Nota" placeholder="Nota" value={b.nota ?? ''} onChange={(e) => fijarBotin(i, { nota: e.target.value })} />
                      <button type="button" className="ibtn" aria-label="Quitar del botín" onClick={() => cambiar({ botin: c.botin.filter((_, j) => j !== i) })}><Icono d={UI.cruz} /></button>
                      <span className="ayuda">{f ? `En la biblioteca · ${f.rareza}` : b.nombre?.trim() ? 'No está en la biblioteca: se guarda como texto' : ''}</span>
                    </div>
                  );
                })}
                <div className="chips"><button type="button" className="chip on chip-i anadir-fila" onClick={() => cambiar({ botin: [...c.botin, {}] })}><Icono d={UI.mas} />Añadir al botín</button></div>
              </div>
            </Seccion>
            <Seccion titulo="Encuentros">
              {texto('lugar', 'Dónde se la encontró', 4, 'Ciénaga de Muermo')}
              {numero('encuentros', 'Encuentros', 2, '0')}
              {numero('derrotadas', 'Abatidas', 2, '0')}
              <Campo label="Notas (tácticas, debilidades, rumores…)" ancho={8}>
                <textarea rows={3} value={c.notas ?? ''} onChange={(e) => cambiar({ notas: e.target.value })} />
              </Campo>
            </Seccion>
            <button type="submit" hidden />
          </form>
          <aside className="ed-previa" aria-label="Imagen">
            <span className="k">Imagen</span>
            <button type="button" className={`subir crf-imagen ${c.imagenUrl ? 'con' : ''}`} onClick={() => fichero.current?.click()}>
              {c.imagenUrl ? <img src={c.imagenUrl} alt="" /> : <><Icono d={UI.camara} size={28} />Subir imagen</>}
            </button>
            {c.imagenUrl && <button type="button" className="enlace" onClick={() => cambiar({ imagenUrl: undefined })}>Quitar imagen</button>}
            <input ref={fichero} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cambiar({ imagenUrl: await prepararImagen(f, 900) }); }} />
            <span className="k">Así se verá</span>
            <Carta c={{ ...c, nombre: c.nombre || 'Sin nombre', id: inicial?.id ?? '', creada: 0, actualizada: 0 }} onAbrir={() => {}} />
          </aside>
        </div>
        <footer className="ed-pie">
          {inicial && (borrar ? (
            <span className="ed-borrar">
              ¿Borrar {inicial.nombre} del bestiario para toda la party?
              <button type="button" className="btn peligro" onClick={() => { eliminarCriatura(inicial.id); avisar(`${inicial.nombre} borrada del bestiario`); onEliminada(); }}>Sí, borrar</button>
              <button type="button" className="btn sec" onClick={() => setBorrar(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="btn peligro-sec" onClick={() => setBorrar(true)}>Eliminar criatura</button>
          ))}
          {error && <span className="ed-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{inicial ? 'Guardar cambios' : 'Añadir al bestiario'}</button>
        </footer>
      </section>
    </>
  );
}
