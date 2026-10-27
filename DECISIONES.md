# Decisiones del proyecto

Respuestas a las decisiones abiertas del §8 de `HANDOFF.md`.

| # | Decisión | Respuesta |
|---|---|---|
| 1 | Stack | React + Vite (frontend) y Supabase (Postgres, almacenamiento de imágenes y tiempo real). Despliegue estático en Vercel o Netlify. Se reutiliza el CSS del bloque `<helmet><style>` de los `.dc.html`. |
| 2 | Autenticación y permisos | Sin cuentas. Cualquiera con el enlace o código de la party puede hacerlo todo. El historial de movimientos guarda el nombre que el jugador elige al entrar. |
| 3 | Datos e imágenes | Base de datos Postgres de Supabase; imágenes de personajes y objetos en Supabase Storage. |
| 4 | Reglas caseras | Se aplican tal cual: hambre de 0 a 100 (−25 por día de viaje), carga en kg (máximo ≈ FUE × 6,8 kg, con los tramos de 5e) y monedas que pesan (50 monedas = 0,45 kg). |
| 5 | Catálogo de objetos | Siempre a mano, con el formulario libre del diseño. Sin catálogo SRD. |
| 6 | Móvil | Sin preguntar todavía; por defecto, solo escritorio, como el diseño. |
