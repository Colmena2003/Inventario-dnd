// Biblioteca de objetos: todo lo que ha pasado por la party, en grande. Se rellena sola al crear o
// editar objetos y conserva su descripción, habilidades e imagen aunque el objeto se pierda.

import { useState } from 'react';
import { ejemplares } from '../domain/biblioteca';
import { CLASE_RAREZA, nombreDe, RAREZAS } from '../domain/reglas';
import type { Categoria, Ficha } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { ICONOS, UI } from './iconos';
import { Esquinas, Icono } from './piezas';
import { useVistaObjeto } from './VistaObjeto';

const ESTADOS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'party', texto: 'En la party' },
  { id: 'perdidos', texto: 'Nadie lo tiene' },
] as const;

const ORDENES = [
  { id: 'reciente', texto: 'Más recientes' },
  { id: 'nombre', texto: 'Nombre' },
  { id: 'rareza', texto: 'Rareza' },
] as const;

const CATEGORIAS: (Categoria | null)[] = [null, 'Armas', 'Armaduras', 'Pociones', 'Pergaminos', 'Materiales', 'Comida', 'Llaves/misión', 'Varios'];

/** Lo primero que se lee de la ficha; la tarjeta lo corta a tres líneas. */
const resumen = (f: Ficha) => f.efectos || f.descripcion || f.notas || '';

export function Biblioteca({ busqueda }: { busqueda: string }) {
  const { estado } = useCofre();
  const abrir = useVistaObjeto();
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]['id']>('todos');
  const [cat, setCat] = useState<Categoria | null>(null);
  const [orden, setOrden] = useState<(typeof ORDENES)[number]['id']>('reciente');

  const q = busqueda.trim().toLocaleLowerCase('es');
  const todas = estado.biblioteca ?? [];
  const tienen = new Map(todas.map((f) => [f.id, ejemplares(estado, f.id)]));
  const perdidas = todas.filter((f) => !tienen.get(f.id)!.length).length;

  const lista = todas
    .filter((f) => (filtro === 'todos' ? true : filtro === 'party' ? tienen.get(f.id)!.length > 0 : !tienen.get(f.id)!.length))
    .filter((f) => !cat || f.categoria === cat)
    .filter((f) => !q || f.nombre.toLocaleLowerCase('es').includes(q) || (f.efectos ?? '').toLocaleLowerCase('es').includes(q) || (f.descripcion ?? '').toLocaleLowerCase('es').includes(q))
    .sort((a, b) =>
      orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es')
        : orden === 'rareza' ? RAREZAS.indexOf(b.rareza) - RAREZAS.indexOf(a.rareza) || a.nombre.localeCompare(b.nombre, 'es')
          : b.actualizada - a.actualizada);

  return (
    <section className="biblioteca" aria-label="Biblioteca de objetos">
      <header className="panel bib-cab">
        <Esquinas solo="arriba" />
        <div className="bib-titulo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS.book} /></svg>
          <div>
            <h1>Biblioteca de objetos</h1>
            <span>{todas.length} objetos conocidos · {perdidas} que ya no tiene nadie · se guardan solos al crearlos o editarlos</span>
          </div>
        </div>
        <div className="bib-filtros">
          <div role="group" aria-label="Quién lo tiene" className="fo-chips">
            {ESTADOS.map((x) => (
              <button key={x.id} type="button" className={`chip ${filtro === x.id ? 'on' : ''}`} aria-pressed={filtro === x.id} onClick={() => setFiltro(x.id)}>{x.texto}</button>
            ))}
          </div>
          <label className="orden">Ordenar
            <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
              {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
            </select>
          </label>
        </div>
        <div role="group" aria-label="Categoría" className="bib-cats">
          {CATEGORIAS.map((c) => (
            <button key={c ?? 'todas'} type="button" className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c ?? 'Todas las categorías'}</button>
          ))}
        </div>
      </header>

      {lista.length ? (
        <ul className="bib-rejilla" aria-label="Objetos de la biblioteca">
          {lista.map((f) => {
            const tiene = tienen.get(f.id)!;
            return (
              <li key={f.id}>
                <button type="button" className={`bib-carta ${CLASE_RAREZA[f.rareza]} ${tiene.length ? '' : 'perdida'}`} onClick={() => abrir(f, 'ficha')}>
                  <span className="bib-arte">
                    {f.imagenUrl ? <img src={f.imagenUrl} alt="" loading="lazy" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONOS[f.icono]} /></svg>}
                    {f.requiereSintonizacion && <span className="attm" title="Requiere sintonización" />}
                  </span>
                  <span className="bib-nombre">{f.nombre}</span>
                  <span className="bib-sub">{f.subtipo ?? f.categoria} · <span style={{ color: 'var(--rc)' }}>{f.rareza}</span></span>
                  <span className="bib-resumen">{resumen(f) || ' '}</span>
                  <span className={`bib-estado ${tiene.length ? 'en-party' : ''}`}>
                    <Icono d={tiene.length ? UI.persona : UI.cofre} size={14} />
                    {tiene.length
                      ? [...new Set(tiene.map((o) => nombreDe(estado, o.propietario).split(' ')[0]))].join(', ')
                      : f.ultimoDueno ? `Perdido · lo tuvo ${f.ultimoDueno.split(' ')[0]}` : 'Nadie lo tiene'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="bib-vacia">
          <h2>{todas.length ? 'Nada coincide' : 'La biblioteca está vacía'}</h2>
          <p>{todas.length ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Cada objeto que creéis o editéis se guardará aquí automáticamente.'}</p>
        </div>
      )}
    </section>
  );
}
