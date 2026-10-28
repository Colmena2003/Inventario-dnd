// Bestiario: criaturas con las que se ha enfrentado la party, con su imagen en grande, lo que se sabe de
// ellas (lo que no, se queda «sin descubrir») y el botín que dejan, enlazado con la biblioteca de objetos.

import { useRef, useState } from 'react';
import {
  ACTITUDES, CARACTERISTICAS, conocimiento, fichaDeBotin, modDe, pxDeDesafio, sinDescubrir, TIPOS_HABILIDAD,
} from '../domain/bestiario';
import { CLASE_RAREZA, conSigno, fmtNum } from '../domain/reglas';
import type { Actitud, BotinCriatura, Criatura, Estado } from '../domain/tipos';
import { guardarImagen } from '../store/archivos';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { EditarCriatura } from './EditarCriatura';
import { ICONOS, UI } from './iconos';
import { Esquinas, Icono } from './piezas';
import { useVistaObjeto } from './VistaObjeto';

const ORDENES = [
  { id: 'reciente', texto: 'Más recientes' },
  { id: 'nombre', texto: 'Nombre' },
  { id: 'desafio', texto: 'Desafío' },
  { id: 'encuentros', texto: 'Encuentros' },
] as const;

const valorDesafio = (d?: string) => {
  if (!d) return -1;
  const [a, b] = d.split('/').map(Number);
  return b ? a / b : Number.isFinite(a) ? a : -1;
};

/** «Grande · monstruosidad · neutral malvado»: solo la primera letra en mayúscula. */
const subtitulo = (c: Criatura) => {
  const t = [c.tamano, c.tipo, c.alineamiento].filter(Boolean).join(' · ').toLocaleLowerCase('es');
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
};

export function InsigniaActitud({ a, grande }: { a: Actitud; grande?: boolean }) {
  const texto = ACTITUDES.find((x) => x.id === a)!.texto;
  return (
    <span className={`cr-actitud ${a.replace(' ', '-')} ${grande ? 'grande' : ''}`}>
      <Icono d={a === 'agresiva' ? UI.garra : a === 'no agresiva' ? UI.corazon : UI.lupa} size={grande ? 16 : 13} />{texto}
    </span>
  );
}

export function Bestiario({ busqueda }: { busqueda: string }) {
  const { estado } = useCofre();
  const [filtro, setFiltro] = useState<Actitud | null>(null);
  const [orden, setOrden] = useState<(typeof ORDENES)[number]['id']>('reciente');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id?: string } | null>(null);

  const q = busqueda.trim().toLocaleLowerCase('es');
  const todas = estado.bestiario ?? [];
  const lista = todas
    .filter((c) => !filtro || c.actitud === filtro)
    .filter((c) => !q || [c.nombre, c.tipo, c.lugar, c.notas].some((t) => t?.toLocaleLowerCase('es').includes(q)))
    .sort((a, b) =>
      orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es')
        : orden === 'desafio' ? valorDesafio(b.desafio) - valorDesafio(a.desafio)
          : orden === 'encuentros' ? (b.encuentros ?? 0) - (a.encuentros ?? 0)
            : b.actualizada - a.actualizada);
  const cuenta = (a: Actitud) => todas.filter((c) => c.actitud === a).length;

  return (
    <section className="bestiario" aria-label="Bestiario">
      <header className="panel bib-cab cr-cab">
        <Esquinas solo="arriba" />
        <div className="bib-titulo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.calavera} /></svg>
          <div>
            <h1>Bestiario</h1>
            <span>{todas.length} criaturas · {cuenta('agresiva')} agresivas · {cuenta('no agresiva')} no agresivas · lo que no se sabe queda sin descubrir</span>
          </div>
        </div>
        <div className="bib-filtros">
          <div role="group" aria-label="Actitud" className="fo-chips">
            <button type="button" className={`chip ${!filtro ? 'on' : ''}`} aria-pressed={!filtro} onClick={() => setFiltro(null)}>Todas</button>
            {ACTITUDES.map((x) => (
              <button key={x.id} type="button" className={`chip ${filtro === x.id ? 'on' : ''}`} aria-pressed={filtro === x.id} onClick={() => setFiltro(x.id)}>{x.texto}</button>
            ))}
          </div>
          <label className="orden">Ordenar
            <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
              {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
            </select>
          </label>
          <button type="button" className="btn pri cr-nueva" onClick={() => setEditando({})}><Icono d={UI.mas} size={16} /> Nueva criatura</button>
        </div>
      </header>

      {lista.length ? (
        <ul className="cr-rejilla" aria-label="Criaturas">
          {lista.map((c) => <li key={c.id}><Carta c={c} estado={estado} onAbrir={() => setAbierta(c.id)} /></li>)}
        </ul>
      ) : (
        <div className="bib-vacia">
          <h2>{todas.length ? 'Nada coincide' : 'Aún no hay criaturas'}</h2>
          <p>{todas.length ? 'Prueba con otra búsqueda o quita el filtro.' : 'Apunta la primera criatura con la que os habéis cruzado: basta con el nombre.'}</p>
          {!todas.length && <button type="button" className="btn pri" onClick={() => setEditando({})}>Nueva criatura</button>}
        </div>
      )}

      {abierta && !editando && (
        <FichaCriatura id={abierta} onCerrar={() => setAbierta(null)} onEditar={() => setEditando({ id: abierta })} />
      )}
      {editando && (
        <EditarCriatura
          id={editando.id}
          onCerrar={(guardada) => { setEditando(null); if (guardada) setAbierta(guardada); }}
          onEliminada={() => { setEditando(null); setAbierta(null); }}
        />
      )}
    </section>
  );
}

function Carta({ c, estado, onAbrir }: { c: Criatura; estado: Estado; onAbrir: () => void }) {
  const sabido = Math.round(conocimiento(c) * 100);
  return (
    <button type="button" className={`cr-carta ${c.actitud.replace(' ', '-')}`} onClick={onAbrir}>
      <span className="cr-arte">
        {c.imagenUrl ? <img src={c.imagenUrl} alt="" loading="lazy" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.calavera} /></svg>}
        <InsigniaActitud a={c.actitud} />
        {c.desafio && <span className="cr-vd" title="Valor de desafío">VD {c.desafio}</span>}
      </span>
      <span className="cr-nombre">{c.nombre}</span>
      <span className="cr-sub">{subtitulo(c) || 'Tipo sin descubrir'}</span>
      <span className="cr-mini">
        <span title="Clase de armadura"><Icono d={UI.escudo} size={14} />CA <b>{c.ca ?? '?'}</b></span>
        <span title="Puntos de vida"><Icono d={UI.corazon} size={14} />PV <b>{c.pv ?? '?'}</b></span>
        <span title="Encuentros y abatidas">{c.encuentros ?? 0} enc. · {c.derrotadas ?? 0} abat.</span>
      </span>
      <span className="cr-botin-mini" aria-label="Botín">
        {c.botin.slice(0, 7).map((b) => <MiniBotin key={b.id} b={b} estado={estado} />)}
        {!c.botin.length && <span className="tenue">Sin botín apuntado</span>}
      </span>
      <span className="cr-sabido" title={`Se conoce el ${sabido} % de su ficha`}>
        <span><span style={{ width: `${sabido}%` }} /></span>{sabido} % conocido
      </span>
    </button>
  );
}

function MiniBotin({ b, estado }: { b: BotinCriatura; estado: Estado }) {
  const f = fichaDeBotin(estado, b);
  return (
    <span className={`slot ${f ? `has ${CLASE_RAREZA[f.rareza]}` : 'ghost'}`} title={f?.nombre ?? b.nombre}>
      {f?.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f?.icono ?? 'bag']} />}
    </span>
  );
}

// ── Ficha grande ───────────────────────────────────────────────────

const DETALLES: [keyof Criatura, string][] = [
  ['salvaciones', 'Tiradas de salvación'], ['pericias', 'Pericias'], ['resistencias', 'Resistencias'], ['inmunidades', 'Inmunidades'],
  ['vulnerabilidades', 'Vulnerabilidades'], ['sentidos', 'Sentidos'], ['idiomas', 'Idiomas'],
];

function FichaCriatura({ id, onCerrar, onEditar }: { id: string; onCerrar: () => void; onEditar: () => void }) {
  const { estado, guardarCriatura, anotarEncuentro } = useCofre();
  const abrirObjeto = useVistaObjeto();
  const fichero = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Con la vista de un objeto del botín abierta encima, Esc cierra solo esa
  useEscape(() => { if (!document.querySelector('.dialogo.vo')) onCerrar(); });

  const c = estado.bestiario?.find((x) => x.id === id);
  if (!c) return null;
  const { id: _i, creada: _c, actualizada: _a, creadaPor: _p, ...datos } = c;
  const ponerImagen = (url: string | undefined) => {
    const r = guardarCriatura(c.id, { ...datos, imagenUrl: url });
    if (!r.ok) setError(r.motivo);
  };
  const subir = async (f: File | undefined) => {
    if (!f) return;
    try { ponerImagen(await guardarImagen(f, 'criatura')); } catch { setError('No se ha podido leer la imagen'); }
  };

  const px = c.px ?? pxDeDesafio(c.desafio);
  const conocidos = DETALLES.filter(([k]) => c[k]);
  const ocultos = DETALLES.filter(([k]) => !c[k]).map(([, t]) => t.toLocaleLowerCase('es'));

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="cr-t" className={`panel dialogo cr ${c.actitud.replace(' ', '-')}`}>
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
            {c.imagenUrl && <button type="button" className="pbtn" onClick={() => ponerImagen(undefined)}><Icono d={UI.papelera} />Quitar</button>}
            <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="cr-encuentros">
            <div><b>{c.encuentros ?? 0}</b><span>{c.encuentros === 1 ? 'encuentro' : 'encuentros'}</span></div>
            <div><b>{c.derrotadas ?? 0}</b><span>{c.derrotadas === 1 ? 'abatida' : 'abatidas'}</span></div>
            <button type="button" className="pbtn" onClick={() => anotarEncuentro(c.id, false)}><Icono d={UI.mas} />Encuentro</button>
            <button type="button" className="pbtn" onClick={() => anotarEncuentro(c.id, true)}><Icono d={UI.garra} />Abatida</button>
          </div>
          {error && <span className="fo-error" role="alert">{error}</span>}
        </div>

        <div className="cr-dcha">
          <header className="cr-ficha-cab">
            <h2 id="cr-t">{c.nombre}</h2>
            <div className="cr-ficha-sub">
              <InsigniaActitud a={c.actitud} grande />
              <span>{subtitulo(c) || <span className="oculto">Tipo y tamaño sin descubrir</span>}</span>
            </div>
          </header>

          <div className="cr-bloque">
            <div className="cr-combate">
              <Dato k="Clase de armadura" v={c.ca} nota={c.caNota} icono={UI.escudo} />
              <Dato k="Puntos de vida" v={c.pv} nota={c.pvDados} icono={UI.corazon} />
              <Dato k="Velocidad" v={c.velocidad} texto />
              <Dato k="Desafío" v={c.desafio} nota={px !== undefined ? `${fmtNum(px)} PX` : undefined} />
            </div>

            <div className="cr-cars">
              {CARACTERISTICAS.map(([k, t]) => {
                const v = c.caracteristicas?.[k];
                const m = modDe(c, k);
                return (
                  <div key={k} className={v === undefined ? 'oculto' : ''} title={v === undefined ? 'Sin descubrir' : undefined}>
                    <span>{t}</span><b>{v ?? '?'}</b><span>{m === undefined ? '—' : conSigno(m)}</span>
                  </div>
                );
              })}
            </div>

            {!!conocidos.length && (
              <dl className="cr-detalles">
                {conocidos.map(([k, t]) => <div key={k}><dt>{t}</dt><dd>{String(c[k])}</dd></div>)}
              </dl>
            )}
            {!!ocultos.length && <p className="cr-ocultos">Sin descubrir: {ocultos.join(', ')}.</p>}

            {TIPOS_HABILIDAD.map(({ id: tipo, texto }) => {
              const habs = c.habilidades.filter((h) => h.tipo === tipo);
              if (!habs.length) return null;
              return (
                <section key={tipo} className="cr-habs">
                  <h3 className="est-sec">{texto}</h3>
                  {habs.map((h) => sinDescubrir(h) ? (
                    <div key={h.id} className="cr-hab hueco"><span className="cr-interrogante">?</span>
                      <div><b>Sin descubrir</b>{h.detalle && <span className="cr-hab-det"> · {h.detalle}</span>}<p>La party sabe que existe, pero aún no la ha visto.</p></div>
                    </div>
                  ) : (
                    <div key={h.id} className="cr-hab">
                      <div>
                        <b>{h.nombre?.trim() || 'Habilidad sin nombre'}.</b>{h.detalle && <span className="cr-hab-det"> {h.detalle}.</span>}
                        {h.descripcion ? <p>{h.descripcion}</p> : <p className="oculto">Efecto sin descubrir.</p>}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
            {!c.habilidades.length && <p className="cr-ocultos">Rasgos y acciones sin descubrir.</p>}

            <section className="cr-botin">
              <h3 className="est-sec">Botín</h3>
              {c.botin.length ? (
                <ul>
                  {c.botin.map((b) => {
                    const f = fichaDeBotin(estado, b);
                    const nombre = f?.nombre ?? b.nombre;
                    const contenido = (
                      <>
                        <span className={`slot ${f ? `has ${CLASE_RAREZA[f.rareza]}` : 'ghost'}`}>
                          {f?.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f?.icono ?? 'bag']} />}
                          {b.cantidad && <span className="qty">{b.cantidad}</span>}
                        </span>
                        <span className="cr-botin-txt">
                          <b className={f ? CLASE_RAREZA[f.rareza] : ''}>{nombre}</b>
                          <span>{[f?.rareza, b.nota].filter(Boolean).join(' · ') || (f ? '' : 'No está en la biblioteca')}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={b.id}>
                        {f ? <button type="button" className="cr-botin-item" onClick={() => abrirObjeto(f, 'ficha')} title="Ver en grande y recuperarlo">{contenido}</button>
                          : <div className="cr-botin-item">{contenido}</div>}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="cr-ocultos">Aún no se sabe qué deja.</p>}
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

/** `texto`: un valor que es una frase («9 m, nadar 6 m»), con letra más pequeña que un número. */
function Dato({ k, v, nota, icono, texto }: { k: string; v: string | number | undefined; nota?: string; icono?: string; texto?: boolean }) {
  const oculto = v === undefined || v === '';
  return (
    <div className={`cr-dato ${oculto ? 'oculto' : ''} ${texto ? 'texto' : ''}`} title={oculto ? 'Sin descubrir' : undefined}>
      <span>{icono && <Icono d={icono} size={13} />}{k}</span>
      <b>{oculto ? '?' : v}</b>
      {nota && <small>{nota}</small>}
    </div>
  );
}
