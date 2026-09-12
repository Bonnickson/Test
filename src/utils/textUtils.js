// Utilidades para procesamiento de texto

/**
 * Escapa caracteres especiales de RegExp
 */
export function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normaliza texto para búsqueda:
 * - Remueve diacríticos / tildes
 * - Reemplaza toda variedad de guiones (en-dash –, em-dash —, minus −, hyphen -) y signos por espacios
 * - Convierte a mayúsculas
 * - Colapsa múltiples espacios
 */
export function normalizeForSearch(s) {
    if (!s) return "";
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\-_:.,;–—]/g, " ")
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

/**
 * Reemplaza menciones de archivos PDF (ej: 5 enf.pdf, 2 vm.pdf, 4.pdf)
 * por una versión visual estilizada con icono en vez de la extensión .pdf
 */
export function formatearErrorConIconosPDF(texto) {
    if (!texto) return "";
    return texto.replace(
        /\b([1-5](?:\s+[a-zA-Z0-9]+)?)\.pdf\b/gi,
        (match, nombreBase) => {
            return `<span class="pdf-file-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pdf-file-badge-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${nombreBase}</span>`;
        }
    );
}
