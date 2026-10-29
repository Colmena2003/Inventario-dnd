// Ajustes de la mesa.

/**
 * Party a la que entra quien abre la web sin código en el enlace: la de vuestra mesa. Así basta con pasar
 * el enlace de la web. Se puede cambiar con la variable VITE_PARTY. Sin la clave de Supabase (que no está
 * en el repositorio) el código no sirve para nada.
 */
export const PARTY_POR_DEFECTO = ((import.meta.env.VITE_PARTY as string | undefined) ?? '253UKZ').trim().toUpperCase();
