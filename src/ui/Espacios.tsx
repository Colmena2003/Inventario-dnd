// Espacios de conjuro en la ficha: un rombo por espacio. Clic en uno lleno lo gasta; en uno vacío, lo devuelve.
// Los descansos de la despensa los recuperan (el largo, todos; el corto, los del pacto).

import { espaciosDe, type EspaciosNivel } from '../domain/conjuros';
import type { Personaje } from '../domain/tipos';
import { useCofre } from '../store/cofre';

const ORDINAL = ['', '1.º', '2.º', '3.º', '4.º', '5.º', '6.º', '7.º', '8.º', '9.º'];

export function EspaciosConjuro({ p, avisar }: { p: Personaje; avisar: (texto: string, error?: boolean) => void }) {
  const { gastarEspacio } = useCofre();
  const { niveles, pacto } = espaciosDe(p);
  if (!niveles.length && !pacto) return null;

  const fila = (e: EspaciosNivel, nivelGasto: number, etiqueta: string, titulo: string) => {
    const quedan = e.max - e.usados;
    return (
      <div className="esp-fila" key={etiqueta}>
        <span className="esp-nivel" title={titulo}>{etiqueta}</span>
        <span className="esp-rombos" role="group" aria-label={`${titulo}: quedan ${quedan} de ${e.max}`}>
          {Array.from({ length: e.max }, (_, i) => {
            const lleno = i < quedan;
            return (
              <button
                key={i} type="button" className={`esp-rombo ${lleno ? 'lleno' : ''}`}
                aria-label={lleno ? `Gastar un espacio de ${titulo.toLowerCase()}` : `Recuperar un espacio de ${titulo.toLowerCase()}`}
                onClick={() => {
                  const motivo = gastarEspacio(p.id, nivelGasto, lleno ? 1 : -1);
                  if (motivo) avisar(motivo, true);
                }}
              />
            );
          })}
        </span>
        <span className="esp-quedan">{quedan}/{e.max}</span>
      </div>
    );
  };

  return (
    <div className="ficha-bloque">
      <h3 className="titulo-sec">Espacios de conjuro</h3>
      <div className="esp-lista">
        {niveles.map((e) => fila(e, e.nivel, ORDINAL[e.nivel], `Nivel ${e.nivel}`))}
        {pacto && fila(pacto, 0, `Pacto ${ORDINAL[pacto.nivel]}`, `Magia del pacto (nivel ${pacto.nivel})`)}
      </div>
    </div>
  );
}
