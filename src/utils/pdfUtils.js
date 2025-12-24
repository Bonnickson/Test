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
 * Lee un archivo y lo convierte en ArrayBuffer
 */
export async function leerArchivoComoBuffer(file) {
    return await file.arrayBuffer();
}
