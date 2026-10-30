// Mesa de dados en 3D: three.js para pintar y cannon-es para la física. Se carga aparte (import dinámico)
// para que la app no pese más hasta la primera tirada.
//
// Cada lanzamiento se simula entero antes de enseñarlo: se ve qué cara queda arriba en cada dado y se
// cambian sus números para que esa cara muestre el valor que ya había salido (dados.ts). Luego se
// reproduce la simulación grabada. Los números se intercambian por parejas de caras opuestas, así que
// las caras opuestas siguen sumando lo mismo que en un dado de verdad.

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { EstiloDados, TipoDado } from '../domain/dados';

type V3 = [number, number, number];

/** Un dado físico: el d100 son dos d10, uno de decenas y otro de unidades. */
type Forma = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'decenas';

const FI = (1 + Math.sqrt(5)) / 2;

/** Vértices de cada dado; las caras se sacan solas (envolvente convexa). */
function verticesDe(f: Forma): V3[] {
  switch (f) {
    case 'd4': return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    case 'd6': return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z])));
    case 'd8': return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    case 'd12': return [
      ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z): V3 => [x, y, z]))),
      ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a / FI, b * FI], [a / FI, b * FI, 0], [b * FI, 0, a / FI]])),
    ];
    case 'd20': return [-1, 1].flatMap((a) => [-1, 1].flatMap((b): V3[] => [[0, a, b * FI], [a, b * FI, 0], [b * FI, 0, a]]));
    default: {
      // Trapezoedro pentagonal: dos polos y un anillo en zigzag a la altura justa para que las caras sean planas
      const c = Math.cos(Math.PI / 5), z = (1 - c) / (1 + c);
      const anillo = Array.from({ length: 10 }, (_, i): V3 => [Math.cos((i * Math.PI) / 5), Math.sin((i * Math.PI) / 5), i % 2 ? z : -z]);
      return [...anillo, [0, 0, 1], [0, 0, -1]];
    }
  }
}

/** Tamaño de cada dado (radio de la esfera que lo envuelve), a ojo para que parezcan de la misma bolsa. */
const RADIO: Record<Forma, number> = { d4: 1.25, d6: 1.05, d8: 1.15, d10: 1.15, decenas: 1.15, d12: 1.2, d20: 1.25 };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** Caras de un poliedro convexo, con los vértices en sentido antihorario vistos desde fuera. */
function carasDe(v: V3[]) {
  const caras: { ind: number[]; n: V3 }[] = [];
  const vistas = new Set<string>();
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) {
    let n = cross(sub(v[j], v[i]), sub(v[k], v[i]));
    if (Math.hypot(...n) < 1e-6) continue;
    n = norma(n);
    const d = dot(n, v[i]);
    let delante = 0, detras = 0;
    const en: number[] = [];
    v.forEach((p, m) => { const s = dot(n, p) - d; if (s > 1e-4) delante++; else if (s < -1e-4) detras++; else en.push(m); });
    if (delante && detras) continue;
    if (delante) n = [-n[0], -n[1], -n[2]];
    const clave = en.join();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const c = en.reduce<V3>((s, m) => [s[0] + v[m][0] / en.length, s[1] + v[m][1] / en.length, s[2] + v[m][2] / en.length], [0, 0, 0]);
    const u = norma(sub(v[en[0]], c)), w = cross(n, u);
    const ang = (m: number) => { const p = sub(v[m], c); return Math.atan2(dot(p, w), dot(p, u)); };
    caras.push({ ind: [...en].sort((a, b) => ang(a) - ang(b)), n });
  }
  return caras;
}

/** Número de cada cara (o de cada vértice en el d4). Las caras opuestas suman caras + 1 (o 9 en los d10). */
function numerosIniciales(f: Forma, caras: { n: V3 }[]): number[] {
  if (f === 'd4') return [1, 2, 3, 4];
  const n = caras.length, base = f === 'd10' || f === 'decenas' ? 0 : 1;
  const nums = new Array<number>(n).fill(-1);
  let siguiente = base;
  caras.forEach((c, i) => {
    if (nums[i] >= 0) return;
    let op = -1, peor = 2;
    caras.forEach((o, j) => { if (j !== i && nums[j] < 0) { const d = dot(c.n, o.n); if (d < peor) { peor = d; op = j; } } });
    nums[i] = siguiente;
    nums[op] = n - 1 + 2 * base - siguiente;
    siguiente++;
  });
  return nums;
}

/** Texto de un número en su cara: el d10 de decenas del d100 lleva 00–90. */
function rotulo(f: Forma, n: number) {
  if (f === 'decenas') return n === 0 ? '00' : String(n * 10);
  return String(n);
}

interface Plantilla {
  forma: Forma;
  geometria: THREE.BufferGeometry;
  cuerpo: CANNON.ConvexPolyhedron;
  /** Normal de cada cara en el dado sin girar. */
  normales: THREE.Vector3[];
  /** Vértices escalados (para el d4, que se lee por el vértice de arriba). */
  vertices: THREE.Vector3[];
  /** Vértices de cada cara y dónde caen en su textura (0–1). */
  caras: { ind: number[]; esquinas: [number, number][] }[];
  numeros: number[];
}

const plantillas = new Map<Forma, Plantilla>();

function plantilla(f: Forma): Plantilla {
  const hecha = plantillas.get(f);
  if (hecha) return hecha;
  const r = RADIO[f];
  // Mismo factor para todos los vértices: proyectarlos a la esfera torcería las caras del d10
  const crudos = verticesDe(f), k = r / Math.max(...crudos.map((p) => Math.hypot(...p)));
  const v = crudos.map((p) => [p[0] * k, p[1] * k, p[2] * k] as V3);
  const caras = carasDe(v);
  const pos: number[] = [], uv: number[] = [];
  const geometria = new THREE.BufferGeometry();
  const dibujo: Plantilla['caras'] = [];
  caras.forEach((cara, i) => {
    // Centro de área del polígono y ejes de su plano: «arriba» apunta al vértice más lejano (el polo en el d10)
    const pts = cara.ind.map((m) => v[m]);
    let area = 0, c: V3 = [0, 0, 0];
    for (let t = 1; t < pts.length - 1; t++) {
      const a = Math.hypot(...cross(sub(pts[t], pts[0]), sub(pts[t + 1], pts[0]))) / 2;
      area += a;
      for (let e = 0; e < 3; e++) c[e] += a * (pts[0][e] + pts[t][e] + pts[t + 1][e]) / 3;
    }
    c = [c[0] / area, c[1] / area, c[2] / area];
    // En el d6 el número va derecho respecto a un lado, no a una esquina
    const lejos = f === 'd6' ? pts[0].map((x, e) => (x + pts[1][e]) / 2) as V3
      : pts.reduce((a, b) => (Math.hypot(...sub(b, c)) > Math.hypot(...sub(a, c)) ? b : a));
    const arriba = norma(sub(lejos, c)), derecha = cross(arriba, cara.n);
    const radio = Math.max(...pts.map((p) => Math.hypot(...sub(p, c))));
    const aUv = (p: V3): [number, number] => [0.5 + dot(sub(p, c), derecha) / radio * 0.5, 0.5 + dot(sub(p, c), arriba) / radio * 0.5];
    const esquinas = pts.map(aUv);
    dibujo.push({ ind: cara.ind, esquinas });
    const inicio = pos.length / 3;
    for (let t = 1; t < pts.length - 1; t++) {
      for (const k of [0, t, t + 1]) { pos.push(...pts[k]); uv.push(...esquinas[k]); }
    }
    geometria.addGroup(inicio, (pts.length - 2) * 3, i);
  });
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometria.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometria.computeVertexNormals();
  const cuerpo = new CANNON.ConvexPolyhedron({
    vertices: v.map((p) => new CANNON.Vec3(...p)),
    faces: caras.map((cr) => cr.ind),
  });
  const p: Plantilla = {
    forma: f, geometria, cuerpo, caras: dibujo,
    normales: caras.map((cr) => new THREE.Vector3(...cr.n)),
    vertices: v.map((p) => new THREE.Vector3(...p)),
    numeros: numerosIniciales(f, caras),
  };
  plantillas.set(f, p);
  return p;
}

// ── Texturas ───────────────────────────────────────────────────────

const LADO = 256;
const texturas = new Map<string, THREE.CanvasTexture>();

function mezclar(hex: string, otro: string, k: number) {
  const a = new THREE.Color(hex), b = new THREE.Color(otro);
  return `#${a.lerp(b, k).getHexString()}`;
}

/** Dibuja una cara: fondo del color del dado, un filo más oscuro y el número (o los tres números del d4). */
function textura(p: Plantilla, cara: number, numeros: number[], estilo: EstiloDados) {
  const textos = p.forma === 'd4'
    ? p.caras[cara].ind.map((m) => String(numeros[m]))
    : [rotulo(p.forma, numeros[cara])];
  const clave = `${estilo.color}${estilo.tinta}|${p.forma}|${cara}|${textos.join(',')}`;
  const hecha = texturas.get(clave);
  if (hecha) return hecha;
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = LADO;
  const g = lienzo.getContext('2d')!;
  g.fillStyle = estilo.color;
  g.fillRect(0, 0, LADO, LADO);
  const esquinas = p.caras[cara].esquinas.map(([u, v]) => [u * LADO, (1 - v) * LADO] as const);
  // Filo: un degradado hacia el borde de la cara da sensación de canto redondeado
  g.save();
  g.beginPath();
  esquinas.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.lineJoin = 'round';
  g.strokeStyle = mezclar(estilo.color, '#000000', 0.45);
  g.lineWidth = 14;
  g.stroke();
  g.strokeStyle = mezclar(estilo.color, '#ffffff', 0.18);
  g.lineWidth = 4;
  g.stroke();
  g.restore();
  g.fillStyle = estilo.tinta;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.45)';
  g.shadowBlur = 4;
  const fuente = (px: number) => `700 ${px}px Cinzel, Georgia, serif`;
  if (p.forma === 'd4') {
    // Un número junto a cada vértice, con la cabeza hacia él
    const cx = LADO / 2, cy = LADO / 2;
    g.font = fuente(52);
    esquinas.forEach(([x, y], i) => {
      g.save();
      g.translate(cx + (x - cx) * 0.55, cy + (y - cy) * 0.55);
      g.rotate(Math.atan2(y - cy, x - cx) + Math.PI / 2);
      g.fillText(textos[i], 0, 0);
      g.restore();
    });
  } else {
    const t = textos[0];
    const tam = { d6: 118, d8: 92, d10: 86, decenas: 70, d12: 92, d20: 72 }[p.forma] * (t.length > 1 ? 0.86 : 1);
    g.font = fuente(tam);
    g.fillText(t, LADO / 2, LADO / 2);
    if ((t === '6' || t === '9') && p.forma !== 'd6') {
      g.fillRect(LADO / 2 - tam * 0.22, LADO / 2 + tam * 0.42, tam * 0.44, tam * 0.07);
    }
  }
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texturas.set(clave, tex);
  return tex;
}

const materiales = new Map<string, THREE.Material>();

function material(tex: THREE.Texture, estilo: EstiloDados) {
  const clave = `${tex.uuid}|${estilo.acabado}`;
  const hecho = materiales.get(clave);
  if (hecho) return hecho;
  const m = estilo.acabado === 'mate' ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 })
    : estilo.acabado === 'metal' ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.85 })
    : estilo.acabado === 'nacar' ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 0.7, iridescence: 1, iridescenceIOR: 1.35, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') })
    : new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 });
  materiales.set(clave, m);
  return m;
}

// ── Simulación ─────────────────────────────────────────────────────

const PASO = 1 / 60;
const MAX_PASOS = 60 * 7;
const GRAVEDAD = -9.82 * 5;

export interface DadoLanzado {
  tipo: TipoDado;
  valor: number;
}

/** Dónde ha quedado cada dado al parar, en píxeles del contenedor, con su valor y su tipo. */
export interface Reposo {
  x: number;
  y: number;
  /** Índice en la tirada (los dos dados de un d100 comparten índice). */
  indice: number;
  principal: boolean;
}

interface Pieza {
  forma: Forma;
  /** Número que tiene que quedar arriba. */
  arriba: number;
  indice: number;
  principal: boolean;
}

/** Del valor de la tirada a los dados físicos: el d100 se parte en decenas y unidades, el 10 del d10 es el 0. */
function piezas(dados: DadoLanzado[]): Pieza[] {
  return dados.flatMap((d, indice): Pieza[] => {
    if (d.tipo === 'd100') {
      const v = d.valor % 100;
      return [
        { forma: 'decenas', arriba: Math.floor(v / 10), indice, principal: true },
        { forma: 'd10', arriba: v % 10, indice, principal: false },
      ];
    }
    return [{ forma: d.tipo, arriba: d.tipo === 'd10' ? d.valor % 10 : d.valor, indice, principal: true }];
  });
}

/** Cara (o vértice del d4) que ha quedado arriba con este giro. */
function deArriba(p: Plantilla, q: THREE.Quaternion) {
  const lista = p.forma === 'd4' ? p.vertices : p.normales;
  let mejor = 0, alto = -Infinity;
  lista.forEach((x, i) => { const y = x.clone().applyQuaternion(q).y; if (y > alto) { alto = y; mejor = i; } });
  return mejor;
}

/** Cambia los números para que la cara de arriba muestre `valor`, intercambiando también sus opuestas. */
function forzar(p: Plantilla, numeros: number[], cara: number, valor: number) {
  const r = [...numeros];
  const actual = r[cara];
  if (actual === valor) return r;
  const suma = p.forma === 'd4' ? 0 : p.forma === 'd10' || p.forma === 'decenas' ? 9 : p.normales.length + 1;
  const cambio = (a: number, b: number) => r.forEach((n, i) => { r[i] = n === a ? b : n === b ? a : n; });
  cambio(actual, valor);
  if (suma && suma - actual !== valor) cambio(suma - actual, suma - valor);
  return r;
}

// ── Mesa ───────────────────────────────────────────────────────────

export class Mesa {
  private renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.PerspectiveCamera(30, 1, 1, 200);
  private luz: THREE.DirectionalLight;
  private dados: THREE.Mesh[] = [];
  private animacion = 0;
  private ancho = 1;
  private alto = 1;

  /** `campo`: medio alto de la mesa que se ve, en unidades (un dado mide unas 2). */
  constructor(private contenedor: HTMLElement, private campo = 11) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // respeta el color elegido mejor que ACES
    this.renderer.setClearColor(0x000000, 0);
    contenedor.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.escena.environmentIntensity = 0.45;
    pmrem.dispose();
    this.escena.add(new THREE.HemisphereLight(0xfff1d6, 0x2a2018, 0.5));
    this.luz = new THREE.DirectionalLight(0xffe6b8, 1.7);
    this.luz.position.set(-10, 40, -14);
    this.luz.castShadow = true;
    this.luz.shadow.mapSize.set(2048, 2048);
    this.luz.shadow.radius = 4;
    this.luz.shadow.bias = -0.0005;
    this.escena.add(this.luz);
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.45 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.escena.add(suelo);
    this.medir();
  }

  /** Ajusta la cámara a la ventana: mirando desde arriba, la mesa ocupa la pantalla entera. */
  medir() {
    this.ancho = Math.max(1, this.contenedor.clientWidth);
    this.alto = Math.max(1, this.contenedor.clientHeight);
    this.renderer.setSize(this.ancho, this.alto, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camara.aspect = this.ancho / this.alto;
    // Con 11 unidades de medio alto, un dado mide ~1/10 del alto de la pantalla
    const h = this.campo / Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    this.camara.position.set(0, h, 0);
    this.camara.up.set(0, 0, -1);
    this.camara.lookAt(0, 0, 0);
    this.camara.updateProjectionMatrix();
    const s = this.luz.shadow.camera;
    s.left = -(this.campo + 1) * this.camara.aspect - 4; s.right = -s.left; s.top = this.campo + 5; s.bottom = -s.top;
    s.near = 1; s.far = 120;
    s.updateProjectionMatrix();
  }

  private limites() {
    const hz = this.campo, hx = hz * this.camara.aspect;
    return { hx: hx * 0.94, hz: hz * 0.92 };
  }

  limpiar() {
    cancelAnimationFrame(this.animacion);
    for (const d of this.dados) this.escena.remove(d);
    this.dados = [];
    this.renderer.render(this.escena, this.camara);
  }

  destruir() {
    this.limpiar();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Lanza los dados desde la esquina de abajo a la derecha; resuelve cuando todos han parado. */
  lanzar(dados: DadoLanzado[], estilo: EstiloDados): Promise<Reposo[]> {
    this.limpiar();
    this.medir();
    const lista = piezas(dados);
    const { hx, hz } = this.limites();

    const mundo = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVEDAD, 0) });
    mundo.allowSleep = true;
    const matDado = new CANNON.Material(), matMesa = new CANNON.Material(), matPared = new CANNON.Material();
    mundo.addContactMaterial(new CANNON.ContactMaterial(matDado, matMesa, { friction: 0.25, restitution: 0.45 }));
    mundo.addContactMaterial(new CANNON.ContactMaterial(matDado, matPared, { friction: 0, restitution: 0.7 }));
    mundo.addContactMaterial(new CANNON.ContactMaterial(matDado, matDado, { friction: 0.1, restitution: 0.4 }));
    const plano = (pos: CANNON.Vec3, eje: CANNON.Vec3, ang: number, m: CANNON.Material) => {
      const b = new CANNON.Body({ mass: 0, material: m, shape: new CANNON.Plane() });
      b.position.copy(pos);
      b.quaternion.setFromAxisAngle(eje, ang);
      mundo.addBody(b);
    };
    const X = new CANNON.Vec3(1, 0, 0), Y = new CANNON.Vec3(0, 1, 0);
    plano(new CANNON.Vec3(0, 0, 0), X, -Math.PI / 2, matMesa);
    plano(new CANNON.Vec3(-hx, 0, 0), Y, Math.PI / 2, matPared);
    plano(new CANNON.Vec3(hx, 0, 0), Y, -Math.PI / 2, matPared);
    plano(new CANNON.Vec3(0, 0, -hz), X, 0, matPared);
    plano(new CANNON.Vec3(0, 0, hz), X, Math.PI, matPared);
    plano(new CANNON.Vec3(0, 14, 0), X, Math.PI / 2, matPared); // techo, para que no salgan de la vista

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const cuerpos = lista.map((pz, i) => {
      const p = plantilla(pz.forma);
      const b = new CANNON.Body({ mass: 1, material: matDado, shape: p.cuerpo, sleepSpeedLimit: 0.15, sleepTimeLimit: 0.25 });
      b.linearDamping = 0.12;
      b.angularDamping = 0.12;
      // Salen en abanico desde la esquina del botón hacia el centro de la pantalla
      const fila = i % 4, col = Math.floor(i / 4);
      b.position.set(hx - 1.6 - col * 2.6 + rnd(-0.3, 0.3), 1.6 + fila * 2.6, hz - 1.6 - fila * 0.6 + rnd(-0.3, 0.3));
      b.quaternion.setFromEuler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3));
      // Apuntan a un sitio cerca del centro; con esa fuerza ruedan y rebotan sin acabar contra el borde de arriba
      const fuerza = rnd(17, 24);
      const ang = Math.atan2(rnd(-0.35, 0.25) * hz - b.position.z, rnd(-0.45, 0.15) * hx - b.position.x);
      b.velocity.set(Math.cos(ang) * fuerza, rnd(2, 7), Math.sin(ang) * fuerza);
      b.angularVelocity.set(rnd(-25, 25), rnd(-25, 25), rnd(-25, 25));
      mundo.addBody(b);
      return b;
    });

    // Se graba la simulación entera: posición y giro de cada dado en cada paso
    const grabacion: Float32Array[] = [];
    for (let paso = 0; paso < MAX_PASOS; paso++) {
      mundo.step(PASO);
      const f = new Float32Array(cuerpos.length * 7);
      cuerpos.forEach((b, i) => f.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], i * 7));
      grabacion.push(f);
      if (paso > 30 && cuerpos.every((b) => b.sleepState === CANNON.Body.SLEEPING)) break;
    }

    // Cada dado lleva los números cambiados para que salga lo que tiene que salir
    const final = grabacion[grabacion.length - 1];
    this.dados = lista.map((pz, i) => {
      const p = plantilla(pz.forma);
      const q = new THREE.Quaternion(final[i * 7 + 3], final[i * 7 + 4], final[i * 7 + 5], final[i * 7 + 6]);
      const numeros = forzar(p, p.numeros, deArriba(p, q), pz.arriba);
      const mats = p.normales.map((_, c) => material(textura(p, c, numeros, estilo), estilo));
      const m = new THREE.Mesh(p.geometria, mats);
      m.castShadow = true;
      this.escena.add(m);
      return m;
    });

    return new Promise((resolver) => {
      const inicio = performance.now();
      const dibujar = () => {
        const n = Math.min(grabacion.length - 1, Math.floor((performance.now() - inicio) / 1000 / PASO));
        const f = grabacion[n];
        this.dados.forEach((m, i) => {
          m.position.set(f[i * 7], f[i * 7 + 1], f[i * 7 + 2]);
          m.quaternion.set(f[i * 7 + 3], f[i * 7 + 4], f[i * 7 + 5], f[i * 7 + 6]);
        });
        this.renderer.render(this.escena, this.camara);
        if (n < grabacion.length - 1) { this.animacion = requestAnimationFrame(dibujar); return; }
        resolver(this.dados.map((m, i) => {
          const p = m.position.clone().add(new THREE.Vector3(0, RADIO[lista[i].forma], 0)).project(this.camara);
          return { x: (p.x + 1) / 2 * this.ancho, y: (1 - p.y) / 2 * this.alto, indice: lista[i].indice, principal: lista[i].principal };
        }));
      };
      this.animacion = requestAnimationFrame(dibujar);
    });
  }
}

/** Para las pruebas (mesa.test.ts). */
export const _pruebas = { plantilla, forzar, deArriba, piezas };
