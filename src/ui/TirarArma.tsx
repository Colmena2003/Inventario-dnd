// El bono de ataque y el daño de un arma equipada se tiran con un clic en la mesa 3D, con el color del
// personaje. Clic derecho: ventaja o desventaja en el ataque; crítico o daños condicionales en el daño.
// Tras un crítico en el ataque, el siguiente clic en el daño de esa arma ya sale doblado.

import type { MouseEvent, ReactNode } from 'react';
import { extrasCondicionales, tiradaAtaque, tiradaDano, type PreparadaArma } from '../domain/ataques';
import { crearTirada, criticoDe, estiloDe, type Modo } from '../domain/dados';
import type { AtaqueArma } from '../domain/hoja';
import { primerNombre } from '../domain/reglas';
import type { Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { useAvisar } from './avisos';
import { tituloAtaque } from './desglose';
import { DADOS } from './iconosJuego';
import { useMenuContextual, type OpcionMenu } from './Menu';

/** Arma (personaje + objeto) → cuándo sacó crítico en su último ataque. */
const criticos = new Map<string, number>();
/** Un crítico vale para el daño durante este rato. */
const VIGENCIA_CRITICO = 2 * 60_000;
const clave = (p: Personaje, a: AtaqueArma) => `${p.id}:${a.objeto.id}:${a.indice}`;

function useLanzar(p: Personaje) {
  const { lanzarDados } = useCofre();
  return (prep: PreparadaArma) => {
    const t = crearTirada({ quien: p.id, nombre: primerNombre(p.nombre), estilo: estiloDe(p), ...prep });
    lanzarDados(t);
    return t;
  };
}

export function TiroAtaque({ p, a, className = '', children }: { p: Personaje; a: AtaqueArma; className?: string; children: ReactNode }) {
  const lanzar = useLanzar(p);
  const menu = useMenuContextual();
  const atacar = (modo?: Modo | null) => {
    const t = lanzar(tiradaAtaque(a, modo));
    if (criticoDe(t) === 'exito') criticos.set(clave(p, a), Date.now());
    else criticos.delete(clave(p, a));
  };
  const opciones = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    menu(e, [
      { titulo: `Atacar con ${a.objeto.nombre}` },
      { texto: 'Tirada normal', icono: DADOS.d20, onClick: () => atacar(null) },
      { texto: 'Con ventaja', icono: DADOS.d20, onClick: () => atacar('ventaja') },
      { texto: 'Con desventaja', icono: DADOS.d20, onClick: () => atacar('desventaja') },
    ]);
  };
  return (
    <button
      type="button" className={`tiro ${className}`} onClick={() => atacar()} onContextMenu={opciones}
      title={`${tituloAtaque(a)}\n\nClic: tirar el ataque · clic derecho: ventaja o desventaja`}
      aria-label={`Tirar ataque con ${a.objeto.nombre}`}
    >
      {children}
    </button>
  );
}

export function TiroDano({ p, a, className = '', children }: { p: Personaje; a: AtaqueArma; className?: string; children: ReactNode }) {
  const lanzar = useLanzar(p);
  const menu = useMenuContextual();
  const avisar = useAvisar();
  const condicionales = extrasCondicionales(a);

  const danar = (opciones: { critico?: boolean; condicionales?: number[] }) => {
    const prep = tiradaDano(a, opciones);
    if (!prep) { avisar(`${a.objeto.nombre} hace un daño fijo de ${a.dano}`); return; }
    criticos.delete(clave(p, a));
    lanzar(prep);
  };
  // Si el último ataque con esta arma fue crítico, el daño sale doblado sin pedirlo
  const clic = () => {
    const cuando = criticos.get(clave(p, a));
    danar({ critico: !!cuando && Date.now() - cuando < VIGENCIA_CRITICO });
  };
  const opciones = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const lista: OpcionMenu[] = [
      { titulo: `Daño de ${a.objeto.nombre}` },
      { texto: 'Daño normal', icono: DADOS.d6, onClick: () => danar({}) },
      { texto: 'Crítico (dados dobles)', icono: DADOS.d6, onClick: () => danar({ critico: true }) },
    ];
    condicionales.forEach((x, i) => {
      lista.push({ texto: `+ ${x.dado}${x.tipo ? ` ${x.tipo}` : ''} (${x.condicion})`, icono: DADOS.d6, onClick: () => danar({ condicionales: [i] }) });
    });
    menu(e, lista);
  };
  return (
    <button
      type="button" className={`tiro ${className}`} onClick={clic} onContextMenu={opciones}
      title={`${tituloAtaque(a)}\n\nClic: tirar el daño · clic derecho: crítico${condicionales.length ? ' o daño extra' : ''}`}
      aria-label={`Tirar daño de ${a.objeto.nombre}`}
    >
      {children}
    </button>
  );
}
