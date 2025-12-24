// Utilidades para procesamiento de texto

/**
 * Escapa caracteres especiales de RegExp
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normaliza texto para búsqueda:
 * - Remueve diacríticos
 * - Convierte a mayúsculas
 * - Colapsa espacios
 */
export function normalizeForSearch(s) {
    if (!s) return "";
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Formatea una fecha del formato YYYY-MM-DD
 */
export function formatearFecha(fecha) {
    const m = fecha.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return fecha;
}

/**
 * Formatea una fecha al formato compacto MM/DD
 */
export function formatearFechaCompacta(fecha) {
    const m = fecha.match(/(\d{4})-?(\d{2})-?(\d{2})/);
    if (m) return `${m[2]}/${m[3]}`;
    return fecha;
}

/**
 * Extrae el número que aparece inmediatamente después de un texto
 * Ejemplo: "atención domiciliaria por enfermería 8" => 8
 */
export function extraerNumeroDelTexto(texto, buscar) {
    const textoNorm = normalizeForSearch(texto);
    const buscarNorm = normalizeForSearch(buscar);

    // Buscar el texto y capturar el número que le sigue
    const regex = new RegExp(escapeRegExp(buscarNorm) + "\\s*(\\d+)", "i");
    const match = textoNorm.match(regex);

    return match ? parseInt(match[1]) : null;
}
