import { REGEX_FECHA } from "../reglas.js";

/**
 * Extrae el texto completo de un PDF
 */
export async function extraerTextoPDF(pdf) {
    let texto = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        texto += content.items.map((t) => t.str).join(" ") + " ";
    }
    return texto;
}

/**
 * Extrae todas las fechas de un texto usando REGEX_FECHA
 */
export function extraerFechas(texto) {
    const fechas = [];
    let match;
    REGEX_FECHA.lastIndex = 0;

    while ((match = REGEX_FECHA.exec(texto)) !== null) {
        fechas.push(match[1].replace(/\s+/g, "").trim());
    }

    return fechas;
}

/**
 * Valida que las fechas no estén duplicadas y estén en orden cronológico
 * @returns {Object} { duplicadas: string[], desordenadas: boolean, fechasOrdenadas: string[] }
 */
export function validarOrdenFechas(fechas) {
    const duplicadas = [];
    const fechasVistas = new Set();

    // Detectar duplicadas
    for (const fecha of fechas) {
        if (fechasVistas.has(fecha)) {
            if (!duplicadas.includes(fecha)) {
                duplicadas.push(fecha);
            }
        }
        fechasVistas.add(fecha);
    }

    // Verificar orden cronológico
    const fechasOrdenadas = [...fechas].sort();
    const desordenadas =
        JSON.stringify(fechas) !== JSON.stringify(fechasOrdenadas);

    return { duplicadas, desordenadas, fechasOrdenadas };
}

/**
 * Lee un archivo y lo convierte en ArrayBuffer
 */
export async function leerArchivoComoBuffer(file) {
    return await file.arrayBuffer();
}
