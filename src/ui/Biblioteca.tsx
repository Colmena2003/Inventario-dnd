// Biblioteca de objetos: todo lo que la party ha conocido, lo tenga alguien o no. Cada carta abre la ficha
// grande, desde la que se puede recuperar el objeto para alguien o quitarlo de la biblioteca.

import { useState } from 'react';
import { objetosDeFicha } from '../domain/biblioteca';
import { cumpleFiltros } from '../domain/filtros';
import { CATEGORIAS, CLASE_RAREZA, nombreDe, primerNombre } from '../domain/reglas';
import type { Categoria, FichaObjeto, Objeto, Rareza } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useDetalle } from './DetalleObjeto';
import { useFiltros } from './filtrosCtx';
import { claseDe, UI } from './iconos';
import { Esquinas, Icono, ImagenObjeto } from './piezas';

type Quien = 'todos' | 'party' | 'nadie';
type Orden = 'recientes' | 'nombre' | 'rareza';

const ORDEN_RAREZA: Rareza[] = ['artefacto', 'legendario', 'muy raro', 'raro', 'poco común', 'común'];

export function Biblioteca({ busqueda }: { busqueda: string }) {
  const { estado } = useCofre();
  const { filtros } = useFiltros();
  const detalle = useDetalle();
  const [quien, setQuien] = useState<Quien>('todos');
  const [orden, setOrden] = useState<Orden>('recientes');
  const [cat, setCat] = useState<Categoria | null>(null);

  const fichas = estado.biblioteca ?? [];
  const tienen = (f: FichaObjeto) => objetosDeFicha(estado, f.id);
  const perdidas = fichas.filter((f) => !tienen(f).length).length;
  const visibles = fichas
    .filter((f) => quien === 'todos' || (quien === 'party') === tienen(f).length > 0)
    .filter((f) => !cat || f.categoria === cat)
    // Las fichas no tienen dueño ni equipo: los filtros de la barra se aplican a lo que describe el objeto
    .filter((f) => cumpleFiltros({ ...f, propietario: { tipo: 'alijo' }, equipadoEn: null, cantidad: 1 } as Objeto, { ...filtros, rasgos: filtros.rasgos.filter((r) => r !== 'equipado') }, busqueda))
    .sort(orden === 'nombre' ? (a, b) => a.nombre.localeCompare(b.nombre, 'es')
      : orden === 'rareza' ? (a, b) => ORDEN_RAREZA.indexOf(a.rareza) - ORDEN_RAREZA.indexOf(b.rareza) || a.nombre.localeCompare(b.nombre, 'es')
      : (a, b) => b.actualizada - a.actualizada);

  return (
    <main className="biblioteca">
      <header className="panel bib-cab">
        <Esquinas />
        <div className="bib-titulo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={UI.biblioteca} /></svg>
          <div>
            <h1>Biblioteca de objetos</h1>
            <span>{fichas.length} objetos conocidos · {perdidas} que ya no tiene nadie · se guardan solos al crearlos o editarlos</span>
          </div>
        </div>
        <div className="bib-filtros">
          <div className="filtros" role="group" aria-label="Quién lo tiene">
            {([['todos', 'Todos'], ['party', 'En la party'], ['nadie', 'Nadie lo tiene']] as [Quien, string][]).map(([k, t]) => (
              <button key={k} type="button" className={`chip ${quien === k ? 'on' : ''}`} aria-pressed={quien === k} onClick={() => setQuien(k)}>{t}</button>
            ))}
          </div>
          <label className="orden">
            Ordenar
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
              <option value="recientes">Más recientes</option>
              <option value="nombre">Nombre</option>
              <option value="rareza">Rareza</option>
            </select>
          </label>
        </div>
        <div className="bib-cats" role="group" aria-label="Categoría">
          <button type="button" className={`chip ${!cat ? 'on' : ''}`} aria-pressed={!cat} onClick={() => setCat(null)}>Todas las categorías</button>
          {CATEGORIAS.map((c) => <button key={c} type="button" className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </header>

      {visibles.length === 0 ? (
        <div className="bib-vacia">
          <h2>{fichas.length ? 'Nada coincide' : 'La biblioteca está vacía'}</h2>
          <p>{fichas.length ? 'Prueba con otros filtros o busca otro nombre.' : 'Cada objeto que creéis o editéis se guardará aquí automáticamente.'}</p>
        </div>
      ) : (
        <ul className="bib-rejilla" aria-label="Objetos de la biblioteca">
          {visibles.map((f) => {
            const quienes = tienen(f);
            const nombres = [...new Set(quienes.map((o) => primerNombre(nombreDe(estado, o.propietario))))];
            return (
              <li key={f.id}>
                <button type="button" className={`bib-carta ${CLASE_RAREZA[f.rareza]} ${quienes.length ? '' : 'perdida'}`} onClick={() => detalle.verFicha(f)}>
                  <span className="bib-arte">
                    <ImagenObjeto o={f} />
                    {f.requiereSintonizacion && <span className="attm" title="Requiere sintonización" />}
                  </span>
                  <span className="bib-nombre">{f.nombre}</span>
                  <span className="bib-sub">{claseDe(f)} · <span style={{ color: 'var(--rc)' }}>{f.rareza}</span></span>
                  <span className="bib-resumen">{f.efectos ?? f.descripcion ?? ''}</span>
                  <span className={`bib-estado ${quienes.length ? 'en-party' : ''}`}>
                    <Icono d={quienes.length ? UI.persona : UI.cofre} size={14} />
                    {quienes.length ? nombres.join(', ') : `Nadie lo tiene${f.ultimoDueno ? ` · lo tuvo ${primerNombre(f.ultimoDueno)}` : ''}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
