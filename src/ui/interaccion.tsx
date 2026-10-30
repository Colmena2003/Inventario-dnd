// Piezas que comparten la vista grupal y la individual: interacción de ranuras (clic, doble clic, menú,
// arrastre, tooltip y atenuado por búsqueda y filtros), rejilla de objetos, ranuras de equipo y silueta.

import { useRef, type HTMLAttributes } from 'react';
import { cumpleFiltros } from '../domain/filtros';
import { equipadoEn, mismoPropietario, nombreDe, personajeDelJugador, rejilla } from '../domain/reglas';
import { usable } from '../domain/uso';
import type { Objeto, Personaje, Propietario, TipoRanura } from '../domain/tipos';
import { useCofre } from '../store/cofre';
import { baseDe, celdaDe, useArrastre } from './arrastre';
import { useAvisar } from './avisos';
import { useDetalle } from './DetalleObjeto';
import { useSintonia } from './Dialogos';
import { useEditor } from './editorCtx';
import { useFiltros } from './filtrosCtx';
import { UI, type ClaveIcono } from './iconos';
import { useMenuContextual, type OpcionMenu } from './Menu';
import { Ranura } from './piezas';
import { useTooltip } from './Tooltip';

/** Espera para distinguir un clic (abre la ficha) del primero de un doble clic. */
const ESPERA_DOBLE = 230;

/** Opciones del clic derecho en un objeto: ver, editar, usar, sintonizar, dárselo a otro o eliminarlo. */
function useMenuObjeto() {
  const { estado, actor, mover, usar, eliminarObjeto } = useCofre();
  const abrir = useMenuContextual();
  const editor = useEditor();
  const detalle = useDetalle();
  const sintonia = useSintonia();
  const avisar = useAvisar();
  return (e: { clientX: number; clientY: number }, o: Objeto) => {
    const dar = (p: Propietario) => {
      const v = mover(o.id, { propietario: p }, undefined, o.propietario);
      avisar(v.ok ? `${o.nombre} → ${nombreDe(estado, p)}` : v.motivo, !v.ok);
    };
    const otros: Propietario[] = [
      ...estado.personajes.filter((p) => !(o.propietario.tipo === 'personaje' && o.propietario.id === p.id)).map((p) => ({ tipo: 'personaje' as const, id: p.id })),
      ...(o.propietario.tipo === 'alijo' ? [] : [{ tipo: 'alijo' as const }]),
    ];
    const opciones: OpcionMenu[] = [
      { texto: 'Ver ficha', icono: UI.lupa, onClick: () => detalle.verObjeto(o) },
      { texto: 'Editar objeto', icono: UI.lapiz, onClick: () => editor.editar(o) },
    ];
    if (usable(o)) {
      opciones.push({
        texto: o.categoria === 'Comida' ? 'Comer' : o.cargasMax ? `Usar · ${o.cargas ?? 0}/${o.cargasMax} cargas` : 'Usar',
        icono: UI.rayo,
        desactivada: !!o.cargasMax && (o.cargas ?? 0) < 1,
        onClick: () => {
          // Lo del alijo lo usa quien maneja la app
          const yo = personajeDelJugador(estado, actor);
          const r = usar(o.id, yo?.id);
          avisar(r.ok ? r.texto : r.motivo, !r.ok);
        },
      });
    }
    if (o.requiereSintonizacion && o.propietario.tipo === 'personaje') {
      opciones.push({ texto: o.sintonizado ? 'Quitar sintonización' : 'Sintonizar', icono: UI.check, onClick: () => sintonia(o) });
    }
    if (otros.length) {
      opciones.push({ titulo: 'Dar a' }, ...otros.map((p) => ({ texto: nombreDe(estado, p), icono: p.tipo === 'alijo' ? UI.cofre : UI.persona, onClick: () => dar(p) })));
    }
    opciones.push('separador', {
      texto: 'Eliminar objeto', icono: UI.papelera, peligro: true,
      onClick: () => abrir(e, [
        { titulo: `¿Eliminar ${o.nombre} para siempre?` },
        { texto: 'Sí, eliminar', icono: UI.papelera, peligro: true, onClick: () => { eliminarObjeto(o.id); avisar(`${o.nombre} eliminado`); } },
        { texto: 'Cancelar', onClick: () => {} },
      ]),
    });
    abrir(e, opciones);
  };
}

/**
 * Arrastre, tooltip, clic (abre la ficha, o `alTocar` si se da), doble clic, clic derecho (menú) y atenuado
 * por búsqueda y filtros.
 */
export function useInteraccion(busqueda: string, onDoble?: (o: Objeto) => void, alTocar?: (o: Objeto) => void) {
  const { arrastre, empezar } = useArrastre();
  const { mostrar, ocultar } = useTooltip();
  const { filtros } = useFiltros();
  const detalle = useDetalle();
  const menu = useMenuObjeto();
  const espera = useRef(0);
  return {
    arrastre,
    props: (o: Objeto) => ({
      onPointerDown: (e: React.PointerEvent) => {
        ocultar();
        const tocar = () => (alTocar ? alTocar(o) : detalle.verObjeto(o));
        empezar(e, o, () => {
          window.clearTimeout(espera.current);
          if (onDoble) espera.current = window.setTimeout(tocar, ESPERA_DOBLE);
          else tocar();
        });
      },
      onPointerEnter: (e: React.PointerEvent) => { if (!arrastre) mostrar(o, e.currentTarget); },
      onPointerLeave: ocultar,
      onDoubleClick: onDoble ? () => { window.clearTimeout(espera.current); onDoble(o); } : undefined,
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); ocultar(); menu(e, o); },
    }),
    clase: (o: Objeto) => {
      if (arrastre?.objeto.id === o.id) return 'origin';
      return cumpleFiltros(o, filtros, busqueda) ? '' : 'no';
    },
  };
}

/** Rellena con ranuras vacías hasta completar filas, sin respetar posiciones (vistas filtradas). */
export function celdas(objetos: Objeto[], minimo: number, porFila: number) {
  const total = Math.max(minimo, Math.ceil((objetos.length + 1) / porFila) * porFila);
  return Array.from({ length: total }, (_, i) => objetos[i]);
}

export const claveDe = (p: Propietario) => (p.tipo === 'alijo' ? 'alijo' : `pj:${p.id}`);

/**
 * Rejilla de inventario. Con `porCelda` cada objeto ocupa su celda y se puede soltar en una concreta (para
 * colocarlo o intercambiarlo); sin él (vista filtrada), se compacta. Ilumina dónde caería lo que se arrastra.
 */
export function RejillaObjetos({ objetos, dueno, minimo, porFila, busqueda, onDoble, porCelda, valido, ...resto }: {
  objetos: Objeto[];
  dueno: Propietario;
  minimo: number;
  porFila: number;
  busqueda: string;
  onDoble?: (o: Objeto) => void;
  porCelda: boolean;
  /** Si lo que se arrastra puede llegar a este dueño (carga). */
  valido: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const { arrastre, props, clase } = useInteraccion(busqueda, onDoble);
  const base = claveDe(dueno);
  const lista = porCelda ? rejilla(objetos, minimo, porFila) : celdas(objetos, minimo, porFila);

  let destacada = -1;
  const objetivo = arrastre?.objetivo;
  if (arrastre && objetivo && baseDe(objetivo.clave) === base) {
    const celda = celdaDe(objetivo.clave);
    const mismoDueno = mismoPropietario(arrastre.objeto.propietario, dueno);
    if (porCelda && celda !== undefined) destacada = celda;
    else if (!(mismoDueno && !arrastre.objeto.equipadoEn)) {
      const a = arrastre.objeto;
      const pila = lista.findIndex((o) => o && o.id !== a.id && o.nombre === a.nombre && o.rareza === a.rareza && o.icono === a.icono && !o.sintonizado && !o.equipadoEn);
      destacada = pila >= 0 ? pila : lista.findIndex((o) => !o);
    }
  }
  const marca = valido ? 'drop-ok' : 'drop-no';

  return (
    <div data-drop={base} role="list" {...resto}>
      {lista.map((o, i) => {
        const drop = porCelda ? `${base}#${i}` : undefined;
        const m = i === destacada ? marca : '';
        return o
          ? <Ranura key={o.id} role="listitem" data-drop={drop} objeto={o} extra={`${clase(o)} ${m}`} {...props(o)} />
          : <Ranura key={`v${i}`} role="listitem" data-drop={drop} extra={m} />;
      })}
    </div>
  );
}

export const IZQ: [TipoRanura, ClaveIcono][] = [['cabeza', 'helm'], ['capa', 'cloak'], ['armadura', 'armor'], ['guantes', 'gloves'], ['botas', 'boots']];
export const DCHA: [TipoRanura, number, ClaveIcono][] = [['amuleto', 0, 'amulet'], ['anillo', 0, 'ring'], ['anillo', 1, 'ring']];

export const nombreRanura = (r: TipoRanura) =>
  ({ cabeza: 'Cabeza', capa: 'Capa', armadura: 'Armadura', guantes: 'Guantes', botas: 'Botas', amuleto: 'Amuleto', anillo: 'Anillo', cuerpoACuerpo: 'Cuerpo a cuerpo', distancia: 'A distancia' })[r];

/** Ranura de equipo: destino de arrastre que se ilumina si el objeto que se arrastra encaja. */
export function RanuraEquipo({ p, ranura, indice, fantasma, etiqueta, busqueda, extra = '', onDoble }: {
  p: Personaje;
  ranura: TipoRanura;
  indice: number;
  fantasma: ClaveIcono;
  etiqueta?: string;
  busqueda: string;
  extra?: string;
  onDoble?: (o: Objeto) => void;
}) {
  const { estado, validar } = useCofre();
  const { arrastre, props, clase } = useInteraccion(busqueda, onDoble);
  const o = equipadoEn(estado, p.id, ranura, indice);
  const k = `pj:${p.id}:${ranura}:${indice}`;
  let marca = '';
  if (arrastre) {
    const compatible = arrastre.objeto.ranuraEquipo === ranura;
    if (arrastre.objetivo?.clave === k) {
      marca = compatible && validar(arrastre.objeto.id, { propietario: { tipo: 'personaje', id: p.id }, equipar: { ranura, indice } }).ok ? 'drop-ok' : 'drop-no';
    } else if (!compatible) marca = 'no';
  }
  if (o) return <Ranura data-drop={k} objeto={o} extra={`${extra} ${clase(o)} ${marca}`} {...props(o)} />;
  return <Ranura data-drop={k} fantasma={fantasma} etiqueta={`${etiqueta ?? nombreRanura(ranura)}: vacío`} extra={`${extra} ${marca}`} />;
}

export const SILUETA_ARMA: Partial<Record<ClaveIcono, string>> = {
  sword: 'M150 190L182 60M176 84l14 4',
  staff: 'M146 360L150 60M150 60a8 8 0 1 1 0.1 0',
  hammer: 'M52 230L30 120M22 112l18-10 6 14-18 10z',
  bow: 'M40 200c-24-40-20-110 10-150M40 200L12 60',
};

/** Silueta de relleno mientras el jugador no sube una imagen. */
export function Silueta({ tinte, id, arma, className, aura = true }: { tinte: string; id: string; arma?: string; className?: string; aura?: boolean }) {
  return (
    <svg viewBox="0 0 200 400" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`fg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tinte} stopOpacity=".95" />
          <stop offset=".6" stopColor={tinte} stopOpacity=".35" />
          <stop offset="1" stopColor="#0c0a08" stopOpacity=".9" />
        </linearGradient>
        <radialGradient id={`aura-${id}`} cx=".5" cy=".45" r=".55">
          <stop offset="0" stopColor={tinte} stopOpacity=".28" />
          <stop offset="1" stopColor={tinte} stopOpacity="0" />
        </radialGradient>
      </defs>
      {aura && <rect x="-40" y="0" width="280" height="400" fill={`url(#aura-${id})`} />}
      <ellipse cx="100" cy="374" rx="78" ry="13" fill="none" stroke={tinte} strokeOpacity=".45" strokeWidth="1.2" />
      <ellipse cx="100" cy="374" rx="58" ry="8" fill={tinte} opacity=".18" />
      <path d="M28 362c30-14 120-16 150 2M40 352c40-8 90-8 124 4" fill="none" stroke={tinte} strokeOpacity=".3" strokeWidth="1" />
      <path d="M68 98L38 360l40-14 12 24 10-20 10 20 12-24 40 14L132 98z" fill="#090706" opacity=".9" />
      {arma && <path d={arma} fill="none" stroke="#d8d0c0" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" />}
      <path
        d="M100 30c14 0 24 10 24 25s-10 26-24 26-24-11-24-26 10-25 24-25zM78 88h44l20 10 12 78-14 6-10-52-6 62 8 118h-28l-10-104-10 104H66l8-118-6-62-10 52-14-6 12-78z"
        fill={`url(#fg-${id})`} stroke={tinte} strokeOpacity=".6" strokeWidth="1"
      />
    </svg>
  );
}

/** Lado mayor de un retrato: el mismo se suba desde donde se suba, porque se ve en grande en la ficha. */
export const LADO_RETRATO = 900;

/** Reduce la imagen subida para que quepa en el almacenamiento local. */
export function reducirImagen(f: File, lado: number): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(f);
  });
}
