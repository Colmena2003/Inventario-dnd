// Un objeto en grande: se abre con un clic en su ranura o desde la biblioteca. La imagen manda;
// al lado, todo lo que se sabe del objeto. Desde una ficha de la biblioteca se puede recuperar.

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ejemplares } from '../domain/biblioteca';
import { ataque, CLASE_RAREZA, MAX_SINTONIZADOS, nombreDe, NOMBRE_RANURA, sintonizadosDe } from '../domain/reglas';
import type { DatosFicha, Ficha, Objeto, Personaje, Propietario } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useEscape, useSintonia } from './Dialogos';
import { useObjetos } from './EditarObjeto';
import { ICONOS, UI } from './iconos';
import { reducirImagen } from './interaccion';
import { Esquinas, fmt1, fmtNum, Icono } from './piezas';

/** Lado de las imágenes de objeto: lo bastante grande para verse bien en la vista grande. */
export const LADO_IMAGEN_OBJETO = 640;

type Abierto = { tipo: 'objeto'; id: string } | { tipo: 'ficha'; id: string };

const C = createContext<(o: Objeto | Ficha, tipo?: 'ficha') => void>(() => {});
/** Abre un objeto (o, con `'ficha'`, una ficha de la biblioteca) en grande. */
export const useVistaObjeto = () => useContext(C);

export function VistaObjetoProvider({ onAviso, children }: { onAviso: (texto: string, error?: boolean) => void; children: ReactNode }) {
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const abrir = useCallback((o: Objeto | Ficha, tipo?: 'ficha') => setAbierto({ tipo: tipo ?? 'objeto', id: o.id }), []);
  const cerrar = useCallback(() => setAbierto(null), []);
  return (
    <C.Provider value={abrir}>
      {children}
      {abierto && <VistaGrande abierto={abierto} onCerrar={cerrar} onAviso={onAviso} />}
    </C.Provider>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function VistaGrande({ abierto, onCerrar, onAviso }: { abierto: Abierto; onCerrar: () => void; onAviso: (t: string, e?: boolean) => void }) {
  const { estado, cambiarImagenFicha, editarObjeto } = useCofre();
  const acciones = useObjetos();
  const sintonia = useSintonia();
  const fichero = useRef<HTMLInputElement>(null);
  useEscape(onCerrar);

  // Siempre los datos actuales: si se edita o se mueve mientras está abierto, se ve al momento
  const objeto = abierto.tipo === 'objeto' ? estado.objetos.find((o) => o.id === abierto.id) : undefined;
  const ficha = abierto.tipo === 'ficha' ? estado.biblioteca?.find((f) => f.id === abierto.id) : undefined;
  const datos: DatosFicha | undefined = objeto ?? ficha;
  if (!datos) return null;

  const fichaId = objeto ? objeto.fichaId : ficha!.id;
  const subir = async (f: File | undefined) => {
    if (!f) return;
    let url: string;
    try { url = await reducirImagen(f, LADO_IMAGEN_OBJETO); } catch { return onAviso('No se ha podido leer la imagen', true); }
    poner(url);
  };
  const poner = (url: string | undefined) => {
    if (fichaId) cambiarImagenFicha(fichaId, url);
    else if (objeto) {
      const { id: _i, equipadoEn: _e, posicion: _p, sintonizado: _s, ...d } = objeto;
      editarObjeto(objeto.id, { ...d, imagenUrl: url });
    }
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="vo-t" className={`panel dialogo vo ${CLASE_RAREZA[datos.rareza]}`}>
        <Esquinas />
        <button type="button" className="ibtn vo-cerrar" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>

        <div className="vo-arte">
          <div className={`vo-imagen ${datos.imagenUrl ? 'con-imagen' : ''}`}>
            {datos.imagenUrl
              ? <img src={datos.imagenUrl} alt={datos.nombre} />
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS[datos.icono]} /></svg>}
            {objeto && objeto.cantidad > 1 && <span className="vo-cantidad">×{objeto.cantidad}</span>}
          </div>
          <div className="vo-imagen-acc">
            <button type="button" className="pbtn" onClick={() => fichero.current?.click()}>
              <Icono d={UI.camara} />{datos.imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
            {datos.imagenUrl && <button type="button" className="pbtn" onClick={() => poner(undefined)}><Icono d={UI.papelera} />Quitar</button>}
            <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>

        <div className="vo-texto">
          <Detalles datos={datos} objeto={objeto} titulo="vo-t" />
          {ficha && <Recuperar ficha={ficha} onAviso={onAviso} onHecho={onCerrar} />}
          {objeto && (
            <footer className="vo-pie">
              <span className="vo-dueno">{objeto.propietario.tipo === 'personaje' ? <>Lo tiene <b>{nombreDe(estado, objeto.propietario)}</b></> : <b>{nombreDe(estado, objeto.propietario)}</b>}</span>
              {objeto.requiereSintonizacion && objeto.propietario.tipo === 'personaje' && (
                <button type="button" className="btn sec" onClick={() => sintonia(objeto)}>{objeto.sintonizado ? 'Quitar sintonización' : 'Sintonizar'}</button>
              )}
              <button type="button" className="btn pri" onClick={() => { onCerrar(); acciones.editar(objeto); }}><Icono d={UI.lapiz} size={16} /> Editar</button>
            </footer>
          )}
        </div>
      </section>
    </>
  );
}

/** Todo lo que se sabe de un objeto, con el ataque calculado si alguien lo lleva. */
export function Detalles({ datos: o, objeto, titulo }: { datos: DatosFicha; objeto?: Objeto; titulo?: string }) {
  const { estado } = useCofre();
  const dueno: Personaje | undefined = objeto?.propietario.tipo === 'personaje'
    ? estado.personajes.find((p) => p.id === (objeto.propietario as { id: string }).id) : undefined;
  const ranuraArma = o.ranuraEquipo === 'distancia' ? 'distancia' : 'cuerpoACuerpo';
  const atq = o.dado && dueno && objeto ? ataque(dueno, objeto, ranuraArma) : null;
  const sint = dueno ? sintonizadosDe(estado, dueno.id).length : 0;
  const cantidad = objeto?.cantidad ?? 1;

  const sub = [o.subtipo ? capital(o.subtipo) : o.categoria];
  if (objeto?.equipadoEn) sub.push(`Equipado · ${NOMBRE_RANURA[objeto.equipadoEn.ranura]}`);

  const datosRapidos: [string, ReactNode][] = [];
  if (o.dado) datosRapidos.push(['Daño', <>{atq ? atq.dano : `${o.dado}${o.bonoMagico ? ` +${o.bonoMagico}` : ''}`} <small>{o.tipoDano}</small></>]);
  if (atq) datosRapidos.push(['Ataque', `${atq.bono >= 0 ? '+' : '−'}${Math.abs(atq.bono)}`]);
  else if (o.bonoMagico) datosRapidos.push(['Bono mágico', `+${o.bonoMagico}`]);
  if (o.bonoCa) datosRapidos.push(['Clase de armadura', `+${o.bonoCa}`]);
  if (o.cargasMax) datosRapidos.push(['Cargas', `${objeto?.cargas ?? o.cargasMax} / ${o.cargasMax}`]);
  if (o.saciedad) datosRapidos.push(['Saciedad', `+${o.saciedad}`]);
  datosRapidos.push(['Peso', `${fmt1(o.pesoKg * cantidad)} kg`], ['Valor', `${fmtNum(o.valorPo * cantidad)} PO`]);

  const [titEfecto, ...restoEfecto] = (o.efectos ?? '').split(/(?<=\.)\s/);

  return (
    <div className="vo-detalles">
      <header>
        <h2 id={titulo} className="vo-nombre">{o.nombre}</h2>
        <span className="vo-sub">{sub.join(' · ')} · <span className="vo-rareza">{capital(o.rareza)}</span></span>
      </header>
      <svg className="vo-orla" viewBox="0 0 330 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5h150M180 5h150" stroke="#4d3e25" /><path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" /></svg>

      <dl className="vo-datos">
        {datosRapidos.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {o.extraDano && <p className="vo-extra">{o.extraDano}</p>}
      {!!o.propiedades?.length && <div className="tt-chips">{o.propiedades.map((p) => <span key={p}>{p}</span>)}</div>}

      <div className="vo-prosa">
        {o.efectos && (
          <section><h3 className="est-sec">Habilidades</h3>
            <p>{restoEfecto.length ? <><b>{titEfecto}</b> {restoEfecto.join(' ')}</> : o.efectos}</p>
          </section>
        )}
        {o.descripcion && <section><h3 className="est-sec">Descripción</h3><p>{o.descripcion}</p></section>}
        {o.notas && <section><h3 className="est-sec">Notas</h3><p className="vo-notas">{o.notas}</p></section>}
        {!o.efectos && !o.descripcion && !o.notas && <p className="vacio">Sin descripción todavía. Edita el objeto para añadirla.</p>}
      </div>

      {(o.requiereSintonizacion || o.recarga || (o.ranuraEquipo && !objeto?.equipadoEn)) && (
        <div className="vo-etiquetas">
          {o.requiereSintonizacion && (
            <span className="tt-sint"><span className="rombo" />Requiere sintonización
              {dueno ? ` · ${objeto?.sintonizado ? `Sintonizado (${sint}/${MAX_SINTONIZADOS})` : 'Sin sintonizar'}` : ''}
            </span>
          )}
          {o.recarga && <span className="cond">Recarga: {o.recarga.toLowerCase()}</span>}
          {o.ranuraEquipo && !objeto?.equipadoEn && <span className="cond">Se equipa en: {NOMBRE_RANURA[o.ranuraEquipo]}</span>}
        </div>
      )}
    </div>
  );
}

/** Pie de una ficha de la biblioteca: quién lo tiene ahora y recuperarlo para alguien. */
function Recuperar({ ficha, onAviso, onHecho }: { ficha: Ficha; onAviso: (t: string, e?: boolean) => void; onHecho: () => void }) {
  const { estado, recuperarFicha, olvidarFicha } = useCofre();
  const [para, setPara] = useState<Propietario>({ tipo: 'alijo' });
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const tienen = ejemplares(estado, ficha.id);
  const duenos: { p: Propietario; texto: string; color?: string }[] = [
    ...estado.personajes.map((p) => ({ p: { tipo: 'personaje', id: p.id } as Propietario, texto: p.nombre.split(' ')[0], color: p.color })),
    { p: { tipo: 'alijo' }, texto: 'Alijo' },
  ];
  const es = (p: Propietario) => JSON.stringify(p) === JSON.stringify(para);

  const recuperar = () => {
    const r = recuperarFicha(ficha.id, para, cantidad);
    if (!r.ok) return setError(r.motivo);
    onAviso(`${ficha.nombre}${cantidad > 1 ? ` ×${cantidad}` : ''} recuperado para ${nombreDe(estado, para)}`);
    onHecho();
  };
  const olvidar = () => {
    const r = olvidarFicha(ficha.id);
    if (!r.ok) return setError(r.motivo);
    onAviso(`${ficha.nombre} quitado de la biblioteca`);
    onHecho();
  };

  return (
    <footer className="vo-recuperar">
      <p className="vo-tienen">
        {tienen.length
          ? <>Ahora lo tiene: {tienen.map((o, i) => <span key={o.id}>{i > 0 && ', '}<b>{nombreDe(estado, o.propietario)}</b>{o.cantidad > 1 ? ` ×${o.cantidad}` : ''}</span>)}</>
          : <>Nadie lo tiene ahora{ficha.ultimoDueno ? <> · lo tuvo por última vez <b>{ficha.ultimoDueno}</b></> : null}</>}
      </p>
      <div className="vo-rec-fila">
        <span className="k">Recuperar para</span>
        <div className="fo-chips">
          {duenos.map((x) => (
            <button key={x.texto} type="button" className={`chip ${es(x.p) ? 'on' : ''}`} aria-pressed={es(x.p)} onClick={() => { setPara(x.p); setError(null); }}>
              {x.color ? <span className="punto" style={{ background: x.color }} /> : <Icono d={UI.cofre} size={14} />}{x.texto}
            </button>
          ))}
        </div>
      </div>
      <div className="vo-rec-fila">
        <span className="k">Cantidad</span>
        <div className="vo-cant">
          <button type="button" className="mini" aria-label="Uno menos" disabled={cantidad <= 1} onClick={() => setCantidad((n) => n - 1)}><Icono d={UI.menos} /></button>
          <output aria-live="polite">{cantidad}</output>
          <button type="button" className="mini" aria-label="Uno más" disabled={cantidad >= 99} onClick={() => setCantidad((n) => n + 1)}><Icono d={UI.mas} /></button>
        </div>
        {error && <span className="fo-error" role="alert">{error}</span>}
        <span style={{ flex: 1 }} />
        {!tienen.length && <button type="button" className="btn peligro-sec" onClick={olvidar}>Quitar de la biblioteca</button>}
        <button type="button" className="btn pri" onClick={recuperar}>Recuperar</button>
      </div>
    </footer>
  );
}
