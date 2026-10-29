// Ficha grande de un objeto (clic en su ranura) o de una entrada de la biblioteca (clic en su carta):
// imagen, datos, habilidades, descripción y acciones (usar, sintonizar, editar o recuperar).

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { DES_MAX_POR_TIPO, NOMBRE_TIPO_ARMADURA } from '../domain/catalogo';
import { describirMod, nombrePropiedad } from '../domain/describir';
import { objetosDeFicha } from '../domain/biblioteca';
import { ataqueDeObjeto } from '../domain/hoja';
import { CLASE_RAREZA, conSigno, MAX_SINTONIZADOS, nombreDe, NOMBRE_RANURA, sintonizadosDe } from '../domain/reglas';
import { usable } from '../domain/uso';
import type { FichaObjeto, Objeto, Propietario } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useEscape, useSintonia } from './Dialogos';
import { useEditor } from './editorCtx';
import { ICONOS, UI } from './iconos';
import { Esquinas, fmt1, fmtNum, Icono } from './piezas';

type Abierto = { objetoId: string } | { fichaId: string };
type Api = { verObjeto: (o: Objeto) => void; verFicha: (f: FichaObjeto) => void };
const Ctx = createContext<Api>({ verObjeto: () => {}, verFicha: () => {} });
export const useDetalle = () => useContext(Ctx);

export function DetalleProvider({ onAviso, children }: { onAviso: (t: string, error?: boolean) => void; children: ReactNode }) {
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const api = useMemo<Api>(() => ({ verObjeto: (o) => setAbierto({ objetoId: o.id }), verFicha: (f) => setAbierto({ fichaId: f.id }) }), []);
  const cerrar = useCallback(() => setAbierto(null), []);
  return (
    <Ctx.Provider value={api}>
      {children}
      {abierto && <Detalle abierto={abierto} onCerrar={cerrar} onAviso={onAviso} />}
    </Ctx.Provider>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Detalle({ abierto, onCerrar, onAviso }: { abierto: Abierto; onCerrar: () => void; onAviso: (t: string, error?: boolean) => void }) {
  const { estado, actor, guardarObjeto, cambiarImagenFicha, prepararImagen, usar } = useCofre();
  const sintonia = useSintonia();
  const editor = useEditor();
  const fichero = useRef<HTMLInputElement>(null);
  useEscape(onCerrar);

  const objeto = 'objetoId' in abierto ? estado.objetos.find((o) => o.id === abierto.objetoId) : undefined;
  const ficha = 'fichaId' in abierto ? (estado.biblioteca ?? []).find((f) => f.id === abierto.fichaId) : undefined;
  const datos: Partial<Objeto> | undefined = objeto ?? ficha;
  if (!datos) return null; // se ha gastado o borrado mientras estaba abierto

  const imagen = async (f: File | undefined) => {
    if (!f) return;
    const url = await prepararImagen(f, 900);
    ponerImagen(url);
  };
  const ponerImagen = (url: string | undefined) => {
    const fichaId = ficha?.id ?? objeto?.fichaId;
    if (fichaId) cambiarImagenFicha(fichaId, url);
    else if (objeto) guardarObjeto({ ...objeto, imagenUrl: url }, false);
  };

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <section role="dialog" aria-modal="true" aria-labelledby="vo-t" className={`panel dialogo vo ${CLASE_RAREZA[datos.rareza ?? 'común']}`}>
        <Esquinas />
        <button type="button" className="ibtn vo-cerrar" aria-label="Cerrar" onClick={onCerrar}><Icono d={UI.cruz} /></button>
        <div className="vo-arte">
          <div className={`vo-imagen ${datos.imagenUrl ? 'con-imagen' : ''}`}>
            {datos.imagenUrl ? <img src={datos.imagenUrl} alt={datos.nombre} /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS[datos.icono ?? 'bag']} /></svg>}
            {objeto && objeto.cantidad > 1 && <span className="vo-cantidad">×{objeto.cantidad}</span>}
          </div>
          <div className="vo-imagen-acc">
            <button type="button" className="pbtn" onClick={() => fichero.current?.click()}><Icono d={UI.camara} />{datos.imagenUrl ? 'Cambiar imagen' : 'Subir imagen'}</button>
            {datos.imagenUrl && <button type="button" className="pbtn" onClick={() => ponerImagen(undefined)}><Icono d={UI.papelera} />Quitar</button>}
            <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { void imagen(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
        <div className="vo-texto">
          <Datos datos={datos} objeto={objeto} />
          {ficha && <Recuperar ficha={ficha} onAviso={onAviso} onHecho={onCerrar} />}
          {objeto && (
            <footer className="vo-pie">
              <span className="vo-dueno">
                {objeto.propietario.tipo === 'personaje' ? <>Lo tiene <b>{nombreDe(estado, objeto.propietario)}</b></> : <b>{nombreDe(estado, objeto.propietario)}</b>}
              </span>
              {usable(objeto) && (
                <button type="button" className="btn sec" onClick={() => {
                  // Lo del alijo lo usa quien maneja la app
                  const yo = estado.personajes.find((p) => p.nombre.split(' ')[0] === actor);
                  const r = usar(objeto.id, yo?.id);
                  onAviso(r.ok ? r.texto : r.motivo, !r.ok);
                }}>
                  {objeto.categoria === 'Comida' ? 'Comer' : 'Usar'}
                </button>
              )}
              {objeto.requiereSintonizacion && objeto.propietario.tipo === 'personaje' && (
                <button type="button" className="btn sec" onClick={() => sintonia(objeto)}>{objeto.sintonizado ? 'Quitar sintonización' : 'Sintonizar'}</button>
              )}
              <button type="button" className="btn pri" onClick={() => { onCerrar(); editor.editar(objeto); }}><Icono d={UI.lapiz} size={16} /> Editar</button>
            </footer>
          )}
        </div>
      </section>
    </>
  );
}

function Datos({ datos, objeto }: { datos: Partial<Objeto>; objeto?: Objeto }) {
  const { estado } = useCofre();
  const dueno = objeto?.propietario.tipo === 'personaje' ? estado.personajes.find((p) => p.id === (objeto.propietario as { id: string }).id) : undefined;
  const atq = dueno && objeto ? ataqueDeObjeto(estado, dueno, objeto) : null;
  const cantidad = objeto?.cantidad ?? 1;
  const sub = [datos.subtipo ? capital(datos.subtipo) : datos.categoria];
  if (objeto?.equipadoEn) sub.push(`Equipado · ${NOMBRE_RANURA[objeto.equipadoEn.ranura]}`);
  const props = [...(datos.propiedades ?? []).map((p) => nombrePropiedad(datos as Objeto, p)), ...(datos.otrasPropiedades ?? [])];
  if (datos.tipoArma) props.unshift(datos.tipoArma === 'marcial' ? 'Marcial' : 'Sencilla');
  const arm = datos.armadura;

  const filas: [string, ReactNode][] = [];
  if (datos.dado) filas.push(['Daño', <>{atq ? atq.dano : `${datos.dado}${datos.bonoMagico ? ` +${datos.bonoMagico}` : ''}`} <small>{datos.tipoDano}</small></>]);
  if (atq) filas.push(['Ataque', conSigno(atq.bono.total)]);
  else if (datos.bonoMagico) filas.push(['Bono mágico', `+${datos.bonoMagico}`]);
  if (arm && arm.tipo !== 'ropa') {
    const tope = arm.desMax !== undefined ? arm.desMax : DES_MAX_POR_TIPO[arm.tipo];
    filas.push(['Clase de armadura', <>{arm.caBase + (datos.bonoMagico ?? 0)} <small>{NOMBRE_TIPO_ARMADURA[arm.tipo]}{tope == null ? ' + DES' : tope ? ` + DES (máx. ${tope})` : ''}</small></>]);
  }
  if (datos.bonoCa) filas.push(['Clase de armadura', `+${datos.bonoCa + (datos.bonoMagico ?? 0)}`]);
  if (datos.cargasMax) filas.push(['Cargas', `${objeto?.cargas ?? datos.cargasMax} / ${datos.cargasMax}`]);
  if (datos.saciedad) filas.push(['Saciedad', `+${datos.saciedad}`]);
  filas.push(['Peso', `${fmt1((datos.pesoKg ?? 0) * cantidad)} kg`], ['Valor', `${fmtNum((datos.valorPo ?? 0) * cantidad)} PO`]);

  const [titulo, ...resto] = (datos.efectos ?? '').split(/(?<=\.)\s/);
  const sint = dueno ? sintonizadosDe(estado, dueno.id).length : 0;

  return (
    <div className="vo-detalles">
      <header>
        <h2 id="vo-t" className="vo-nombre">{datos.nombre}</h2>
        <span className="vo-sub">{sub.join(' · ')} · <span className="vo-rareza">{capital(datos.rareza ?? 'común')}</span></span>
      </header>
      <svg className="vo-orla" viewBox="0 0 330 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5h150M180 5h150" stroke="#4d3e25" /><path d="M165 1l4 4-4 4-4-4z" fill="#b89a55" /></svg>
      <dl className="vo-datos">{filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {(atq?.extras ?? datos.danosExtra ?? []).map((x, i) => <p key={i} className="vo-extra">+{x.dado}{x.tipo ? ` ${x.tipo}` : ''}{x.condicion ? ` ${x.condicion}` : ''}</p>)}
      {props.length > 0 && <div className="tt-chips">{props.map((p) => <span key={p}>{p}</span>)}</div>}
      <div className="vo-prosa">
        {!!datos.modificadores?.length && (
          <section><h3 className="est-sec">Efectos sobre quien lo lleva</h3><ul className="tt-mods">{datos.modificadores.map((m, i) => <li key={i}>{describirMod(m)}</li>)}</ul></section>
        )}
        {datos.efectos && <section><h3 className="est-sec">Habilidades</h3><p>{resto.length ? <><b>{titulo}</b> {resto.join(' ')}</> : datos.efectos}</p></section>}
        {datos.alUsar && <section><h3 className="est-sec">Al usarlo</h3><p><b>{datos.alUsar.nombre}.</b> {datos.alUsar.modificadores.map(describirMod).join(' · ')}</p></section>}
        {datos.descripcion && <section><h3 className="est-sec">Descripción</h3><p>{datos.descripcion}</p></section>}
        {datos.notas && <section><h3 className="est-sec">Notas</h3><p className="vo-notas">{datos.notas}</p></section>}
        {!datos.efectos && !datos.descripcion && !datos.notas && !datos.modificadores?.length && <p className="vacio">Sin descripción todavía. Edita el objeto para añadirla.</p>}
      </div>
      {(datos.requiereSintonizacion || datos.recarga || (datos.ranuraEquipo && !objeto?.equipadoEn)) && (
        <div className="vo-etiquetas">
          {datos.requiereSintonizacion && (
            <span className="tt-sint"><span className="rombo" />Requiere sintonización{dueno ? ` · ${objeto?.sintonizado ? `Sintonizado (${sint}/${MAX_SINTONIZADOS})` : 'Sin sintonizar'}` : ''}</span>
          )}
          {datos.recarga && <span className="cond">Recarga: {datos.recarga.toLowerCase()}</span>}
          {datos.ranuraEquipo && !objeto?.equipadoEn && <span className="cond">Se equipa en: {NOMBRE_RANURA[datos.ranuraEquipo]}</span>}
        </div>
      )}
    </div>
  );
}

function Recuperar({ ficha, onAviso, onHecho }: { ficha: FichaObjeto; onAviso: (t: string, e?: boolean) => void; onHecho: () => void }) {
  const { estado, recuperarFicha, olvidarFicha } = useCofre();
  const [para, setPara] = useState<Propietario>({ tipo: 'alijo' });
  const [n, setN] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const tienen = objetosDeFicha(estado, ficha.id);
  const opciones: { p: Propietario; texto: string; color?: string }[] = [
    ...estado.personajes.map((p) => ({ p: { tipo: 'personaje' as const, id: p.id }, texto: p.nombre.split(' ')[0], color: p.color })),
    { p: { tipo: 'alijo' }, texto: 'Alijo' },
  ];
  const es = (p: Propietario) => JSON.stringify(p) === JSON.stringify(para);
  const recuperar = () => {
    const r = recuperarFicha(ficha.id, para, n);
    if (!r.ok) { setError(r.motivo); return; }
    onAviso(`${ficha.nombre}${n > 1 ? ` ×${n}` : ''} recuperado para ${nombreDe(estado, para)}`);
    onHecho();
  };
  const olvidar = () => {
    const r = olvidarFicha(ficha.id);
    if (!r.ok) { setError(r.motivo); return; }
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
        <div className="chips">
          {opciones.map((o) => (
            <button key={o.texto} type="button" className={`chip ${es(o.p) ? 'on' : ''}`} aria-pressed={es(o.p)} onClick={() => { setPara(o.p); setError(null); }}>
              {o.color ? <span className="punto" style={{ background: o.color }} /> : <Icono d={UI.cofre} size={14} />}{o.texto}
            </button>
          ))}
        </div>
      </div>
      <div className="vo-rec-fila">
        <span className="k">Cantidad</span>
        <div className="vo-cant">
          <button type="button" className="mini" aria-label="Uno menos" disabled={n <= 1} onClick={() => setN((x) => x - 1)}><Icono d={UI.menos} /></button>
          <output aria-live="polite">{n}</output>
          <button type="button" className="mini" aria-label="Uno más" disabled={n >= 99} onClick={() => setN((x) => x + 1)}><Icono d={UI.mas} /></button>
        </div>
        {error && <span className="ed-error" role="alert">{error}</span>}
        <span style={{ flex: 1 }} />
        {!tienen.length && <button type="button" className="btn peligro-sec" onClick={olvidar}>Quitar de la biblioteca</button>}
        <button type="button" className="btn pri" onClick={recuperar}>Recuperar</button>
      </div>
    </footer>
  );
}
