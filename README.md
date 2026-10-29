# Cofre de la Compañía

Inventario compartido para una party de D&D 5e. El diseño y el modelo están en [HANDOFF.md](HANDOFF.md); las decisiones tomadas, en [DECISIONES.md](DECISIONES.md).

## Arrancar

Hace falta Node 20 o superior.

```bash
npm install
npm run dev
```

Se abre en http://localhost:5173. Otros comandos: `npm test` (reglas de negocio) y `npm run build`.

## Estado

Hecho:

- Sistema visual del diseño (`src/styles/sistema.css`) e iconos (`src/ui/iconos.ts`).
- Vista grupal: columnas de 3 a 5 personajes, equipo, CA, ataque y daño calculados, inventario, carga y alijo con filtros.
- Arrastrar y soltar entre personajes, alijo y ranuras de equipo, con validación de carga y de ranura. Mayús al soltar abre «Dividir pila».
- Tooltip de objeto, avisos de movimiento, búsqueda que atenúa lo que no coincide e imagen de personaje subida desde el botón de la cámara.
- Vista individual: ficha (características, PX, condiciones, resistencias y rasgos), equipo grande con indicador de sintonización e inventario con filtros por categoría y orden por rareza, peso, valor o reciente. Se elige el personaje en los retratos.
- Sintonizar: doble clic en un objeto que lo requiere (también en los rombos de sintonización para quitarla). Con 3 ya sintonizados pide cuál sustituir.
- Soltar un objeto sobre un retrato se lo da a ese personaje.

- Monedas (se abre pulsando el tesoro de la barra superior): tesoro común con ingresar y retirar (Mayús = de 10 en 10), cambio exacto de monedas, historial, monedas por personaje con ingresos y retiradas (desde o hacia el tesoro, o monedas nuevas/gastadas), repartir botín moneda a moneda o convertido a la moneda más alta, y carga de cada personaje y de la party. Un reparto que deje a alguien con sobrepeso se bloquea.

- Objetos con efecto real (`src/domain/hoja.ts`): características, CA, ataque y daño, salvaciones, habilidades, pasivas, iniciativa, velocidades, PV máximos, CD y ataque de conjuros, sentidos, carga, resistencias, inmunidades, ventajas y desventajas. Cada objeto lleva una lista de modificadores (sumar o «pasa a ser al menos», como el Amuleto de la salud) que se aplican mientras está equipado y, si lo pide, sintonizado. Pasando el ratón por un valor se ve de dónde sale.
- Armas con las propiedades de 5e programadas: sutil (mejor de FUE y DES), arrojadiza, munición (DES), versátil (dado mayor con la otra mano libre), a dos manos (libera la mano secundaria y no deja equipar nada en ella), ligera (ataque con la mano secundaria sin modificador al daño), pesada (desventaja si eres Pequeño), alcance, recarga, plateada y adamantina. Bonos mágicos, daño adicional y rango de crítico. Sin sintonizar, un arma que lo pide no suma su magia.
- Armaduras con CA base, tope de DES por tipo (la pesada no suma DES), FUE mínima (−3 m) y desventaja en Sigilo; escudos; defensa sin armadura de bárbaro y monje.
- Añadir objeto en dos pasos: primero el tipo (arma, armadura, escudo, prenda o accesorio, poción, pergamino, comida, material, munición, misión, varios) y después un formulario a medida, con plantillas de las armas y armaduras del manual y una vista previa de cómo cambia al personaje. Clic derecho en cualquier objeto para editarlo o eliminarlo.
- Despensa con el hambre de mazmorra (ver Supuestos), comer, paso del tiempo y descansos. La comida enseña su imagen.
- Estadísticas: tarjeta por personaje con los valores efectivos y desglose del elegido (salvaciones, habilidades, pasivas, defensas, movimiento y los objetos que influyen).

Pendiente: crafteo, añadir y editar personajes (sus competencias salen de la clase y de los datos de ejemplo), usar pociones y cargas desde la interfaz, y Supabase.

## Datos

De momento todo vive en el navegador (`localStorage`), empezando por los datos de ejemplo de `src/data/semilla.ts`, que amplían `datos-ejemplo.json` con los objetos del diseño. Para volver a empezar, borra los datos del sitio en el navegador.

Toda la lectura y escritura pasa por `src/store/cofre.tsx`, que es lo que habrá que cambiar para usar Supabase. Las reglas están en `src/domain/reglas.ts` como funciones puras.

## Supuestos

- Todos los personajes son competentes con sus armas y armaduras equipadas.
- Hambre de mazmorra [casera]: saciedad de 0 a 7. Baja 1 cada 30–90 min (botón «Pasa el tiempo», lo decide el DM), 1 con un descanso corto y 4 con uno largo, que solo se puede empezar con 4 o más. Efectos acumulados: con 3, desventaja en pruebas de característica (−5 a las pasivas); con 2, velocidad a la mitad; con 1, desventaja en ataques y salvaciones; con 0, PV máximos a la mitad. Cada comida dice cuántos puntos llena.
- Las salvaciones competentes y la característica de conjuros salen de la clase; las razas Pequeñas (mediana, gnomo) van a 7,5 m y las de visión en la oscuridad la tienen a 18 m.
- Las armas arrojadizas en la ranura «A distancia» usan FUE; las sutiles, la mejor de FUE y DES.
- Las dos ranuras «Cuerpo a cuerpo» son mano principal y secundaria (escudo).
