import { REGEX_FECHA } from "../reglas.js";
import { normalizeForSearch } from "./textUtils.js";

let tesseractWorkerPromise = null;

/**
 * Obtiene o inicializa el worker de Tesseract reutilizable
 */
async function obtenerWorkerTesseract() {
    if (typeof window === "undefined" || !window.Tesseract) {
        return null;
    }
    if (!tesseractWorkerPromise) {
        tesseractWorkerPromise = (async () => {
            try {
                const worker = await window.Tesseract.createWorker();
                await worker.loadLanguage("spa");
                await worker.initialize("spa");
                return worker;
            } catch (err) {
                console.warn("[OCR] Error inicializando worker Tesseract:", err);
                tesseractWorkerPromise = null;
                return null;
            }
        })();
    }
    return tesseractWorkerPromise;
}

/**
 * Ejecuta OCR sobre una página de PDF.js renderizándola a un canvas
 */
export async function extraerTextoOCRPagina(page) {
    if (typeof window === "undefined" || !window.Tesseract) {
        return "";
    }
    try {
        const viewport = page.getViewport({ scale: 1.5 }); // Escala 1.5 para óptima nitidez de OCR en números pequeños
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: ctx,
            viewport: viewport,
        }).promise;

        const worker = await obtenerWorkerTesseract();
        let ocrText = "";
        if (worker) {
            const ret = await worker.recognize(canvas);
            ocrText = ret?.data?.text || "";
        } else {
            const result = await window.Tesseract.recognize(canvas, "spa");
            ocrText = result?.data?.text || "";
        }

        canvas.width = 0;
        canvas.height = 0;

        return ocrText;
    } catch (e) {
        console.warn("[OCR] Error en página:", e);
        return "";
    }
}

/**
 * Ejecuta OCR sobre las páginas de un documento PDF.
 * Para optimizar velocidad, procesa las primeras páginas (máximo maxPages)
 * o se detiene si el texto acumulado ya satisface un criterio de búsqueda.
 */
export async function extraerTextoOCRDePDF(pdf, maxPages = 3, terminoEsperado = "") {
    let textoOCR = "";
    const total = Math.min(pdf.numPages, maxPages);
    const esperadoNorm = terminoEsperado ? normalizeForSearch(terminoEsperado) : "";

    for (let i = 1; i <= total; i++) {
        const page = await pdf.getPage(i);
        try {
            const textoPagina = await extraerTextoOCRPagina(page);
            textoOCR += textoPagina + " ";

            // Si ya encontramos lo que buscamos, terminar inmediatamente
            if (esperadoNorm && normalizeForSearch(textoOCR).includes(esperadoNorm)) {
                break;
            }
        } finally {
            if (page && page.cleanup) {
                page.cleanup();
            }
        }
    }
    return textoOCR;
}

/**
 * Extrae el texto digital de un PDF página por página.
 * NO ejecuta OCR general automático para no ralentizar el procesamiento masivo.
 */
export async function extraerTextoPDF(pdf) {
    let texto = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        try {
            const content = await page.getTextContent();
            const textoPag = content.items.map((t) => t.str).join(" ").trim();
            texto += textoPag + " ";
        } finally {
            if (page && page.cleanup) {
                page.cleanup();
            }
        }
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
