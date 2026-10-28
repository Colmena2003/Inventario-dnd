// Alta y edición de una criatura del bestiario. Solo el nombre es obligatorio: lo que la party no sepa
// se deja vacío y la ficha lo muestra como «sin descubrir».

import { useRef, useState } from 'react';
import {
  ACTITUDES, CARACTERISTICAS, criaturaEnBlanco, fichaDeBotin, habilidadEnBlanco, pxDeDesafio, TIPOS_HABILIDAD, type DatosCriatura,
} from '../domain/bestiario';
import { CLASE_RAREZA, conSigno, modificador, nuevoId } from '../domain/reglas';
import type { Caracteristica, HabilidadCriatura, TipoHabilidad } from '../domain/tipos';
import { guardarImagen } from '../store/archivos';
import { useCofre } from '../store/cofre';
import { useEscape } from './Dialogos';
import { ICONOS, UI } from './iconos';
import { Esquinas, Icono } from './piezas';

type Textos = {
  nombre: string; tipo: string; tamano: string; alineamiento: string; desafio: string; px: string; ca: string; caNota: string;
  pv: string; pvDados: string; velocidad: string; salvaciones: string; pericias: string; resistencias: string; inmunidades: string;
  vulnerabilidades: string; sentidos: string; idiomas: string; lugar: string; notas: string; encuentros: string; derrotadas: string;
};
type FilaBotin = { id: string; nombre: string; cantidad: string; nota: string };

const txt = (v: string | number | undefined) => (v === undefined ? '' : String(v));
/** Vacío → sin descubrir; con texto que no es un número → NaN, para que la validación lo diga. */
const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export function EditarCriatura({ id, onCerrar, onEliminada }: {
  id?: string;
  /** Con el id de la criatura si se ha guardado. */
  onCerrar: (guardada?: string) => void;
  onEliminada: () => void;
}) {
  const { estado, guardarCriatura, eliminarCriatura } = useCofre();
  const c = id ? estado.bestiario?.find((x) => x.id === id) : undefined;
  const d0: DatosCriatura = c ?? criaturaEnBlanco();
  const fichero = useRef<HTMLInputElement>(null);

  const [t, setT] = useState<Textos>(() => ({
    nombre: d0.nombre, tipo: txt(d0.tipo), tamano: txt(d0.tamano), alineamiento: txt(d0.alineamiento), desafio: txt(d0.desafio),
    px: txt(d0.px), ca: txt(d0.ca), caNota: txt(d0.caNota), pv: txt(d0.pv), pvDados: txt(d0.pvDados), velocidad: txt(d0.velocidad),
    salvaciones: txt(d0.salvaciones), pericias: txt(d0.pericias), resistencias: txt(d0.resistencias), inmunidades: txt(d0.inmunidades),
    vulnerabilidades: txt(d0.vulnerabilidades), sentidos: txt(d0.sentidos), idiomas: txt(d0.idiomas), lugar: txt(d0.lugar),
    notas: txt(d0.notas), encuentros: txt(d0.encuentros), derrotadas: txt(d0.derrotadas),
  }));
  const [actitud, setActitud] = useState(d0.actitud);
  const [cars, setCars] = useState<Record<Caracteristica, string>>(() =>
    Object.fromEntries(CARACTERISTICAS.map(([k]) => [k, txt(d0.caracteristicas?.[k])])) as Record<Caracteristica, string>);
  const [habs, setHabs] = useState<HabilidadCriatura[]>(d0.habilidades);
  const [botin, setBotin] = useState<FilaBotin[]>(() =>
    d0.botin.map((b) => ({ id: b.id, nombre: fichaDeBotin(estado, b)?.nombre ?? b.nombre ?? '', cantidad: txt(b.cantidad), nota: txt(b.nota) })));
  const [imagen, setImagen] = useState(d0.imagenUrl);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  /** Habilidad recién añadida con «Añadir habilidad»: se escribe su nombre directamente. */
  const [nueva, setNueva] = useState<string | null>(null);
  useEscape(() => onCerrar());

  const set = (k: keyof Textos, v: string) => { setT((x) => ({ ...x, [k]: v })); setError(null); };
  const setHab = (i: number, cambios: Partial<HabilidadCriatura>) => setHabs((hs) => hs.map((h, j) => (j === i ? { ...h, ...cambios } : h)));
  const setFila = (i: number, cambios: Partial<FilaBotin>) => setBotin((bs) => bs.map((b, j) => (j === i ? { ...b, ...cambios } : b)));

  const guardar = () => {
    const caracteristicas = Object.fromEntries(CARACTERISTICAS.map(([k]) => [k, num(cars[k])]).filter(([, v]) => v !== undefined));
    const datos: DatosCriatura = {
      nombre: t.nombre, actitud, imagenUrl: imagen,
      tipo: t.tipo, tamano: t.tamano, alineamiento: t.alineamiento, desafio: t.desafio, px: num(t.px),
      ca: num(t.ca), caNota: t.caNota, pv: num(t.pv), pvDados: t.pvDados, velocidad: t.velocidad, caracteristicas,
      salvaciones: t.salvaciones, pericias: t.pericias, resistencias: t.resistencias, inmunidades: t.inmunidades,
      vulnerabilidades: t.vulnerabilidades, sentidos: t.sentidos, idiomas: t.idiomas,
      habilidades: habs,
      // Lo que coincide con la biblioteca queda enlazado, para verlo con su icono, imagen y rareza
      botin: botin.map((b) => {
        const f = fichaDeBotin(estado, { id: b.id, nombre: b.nombre });
        return { id: b.id, fichaId: f?.id, nombre: f ? undefined : b.nombre, cantidad: b.cantidad, nota: b.nota };
      }),
      lugar: t.lugar, notas: t.notas, encuentros: num(t.encuentros), derrotadas: num(t.derrotadas),
    };
    const r = guardarCriatura(id, datos);
    if (!r.ok) return setError(r.motivo);
    onCerrar(r.id);
  };

  const subir = async (f: File | undefined) => {
    if (!f) return;
    try { setImagen(await guardarImagen(f, 'criatura')); } catch { setError('No se ha podido leer la imagen'); }
  };

  const campo = (k: keyof Textos, titulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="fo-c"><span className="k">{titulo}</span>
      <input id={`crf-${k}`} className="fo-in" value={t[k]} placeholder={extra.placeholder ?? 'Sin descubrir'} onChange={(e) => set(k, e.target.value)} {...extra} />
    </label>
  );
  const pxAuto = pxDeDesafio(t.desafio);

  return (
    <>
      <div className="velo arriba" onClick={() => onCerrar()} />
      <section role="dialog" aria-modal="true" aria-labelledby="crf-t" className="panel dialogo fo crf arriba">
        <Esquinas />
        <header className="fo-cab">
          <h2 id="crf-t">{c ? `Editar ${c.nombre}` : 'Nueva criatura'}</h2>
          <span className="fo-autor">Solo el nombre es obligatorio · lo que dejéis vacío saldrá como «sin descubrir»</span>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={() => onCerrar()}><Icono d={UI.cruz} /></button>
        </header>

        <form className="crf-cuerpo" onSubmit={(e) => { e.preventDefault(); guardar(); }}>
          <div className="crf-col">
            <h3 className="est-sec">Quién es</h3>
            <div className="fo-fila" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
              {campo('nombre', 'Nombre', { autoFocus: true, placeholder: 'Huargo, Bicho del pantano…' })}
              {campo('tipo', 'Tipo', { placeholder: 'Bestia, No muerto…' })}
              {campo('tamano', 'Tamaño', { placeholder: 'Mediano, Grande…' })}
            </div>
            <div className="fo-c"><span className="k">Actitud</span>
              <div className="fo-chips">
                {ACTITUDES.map((a) => (
                  <button key={a.id} type="button" className={`chip ${actitud === a.id ? 'on' : ''}`} aria-pressed={actitud === a.id} onClick={() => setActitud(a.id)}>{a.texto}</button>
                ))}
              </div>
            </div>

            <h3 className="est-sec">Combate</h3>
            <div className="fo-fila" style={{ gridTemplateColumns: '80px 1.3fr 80px 1.1fr 1.6fr' }}>
              {campo('ca', 'CA', { inputMode: 'numeric', placeholder: '?' })}
              {campo('caNota', 'De qué', { placeholder: 'armadura natural' })}
              {campo('pv', 'PV', { inputMode: 'numeric', placeholder: '?' })}
              {campo('pvDados', 'Dados de golpe', { placeholder: '4d10+4' })}
              {campo('velocidad', 'Velocidad', { placeholder: '9 m, nadar 6 m' })}
            </div>
            <div className="fo-fila" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
              {campo('desafio', 'Valor de desafío', { placeholder: '1/2, 3…' })}
              {campo('px', 'PX', { inputMode: 'numeric', placeholder: pxAuto !== undefined ? `${pxAuto} (por el VD)` : 'Sin descubrir' })}
              {campo('alineamiento', 'Alineamiento')}
            </div>

            <h3 className="est-sec">Características</h3>
            <div className="ep-cars">
              {CARACTERISTICAS.map(([k, titulo]) => {
                const v = num(cars[k]);
                return (
                  <label key={k}><span className="k">{titulo}</span>
                    <input id={`crf-${k}`} className="fo-in" inputMode="numeric" placeholder="?" value={cars[k]} onChange={(e) => { setCars((x) => ({ ...x, [k]: e.target.value })); setError(null); }} />
                    <span className="ep-mod">{v !== undefined && Number.isFinite(v) ? conSigno(modificador(v)) : ''}</span>
                  </label>
                );
              })}
            </div>

            <h3 className="est-sec">Defensas y sentidos</h3>
            <div className="fo-fila" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {campo('salvaciones', 'Tiradas de salvación', { placeholder: 'DES +4, SAB +2' })}
              {campo('pericias', 'Habilidades (pericias)', { placeholder: 'Percepción +4, Sigilo +6' })}
              {campo('resistencias', 'Resistencias')}
              {campo('inmunidades', 'Inmunidades')}
              {campo('vulnerabilidades', 'Vulnerabilidades')}
              {campo('sentidos', 'Sentidos', { placeholder: 'Visión en la oscuridad 18 m' })}
            </div>
            {campo('idiomas', 'Idiomas')}

            <h3 className="est-sec">Encuentros</h3>
            <div className="fo-fila" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
              {campo('lugar', 'Dónde se la encontró', { placeholder: 'Ciénaga de Muermo' })}
              {campo('encuentros', 'Encuentros', { inputMode: 'numeric', placeholder: '0' })}
              {campo('derrotadas', 'Abatidas', { inputMode: 'numeric', placeholder: '0' })}
            </div>
            <label className="fo-c"><span className="k">Notas (tácticas, debilidades, rumores…)</span>
              <textarea id="crf-notas" className="fo-in" rows={3} value={t.notas} onChange={(e) => set('notas', e.target.value)} />
            </label>
          </div>

          <div className="crf-col">
            <h3 className="est-sec">Imagen</h3>
            <div className="crf-imagen">
              <button type="button" className="fo-subir crf-subir" onClick={() => fichero.current?.click()}>
                {imagen ? <img src={imagen} alt="" /> : <><Icono d={UI.camara} /><span>Subir imagen</span><small>Se verá en grande en la ficha</small></>}
              </button>
              {imagen && <button type="button" className="pbtn" onClick={() => setImagen(undefined)}><Icono d={UI.papelera} />Quitar imagen</button>}
              <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ''; }} />
            </div>

            <h3 className="est-sec">Rasgos y acciones</h3>
            <ul className="crf-habs">
              {habs.map((h, i) => (
                <li key={h.id} className={!h.nombre?.trim() && !h.descripcion?.trim() ? 'hueco' : ''}>
                  <div className="crf-hab-fila">
                    <select className="fo-in" aria-label="Tipo" value={h.tipo} onChange={(e) => setHab(i, { tipo: e.target.value as TipoHabilidad })}>
                      {TIPOS_HABILIDAD.map((x) => <option key={x.id} value={x.id}>{x.uno}</option>)}
                    </select>
                    <input className="fo-in" aria-label="Nombre de la habilidad" placeholder="Sin descubrir" autoFocus={h.id === nueva} value={h.nombre ?? ''} onChange={(e) => setHab(i, { nombre: e.target.value })} />
                    <input className="fo-in" aria-label="Detalle" placeholder="+5, 2d6+3 perforante" value={h.detalle ?? ''} onChange={(e) => setHab(i, { detalle: e.target.value })} />
                    <button type="button" className="mini" aria-label="Quitar habilidad" onClick={() => setHabs((hs) => hs.filter((_, j) => j !== i))}><Icono d={UI.cruz} /></button>
                  </div>
                  <textarea className="fo-in" rows={2} aria-label="Qué hace" placeholder="Qué hace (vacío si no lo sabéis)" value={h.descripcion ?? ''} onChange={(e) => setHab(i, { descripcion: e.target.value })} />
                </li>
              ))}
            </ul>
            <div className="crf-anadir">
              <button type="button" className="chip" onClick={() => { const h = habilidadEnBlanco('accion'); setNueva(h.id); setHabs((hs) => [...hs, h]); }}><Icono d={UI.mas} size={14} />Añadir habilidad</button>
              <button type="button" className="chip" onClick={() => setHabs((hs) => [...hs, habilidadEnBlanco('accion')])} title="Para una habilidad que sabéis que tiene pero aún no ha usado">
                <span className="cr-interrogante mini-q">?</span>Hueco sin descubrir
              </button>
            </div>

            <h3 className="est-sec">Botín que deja</h3>
            <datalist id="crf-biblioteca">
              {(estado.biblioteca ?? []).map((f) => <option key={f.id} value={f.nombre} />)}
            </datalist>
            <ul className="crf-botin">
              {botin.map((b, i) => {
                const f = fichaDeBotin(estado, { id: b.id, nombre: b.nombre });
                return (
                  <li key={b.id}>
                    <span className={`slot ${f ? `has ${CLASE_RAREZA[f.rareza]}` : 'ghost'}`} title={f ? 'En la biblioteca' : 'No está en la biblioteca: se guarda como texto'}>
                      {f?.imagenUrl ? <img src={f.imagenUrl} alt="" /> : <Icono d={ICONOS[f?.icono ?? 'bag']} />}
                    </span>
                    <input className="fo-in" list="crf-biblioteca" aria-label="Objeto" placeholder="Busca en la biblioteca o escribe" value={b.nombre} onChange={(e) => setFila(i, { nombre: e.target.value })} />
                    <input className="fo-in" aria-label="Cantidad" placeholder="1, 2d4…" value={b.cantidad} onChange={(e) => setFila(i, { cantidad: e.target.value })} />
                    <input className="fo-in" aria-label="Nota" placeholder="Nota" value={b.nota} onChange={(e) => setFila(i, { nota: e.target.value })} />
                    <button type="button" className="mini" aria-label="Quitar del botín" onClick={() => setBotin((bs) => bs.filter((_, j) => j !== i))}><Icono d={UI.cruz} /></button>
                  </li>
                );
              })}
            </ul>
            <div className="crf-anadir">
              <button type="button" className="chip" onClick={() => setBotin((bs) => [...bs, { id: nuevoId('b'), nombre: '', cantidad: '', nota: '' }])}><Icono d={UI.mas} size={14} />Añadir al botín</button>
            </div>
          </div>
          <button type="submit" hidden />
        </form>

        <footer className="fo-pie">
          {c && (
            <button
              type="button" className={`btn ${confirmar ? 'peligro' : 'peligro-sec'}`}
              onClick={() => {
                if (!confirmar) return setConfirmar(true);
                eliminarCriatura(c.id);
                onEliminada();
              }}
            >
              {confirmar ? 'Confirmar: eliminar' : 'Eliminar criatura'}
            </button>
          )}
          {confirmar && <span className="fo-error">Se borra del bestiario para toda la party.</span>}
          {error && <span className="fo-error" role="alert">{error}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn sec" onClick={() => onCerrar()}>Cancelar</button>
          <button type="button" className="btn pri" onClick={guardar}>{c ? 'Guardar cambios' : 'Añadir al bestiario'}</button>
        </footer>
      </section>
    </>
  );
}
