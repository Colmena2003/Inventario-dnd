// Datos de ejemplo: la party y los personajes salen de datos-ejemplo.json; los objetos completan
// ese archivo con los que aparecen en diseno/Main.dc.html. Pesos y valores son estimaciones de prueba.

import ejemplo from '../../datos-ejemplo.json';
import type { ClaveIcono } from '../ui/iconos';
import { saciedadDesde100 } from '../domain/reglas';
import { inferirTipo } from '../domain/objetos';
import type { Categoria, Equipado, Estado, Modificador, Objeto, Personaje, Propietario, Rareza, TipoRanura } from '../domain/tipos';

const R: Record<string, Rareza> = { c: 'común', u: 'poco común', r: 'raro', m: 'muy raro', l: 'legendario', a: 'artefacto' };

type Base = { categoria: Categoria; pesoKg: number; valorPo: number; ranuraEquipo?: TipoRanura };

const POR_ICONO: Record<ClaveIcono, Base> = {
  sword: { categoria: 'Armas', pesoKg: 1.5, valorPo: 15, ranuraEquipo: 'cuerpoACuerpo' },
  axe: { categoria: 'Armas', pesoKg: 1, valorPo: 5, ranuraEquipo: 'cuerpoACuerpo' },
  bow: { categoria: 'Armas', pesoKg: 1, valorPo: 25, ranuraEquipo: 'distancia' },
  staff: { categoria: 'Armas', pesoKg: 2, valorPo: 5, ranuraEquipo: 'cuerpoACuerpo' },
  dagger: { categoria: 'Armas', pesoKg: 0.5, valorPo: 2, ranuraEquipo: 'cuerpoACuerpo' },
  shield: { categoria: 'Armaduras', pesoKg: 3, valorPo: 10, ranuraEquipo: 'cuerpoACuerpo' },
  helm: { categoria: 'Armaduras', pesoKg: 1.5, valorPo: 10, ranuraEquipo: 'cabeza' },
  armor: { categoria: 'Armaduras', pesoKg: 9, valorPo: 50, ranuraEquipo: 'armadura' },
  cloak: { categoria: 'Varios', pesoKg: 1, valorPo: 2, ranuraEquipo: 'capa' },
  gloves: { categoria: 'Armaduras', pesoKg: 0.5, valorPo: 5, ranuraEquipo: 'guantes' },
  boots: { categoria: 'Armaduras', pesoKg: 1, valorPo: 5, ranuraEquipo: 'botas' },
  amulet: { categoria: 'Varios', pesoKg: 0.05, valorPo: 50, ranuraEquipo: 'amuleto' },
  ring: { categoria: 'Varios', pesoKg: 0.01, valorPo: 50, ranuraEquipo: 'anillo' },
  potion: { categoria: 'Pociones', pesoKg: 0.5, valorPo: 50 },
  scroll: { categoria: 'Pergaminos', pesoKg: 0.05, valorPo: 60 },
  book: { categoria: 'Varios', pesoKg: 1.5, valorPo: 25 },
  key: { categoria: 'Llaves/misión', pesoKg: 0.1, valorPo: 1 },
  gem: { categoria: 'Varios', pesoKg: 0.05, valorPo: 100 },
  herb: { categoria: 'Materiales', pesoKg: 0.05, valorPo: 2 },
  ore: { categoria: 'Materiales', pesoKg: 1, valorPo: 5 },
  fang: { categoria: 'Materiales', pesoKg: 0.2, valorPo: 10 },
  bread: { categoria: 'Comida', pesoKg: 1, valorPo: 0.5 },
  meat: { categoria: 'Comida', pesoKg: 0.5, valorPo: 0.5 },
  apple: { categoria: 'Comida', pesoKg: 0.2, valorPo: 0.1 },
  flask: { categoria: 'Varios', pesoKg: 0.5, valorPo: 1 },
  hammer: { categoria: 'Armas', pesoKg: 1.5, valorPo: 15, ranuraEquipo: 'cuerpoACuerpo' },
  bag: { categoria: 'Varios', pesoKg: 2, valorPo: 2 },
  torch: { categoria: 'Varios', pesoKg: 0.5, valorPo: 0.01 },
  drop: { categoria: 'Varios', pesoKg: 0.3, valorPo: 1 },
  mushroom: { categoria: 'Materiales', pesoKg: 0.05, valorPo: 1 },
};

let n = 0;
function obj(dueno: Propietario, nombre: string, icono: ClaveIcono, r: string, cantidad = 1, extra: Partial<Objeto> = {}): Objeto {
  const o: Objeto = {
    id: `s${++n}`, nombre, icono, rareza: R[r], cantidad, ...POR_ICONO[icono],
    propietario: dueno, equipadoEn: null, ...extra,
  };
  return { ...o, tipo: o.tipo ?? inferirTipo(o) };
}
const mods = (...m: Modificador[]) => ({ modificadores: m });
const escudo = { tipo: 'escudo' as const, bonoCa: 2 };
const ballesta = { tipoArma: 'sencilla' as const, pesoKg: 2.5, dado: '1d8', tipoDano: 'perforante', propiedades: ['municion' as const, 'recarga' as const, 'dosManos' as const], rango: '24/96 m' };
const comida = (subtipo: string, saciedad: number) => ({ categoria: 'Comida' as const, tipo: 'comida' as const, subtipo, saciedad });
const eq = (ranura: TipoRanura, indice = 0): { equipadoEn: Equipado } => ({ equipadoEn: { ranura, indice } });
const sint = { requiereSintonizacion: true, sintonizado: true };
const reqSint = { requiereSintonizacion: true, sintonizado: false };
const municion = { categoria: 'Armas' as const, tipo: 'municion' as const, subtipo: 'munición', pesoKg: 0.03, valorPo: 0.05, ranuraEquipo: null };
const noEquipable = { ranuraEquipo: null };

const pj = (id: string): Propietario => ({ tipo: 'personaje', id });
const alijo: Propietario = { tipo: 'alijo' };

const [o1, o2, o3, o4, o5] = ejemplo.objetos as unknown as Objeto[];

function objetos(): Objeto[] {
  const A = pj('aldric'), N = pj('nerys'), B = pj('brom'), Y = pj('ysolde');
  return [
    // Aldric
    { ...o1, tipo: 'arma', tipoArma: 'marcial', dado: '1d8', dadoVersatil: '1d10', tipoDano: 'cortante', bonoMagico: 1, propiedades: ['versatil'], danosExtra: [{ dado: '1d6', tipo: 'radiante', condicion: 'contra muertos vivientes' }], efectos: 'Destello del alba. Como acción adicional, gasta 1 carga: la hoja emite luz brillante en 6 m y los muertos vivientes dentro tienen desventaja al atacarte hasta tu siguiente turno.' },
    obj(A, 'Yelmo del centinela', 'helm', 'r', 1, { ...eq('cabeza'), ...mods({ objetivo: 'pasiva:percepcion', valor: 2 }, { objetivo: 'iniciativa', valor: 1 }) }),
    obj(A, 'Capa de viaje reforzada', 'cloak', 'u', 1, eq('capa')),
    obj(A, 'Coraza de placas bruñida', 'armor', 'r', 1, { ...eq('armadura'), armadura: { tipo: 'media', caBase: 14 }, bonoMagico: 1 }),
    obj(A, 'Guanteletes de acero', 'gloves', 'u', 1, eq('guantes')),
    obj(A, 'Medallón del Juramento', 'amulet', 'm', 1, { ...eq('amuleto'), ...sint, ...mods({ objetivo: 'resistencia', texto: 'necrótico' }, { objetivo: 'salv:sab', valor: 1 }) }),
    obj(A, 'Anillo de protección', 'ring', 'u', 1, { ...eq('anillo'), ...sint, ...mods({ objetivo: 'ca', valor: 1 }, { objetivo: 'salv:todas', valor: 1 }) }),
    obj(A, 'Escudo de roble y hierro', 'shield', 'u', 1, { ...eq('cuerpoACuerpo', 1), ...escudo }),
    obj(A, 'Jabalinas', 'dagger', 'c', 3, { ...eq('distancia'), tipo: 'arma', tipoArma: 'sencilla', ranuraEquipo: 'distancia', pesoKg: 1, dado: '1d6', tipoDano: 'perforante', propiedades: ['arrojadiza'], rango: '9/36 m' }),
    obj(A, 'Poción de curación', 'potion', 'c', 4, { efectos: 'Recuperas 2d4+2 PV.' }),
    obj(A, 'Poción de curación mayor', 'potion', 'u', 2, { valorPo: 150, efectos: 'Recuperas 4d4+4 PV.' }),
    obj(A, 'Pergamino de Revivir', 'scroll', 'r', 1, { valorPo: 300 }),
    obj(A, 'Agua bendita', 'flask', 'u', 3, { valorPo: 25 }),
    obj(A, 'Raciones de viaje', 'bread', 'c', 5, comida('ración', 2)),
    obj(A, 'Antorcha', 'torch', 'c', 3),
    obj(A, 'Kit de explorador', 'bag', 'c', 1, { pesoKg: 1.5, valorPo: 10 }),
    obj(A, 'Llave de hierro oxidada', 'key', 'c', 1),
    obj(A, 'Libro de plegarias', 'book', 'c', 1),
    obj(A, 'Zafiro tallado', 'gem', 'r', 1, { valorPo: 500 }),
    obj(A, 'Martillo de herrero', 'hammer', 'c', 1, { ...noEquipable, categoria: 'Varios' }),
    obj(A, 'Carne en salazón', 'meat', 'c', 2, comida('ración', 1)),

    // Nerys
    obj(N, 'Diadema de plata lunar', 'helm', 'u', 1, { ...eq('cabeza'), pesoKg: 0.2 }),
    obj(N, 'Capa del erudito', 'cloak', 'r', 1, { ...eq('capa'), ...mods({ objetivo: 'hab:arcanos', valor: 2 }, { objetivo: 'hab:historia', valor: 2 }) }),
    obj(N, 'Túnica bordada', 'armor', 'u', 1, { ...eq('armadura'), pesoKg: 2, armadura: { tipo: 'ropa', caBase: 10 }, ...mods({ objetivo: 'ca', valor: 1 }) }),
    obj(N, 'Botas silenciosas', 'boots', 'u', 1, { ...eq('botas'), ...mods({ objetivo: 'ventaja', texto: 'pruebas de Sigilo para moverse en silencio' }) }),
    obj(N, 'Amuleto de la salud', 'amulet', 'r', 1, { ...eq('amuleto'), ...sint, ...mods({ objetivo: 'car:con', valor: 19, fijar: true }), efectos: 'Tu Constitución pasa a ser 19 mientras lo llevas. No tiene efecto si ya es 19 o más.' }),
    obj(N, 'Anillo de estrellas fugaces', 'ring', 'r', 1, { ...eq('anillo'), ...sint, cargas: 3, cargasMax: 3, recarga: 'Al amanecer', ...mods({ objetivo: 'nota', texto: 'Luces danzantes y Luz a voluntad en penumbra' }) }),
    obj(N, 'Anillo de agua', 'ring', 'u', 1, eq('anillo', 1)),
    obj(N, 'Bastón de sauce arcano', 'staff', 'r', 1, { ...eq('cuerpoACuerpo'), tipoArma: 'sencilla', dado: '1d6', dadoVersatil: '1d8', tipoDano: 'contundente', bonoMagico: 1, propiedades: ['versatil'], otrasPropiedades: ['Foco arcano'], ...mods({ objetivo: 'ataque:conjuro', valor: 1 }, { objetivo: 'cdConjuros', valor: 1 }) }),
    obj(N, 'Ballesta ligera', 'bow', 'c', 1, { ...eq('distancia'), ...ballesta }),
    obj(N, 'Libro de conjuros', 'book', 'r', 1, { valorPo: 50 }),
    obj(N, 'Pergamino de Bola de fuego', 'scroll', 'u', 2, { valorPo: 200 }),
    obj(N, 'Pergamino de Identificar', 'scroll', 'c', 3),
    obj(N, 'Tinta de pulpo', 'drop', 'c', 2, { valorPo: 10 }),
    obj(N, 'Poción de curación', 'potion', 'c', 2, { efectos: 'Recuperas 2d4+2 PV.' }),
    obj(N, 'Polvo de diamante', 'gem', 'u', 1, { valorPo: 300, categoria: 'Materiales', subtipo: 'reactivo' }),
    obj(N, 'Hierba lunar', 'herb', 'c', 6, { subtipo: 'hierba' }),
    obj(N, 'Seta de las cavernas', 'mushroom', 'u', 3, { subtipo: 'hierba' }),
    obj(N, 'Frasco vacío', 'flask', 'c', 4, { pesoKg: 0.25 }),
    obj(N, 'Virotes', 'dagger', 'c', 20, municion),
    obj(N, 'Manzana', 'apple', 'c', 3, comida('ingrediente', 1)),
    obj(N, 'Pergamino de Volar', 'scroll', 'r', 1, { valorPo: 400 }),

    // Brom
    obj(B, 'Yelmo de cuerno', 'helm', 'r', 1, eq('cabeza')),
    obj(B, 'Cota de mallas rúnica', 'armor', 'r', 1, { ...eq('armadura'), ...sint, pesoKg: 10, armadura: { tipo: 'pesada', caBase: 16, fueMin: 13, sigiloDesventaja: true }, ...mods({ objetivo: 'resistencia', texto: 'relámpago' }) }),
    obj(B, 'Guantes de forja', 'gloves', 'u', 1, eq('guantes')),
    obj(B, 'Botas de hierro', 'boots', 'u', 1, { ...eq('botas'), pesoKg: 2 }),
    obj(B, 'Símbolo de la Llama Eterna', 'amulet', 'l', 1, { ...eq('amuleto'), ...sint, ...mods({ objetivo: 'cdConjuros', valor: 2 }, { objetivo: 'ataque:conjuro', valor: 2 }, { objetivo: 'resistencia', texto: 'fuego' }) }),
    obj(B, 'Martillo de guerra', 'hammer', 'u', 1, { ...eq('cuerpoACuerpo'), tipoArma: 'marcial', pesoKg: 1, dado: '1d8', dadoVersatil: '1d10', tipoDano: 'contundente', propiedades: ['versatil'] }),
    obj(B, 'Escudo blasonado', 'shield', 'r', 1, { ...eq('cuerpoACuerpo', 1), ...escudo }),
    obj(B, 'Ballesta ligera', 'bow', 'c', 1, { ...eq('distancia'), ...ballesta }),
    { ...o3, tipo: 'pocion' },
    obj(B, 'Lingote de hierro', 'ore', 'c', 6, { subtipo: 'mineral' }),
    obj(B, 'Mineral de mitral', 'ore', 'r', 2, { subtipo: 'mineral', valorPo: 200 }),
    obj(B, 'Poción de resistencia', 'potion', 'u', 1, { valorPo: 300, efectos: 'Resistencia al fuego durante 1 hora.', alUsar: { nombre: 'Resistencia al fuego', duracion: { tipo: 'tiempo', segundos: 3600 }, modificadores: [{ objetivo: 'resistencia', texto: 'fuego' }] } }),
    obj(B, 'Herramientas de herrero', 'hammer', 'c', 1, { ...noEquipable, categoria: 'Varios', pesoKg: 4, valorPo: 20 }),
    obj(B, 'Hacha de mano', 'axe', 'c', 2, { tipoArma: 'sencilla', dado: '1d6', tipoDano: 'cortante', propiedades: ['ligera', 'arrojadiza'], rango: '6/18 m' }),
    obj(B, 'Cerveza enana', 'flask', 'c', 4, comida('bebida', 1)),
    obj(B, 'Pan de piedra', 'bread', 'c', 2, comida('ración', 2)),
    obj(B, 'Pergamino de Restablecimiento', 'scroll', 'u', 1, { valorPo: 150 }),
    obj(B, 'Colmillo de huargo', 'fang', 'c', 5, { subtipo: 'parte de criatura' }),
    obj(B, 'Antorcha', 'torch', 'c', 4),
    obj(B, 'Llave del santuario', 'key', 'u', 1),
    obj(B, 'Kit de sanador', 'bag', 'c', 1, { pesoKg: 1.5, valorPo: 5 }),
    obj(B, 'Virotes', 'dagger', 'c', 18, municion),
    obj(B, 'Gema de sangre', 'gem', 'm', 1, { valorPo: 1000 }),
    obj(B, 'Carne seca', 'meat', 'c', 1, comida('ración', 1)),

    // Ysolde
    obj(Y, 'Capa de la sombra élfica', 'cloak', 'm', 1, { ...eq('capa'), ...sint, ...mods({ objetivo: 'ventaja', texto: 'pruebas de Sigilo' }, { objetivo: 'hab:sigilo', valor: 1 }) }),
    obj(Y, 'Cuero tachonado', 'armor', 'u', 1, { ...eq('armadura'), pesoKg: 6, armadura: { tipo: 'ligera', caBase: 12 } }),
    obj(Y, 'Guantes de ladrón', 'gloves', 'r', 1, { ...eq('guantes'), ...mods({ objetivo: 'hab:juegoDeManos', valor: 2 }) }),
    obj(Y, 'Botas de zancada', 'boots', 'r', 1, { ...eq('botas'), ...sint, ...mods({ objetivo: 'vel:caminar', valor: 9, fijar: true }), efectos: 'Tu velocidad a pie es al menos 9 m.' }),
    obj(Y, 'Anillo del ratón', 'ring', 'u', 1, eq('anillo')),
    obj(Y, 'Estoque de Rivenhold', 'dagger', 'r', 1, { ...eq('cuerpoACuerpo'), tipoArma: 'marcial', pesoKg: 1, dado: '1d8', tipoDano: 'perforante', bonoMagico: 1, propiedades: ['sutil'] }),
    obj(Y, 'Daga', 'dagger', 'u', 1, { ...eq('cuerpoACuerpo', 1), tipoArma: 'sencilla', dado: '1d4', tipoDano: 'perforante', propiedades: ['sutil', 'ligera', 'arrojadiza'], rango: '6/18 m' }),
    obj(Y, 'Arco corto de tejo', 'bow', 'u', 1, { ...eq('distancia'), tipoArma: 'sencilla', dado: '1d6', tipoDano: 'perforante', propiedades: ['municion', 'dosManos'], rango: '24/96 m' }),
    obj(Y, 'Herramientas de ladrón', 'key', 'u', 1, { categoria: 'Varios', pesoKg: 0.5, valorPo: 25 }),
    obj(Y, 'Flechas', 'dagger', 'c', 26, municion),
    obj(Y, 'Cofre de hierro cerrado', 'bag', 'c', 1, { pesoKg: 14, valorPo: 5, descripcion: 'Pesado. Nadie ha conseguido abrirlo todavía.' }),
    obj(Y, 'Candelabro de plata', 'torch', 'c', 2, { pesoKg: 1.5, valorPo: 25 }),
    obj(Y, 'Poción de invisibilidad', 'potion', 'r', 1, { valorPo: 500, efectos: 'Invisible durante 1 hora o hasta atacar o lanzar un conjuro.', alUsar: { nombre: 'Invisible', duracion: { tipo: 'tiempo', segundos: 3600 }, modificadores: [{ objetivo: 'ventaja', texto: 'tiradas de ataque' }, { objetivo: 'nota', texto: 'Los ataques contra ti tienen desventaja' }] } }),
    obj(Y, 'Veneno básico', 'drop', 'u', 3, { valorPo: 100 }),
    obj(Y, 'Cuerda de seda', 'bag', 'c', 1, { pesoKg: 2.5, valorPo: 10 }),
    obj(Y, 'Daga arrojadiza', 'dagger', 'c', 4, { ranuraEquipo: 'distancia', tipoArma: 'sencilla', dado: '1d4', tipoDano: 'perforante', propiedades: ['sutil', 'arrojadiza'], rango: '6/18 m' }),
    obj(Y, 'Collar de perlas', 'amulet', 'u', 1, { valorPo: 250 }),
    obj(Y, 'Copa de oro', 'flask', 'u', 1, { valorPo: 75 }),
    obj(Y, 'Mapa de las alcantarillas', 'scroll', 'c', 1, { categoria: 'Llaves/misión' }),
    obj(Y, 'Lingote de plata', 'ore', 'u', 3, { pesoKg: 2, valorPo: 50, subtipo: 'mineral' }),
    obj(Y, 'Ganzúas de mithral', 'key', 'r', 1),
    obj(Y, 'Esfera de Ébano', 'gem', 'a', 1, { ...reqSint, valorPo: 50000, descripcion: 'Absorbe la luz a su alrededor. Susurra de noche.', ...mods({ objetivo: 'sentido:oscuridad', valor: 36, fijar: true }, { objetivo: 'car:car', valor: 2 }, { objetivo: 'vulnerabilidad', texto: 'radiante' }) }),
    obj(Y, 'Saco de canicas', 'bag', 'c', 1, { pesoKg: 1 }),
    obj(Y, 'Piedra de afilar', 'ore', 'c', 1, { categoria: 'Varios' }),
    obj(Y, 'Estatuilla de jade', 'gem', 'r', 1, { pesoKg: 1, valorPo: 750 }),
    obj(Y, 'Peine de marfil', 'fang', 'c', 1, { categoria: 'Varios', valorPo: 25 }),

    // Alijo
    { ...o5, tipo: 'material' },
    { ...o2, tipo: 'equipable', ...mods({ objetivo: 'car:sab', valor: 2 }, { objetivo: 'vel:nadar', valor: 9, fijar: true }, { objetivo: 'resistencia', texto: 'frío' }, { objetivo: 'nota', texto: 'Respiras bajo el agua' }) },
    { ...o4, tipo: 'comida', saciedad: 2 },
    obj(alijo, 'Poción de curación', 'potion', 'c', 6, { efectos: 'Recuperas 2d4+2 PV.' }),
    obj(alijo, 'Poción de curación superior', 'potion', 'r', 2, { valorPo: 450, efectos: 'Recuperas 8d4+8 PV.' }),
    obj(alijo, 'Espada larga', 'sword', 'c', 2, { tipoArma: 'marcial', dado: '1d8', dadoVersatil: '1d10', tipoDano: 'cortante', propiedades: ['versatil'] }),
    obj(alijo, 'Arco largo', 'bow', 'c', 1, { tipoArma: 'marcial', valorPo: 50, dado: '1d8', tipoDano: 'perforante', propiedades: ['municion', 'pesada', 'dosManos'], rango: '45/180 m' }),
    obj(alijo, 'Hacha de batalla', 'axe', 'u', 1, { tipoArma: 'marcial', pesoKg: 2, dado: '1d8', dadoVersatil: '1d10', tipoDano: 'cortante', propiedades: ['versatil'] }),
    obj(alijo, 'Cota de escamas', 'armor', 'c', 1, { pesoKg: 20, armadura: { tipo: 'media', caBase: 14, sigiloDesventaja: true } }),
    obj(alijo, 'Escudo', 'shield', 'c', 1, escudo),
    obj(alijo, 'Gema de fuego frío', 'gem', 'r', 1, { valorPo: 800 }),
    obj(alijo, 'Pergamino de Contraconjuro', 'scroll', 'r', 1, { valorPo: 300 }),
    obj(alijo, 'Tomo de los Siete Sellos', 'book', 'a', 1, { ...reqSint, valorPo: 40000 }),
    obj(alijo, 'Raíz de mandrágora', 'herb', 'u', 4, { subtipo: 'hierba' }),
    obj(alijo, 'Sal de plata', 'drop', 'c', 5, { categoria: 'Materiales', subtipo: 'reactivo', pesoKg: 0.1 }),
    obj(alijo, 'Escama de dragón verde', 'fang', 'm', 2, { subtipo: 'parte de criatura', valorPo: 500 }),
    obj(alijo, 'Mineral de hierro', 'ore', 'c', 8, { subtipo: 'mineral' }),
    obj(alijo, 'Queso curado', 'bread', 'c', 2, { ...comida('ingrediente', 1), pesoKg: 0.5 }),
    obj(alijo, 'Manzanas', 'apple', 'c', 7, comida('ingrediente', 1)),
    obj(alijo, 'Vino de Sembia', 'flask', 'u', 2, { ...comida('bebida', 1), valorPo: 10 }),
    obj(alijo, 'Estofado de jabalí', 'meat', 'u', 4, { ...comida('plato', 4), pesoKg: 0.8, valorPo: 2, efectos: '+1d4 PV temporales.' }),
    obj(alijo, 'Pastel de setas', 'bread', 'c', 2, { ...comida('plato', 3), pesoKg: 0.6, valorPo: 1 }),
    obj(alijo, 'Antorchas', 'torch', 'c', 10),
    obj(alijo, 'Saco de dormir', 'bag', 'c', 2, { pesoKg: 3 }),
    obj(alijo, 'Capa de lana', 'cloak', 'c', 1),
    obj(alijo, 'Guantes de cetrería', 'gloves', 'c', 1),
    obj(alijo, 'Botas de montar', 'boots', 'c', 1),
    obj(alijo, 'Anillo de sello', 'ring', 'u', 1),
    obj(alijo, 'Llave de la cripta', 'key', 'u', 1),
    obj(alijo, 'Cálices ceremoniales', 'flask', 'c', 3, { valorPo: 10 }),
    obj(alijo, 'Seta brillante', 'mushroom', 'c', 6, { subtipo: 'hierba' }),
    obj(alijo, 'Varita de proyectil mágico', 'staff', 'r', 1, { ...reqSint, tipo: 'varios', categoria: 'Varios', ranuraEquipo: null, pesoKg: 0.5, valorPo: 1500, cargas: 7, cargasMax: 7, recarga: '1d6+1 al amanecer' }),
    obj(alijo, 'Daga de plata', 'dagger', 'u', 1, { tipoArma: 'sencilla', valorPo: 102, dado: '1d4', tipoDano: 'perforante', propiedades: ['sutil', 'ligera', 'arrojadiza', 'plateada'], rango: '6/18 m' }),
    obj(alijo, 'Amuleto roto', 'amulet', 'c', 1, { ranuraEquipo: null, valorPo: 1 }),
    obj(alijo, 'Polvo de hueso', 'drop', 'c', 3, { categoria: 'Materiales', subtipo: 'reactivo', pesoKg: 0.1 }),
    obj(alijo, 'Garra de mantícora', 'fang', 'r', 2, { subtipo: 'parte de criatura', valorPo: 150 }),
    obj(alijo, 'Pergamino de Detectar magia', 'scroll', 'c', 2),
    obj(alijo, 'Carne de jabalí cruda', 'meat', 'c', 3, { ...comida('ingrediente', 0), efectos: 'Hay que cocinarla.' }),
    obj(alijo, 'Martillo ligero', 'hammer', 'c', 2, { tipoArma: 'sencilla', pesoKg: 1, dado: '1d4', tipoDano: 'contundente', propiedades: ['ligera', 'arrojadiza'], rango: '6/18 m' }),
    obj(alijo, 'Flechas', 'dagger', 'c', 40, municion),
    obj(alijo, 'Diario del cartógrafo', 'book', 'c', 1, { categoria: 'Llaves/misión' }),
    obj(alijo, 'Esmeralda en bruto', 'gem', 'u', 2, { valorPo: 250 }),
    obj(alijo, 'Aceite de lámpara', 'drop', 'c', 4, { pesoKg: 0.5 }),
  ];
}

// Rasgos de Aldric: los del diseño (Individual.dc.html). Los demás, rasgos de clase de nivel 5.
const EXTRA: Record<string, Partial<Personaje>> = {
  aldric: {
    condiciones: ['Bendecido · 8 turnos', 'Agotamiento 1'],
    resistencias: [],
    caExtra: 1,
    competencias: { habilidades: ['atletismo', 'intimidacion', 'perspicacia', 'persuasion'] },
    rasgos: [
      { nombre: 'Imposición de manos', usos: 25, usosMax: 25, recarga: 'Descanso largo', icono: 'corazon' },
      { nombre: 'Castigo divino', detalle: 'Espacios 4 · 2', icono: 'rayo' },
      { nombre: 'Sentido divino', usos: 3, usosMax: 4, recarga: 'Descanso largo', icono: 'ojo' },
      { nombre: 'Ataque adicional', detalle: 'Pasivo', icono: 'espada' },
      { nombre: 'Estilo de combate: Defensa', detalle: '+1 CA', icono: 'escudo' },
      { nombre: 'Juramento de devoción', usos: 1, usosMax: 1, recarga: 'Descanso corto', detalle: 'Canalizar', icono: 'estrella' },
    ],
  },
  nerys: {
    trasfondo: 'Sabia', px: 7200,
    competencias: { habilidades: ['arcanos', 'historia', 'investigacion', 'perspicacia'] },
    rasgos: [
      { nombre: 'Recuperación arcana', usos: 1, usosMax: 1, recarga: 'Descanso largo', icono: 'libro' },
      { nombre: 'Espacios de conjuro', detalle: '4 · 3 · 2', icono: 'estrella' },
      { nombre: 'Escultor de conjuros', detalle: 'Evocación', icono: 'rayo' },
      { nombre: 'Trance élfico', detalle: 'Pasivo', icono: 'ojo' },
    ],
  },
  brom: {
    trasfondo: 'Acólito', px: 6900,
    competencias: { habilidades: ['historia', 'medicina', 'perspicacia', 'religion'] },
    rasgos: [
      { nombre: 'Canalizar divinidad', usos: 1, usosMax: 1, recarga: 'Descanso corto', icono: 'estrella' },
      { nombre: 'Destruir muertos vivientes', detalle: 'VD ½', icono: 'rayo' },
      { nombre: 'Discípulo de la vida', detalle: '+2 + nivel', icono: 'corazon' },
      { nombre: 'Resiliencia enana', detalle: 'Veneno', icono: 'escudo' },
    ],
  },
  ysolde: {
    trasfondo: 'Criminal', px: 8100,
    competencias: {
      habilidades: ['acrobacias', 'engano', 'investigacion', 'juegoDeManos', 'percepcion', 'sigilo'],
      pericia: ['sigilo', 'percepcion'],
    },
    condiciones: ['Envenenado'],
    rasgos: [
      { nombre: 'Ataque furtivo', detalle: '3d6', icono: 'espada' },
      { nombre: 'Acción astuta', detalle: 'Pasivo', icono: 'mano' },
      { nombre: 'Esquiva asombrosa', detalle: 'Reacción', icono: 'escudo' },
      { nombre: 'Afortunada', detalle: 'Repite los 1', icono: 'estrella' },
    ],
  },
};

/** Versión del modelo; al subirla, el almacén migra lo guardado (src/domain/objetos.ts). */
export const VERSION = 4;

export function estadoInicial(): Estado {
  n = 0;
  return {
    version: VERSION,
    party: ejemplo.party,
    personajes: ejemplo.personajes.map(({ ca: _ca, ...p }) => ({ ...p, saciedad: saciedadDesde100(p.saciedad), ...EXTRA[p.id] })) as Personaje[],
    objetos: objetos(),
    movimientos: [],
  };
}
