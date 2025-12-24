import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { ALLOWED_TYPES, PDF_WORKER_URL } from "./config/constants.js";
import { validarPDF } from "./validators/eventoValidator.js";
import { validarPorPaquete } from "./validators/paqueteValidator.js";
import {
    actualizarHeadersTabla,
    createPlaceholderRow,
    updateRow,
} from "./ui/tableRenderer.js";

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

// Elementos del DOM
const input = document.getElementById("inputFolder");
const estado = document.getElementById("estado");
const tabla = document.getElementById("tabla");
const tablaBody = document.querySelector("#tabla tbody");
const tablaHeader = document.getElementById("tablaHeader");
const tipoValidacionSelect = document.getElementById("tipoValidacion");
const tipoPaqueteSelect = document.getElementById("tipoPaquete");
const paqueteOptionsDiv = document.getElementById("paqueteOptions");
const convenioSelect = document.getElementById("convenio");

/**
 * Limpia los resultados y resetea la tabla
 */
function limpiarResultados() {
    tablaBody.innerHTML = "";
    estado.classList.add("oculto");
    input.value = "";
}

// Event listeners para cambios de configuración
tipoValidacionSelect.addEventListener("change", () => {
    limpiarResultados();
    if (tipoValidacionSelect.value === "paquete") {
        paqueteOptionsDiv.classList.remove("oculto");
    } else {
        paqueteOptionsDiv.classList.add("oculto");
    }
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value
    );
});

tipoPaqueteSelect.addEventListener("change", () => {
    limpiarResultados();
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value
    );
});

convenioSelect.addEventListener("change", () => {
    limpiarResultados();
});

// Event listener principal para procesar carpetas
input.addEventListener("change", async () => {
    console.log("Evento change disparado en input");
    tablaBody.innerHTML = "";
    estado.classList.remove("oculto");

    const carpetas = {};
    const resultados = {};
    const tipoValidacion = tipoValidacionSelect.value;
    const tipoPaquete = tipoPaqueteSelect.value;
    const convenio = convenioSelect.value;

    console.log("Configuración:", { tipoValidacion, tipoPaquete, convenio });
    console.log("Archivos seleccionados:", input.files.length);

    // Actualizar headers de la tabla
    actualizarHeadersTabla(tabla, tablaHeader, tipoValidacion, tipoPaquete);

    // Agrupar archivos por carpeta
    for (const f of input.files) {
        const p = f.webkitRelativePath.split("/");
        if (p.length < 2) continue;
        carpetas[p[1]] ??= [];
        carpetas[p[1]].push(f);
    }

    // Procesar cada carpeta
    for (const carpeta in carpetas) {
        resultados[carpeta] = inicializarResultado(tipoValidacion, tipoPaquete);

        // Detectar tipo de carpeta (para validación por evento)
        if (tipoValidacion === "evento") {
            detectarTipoCarpeta(carpeta, resultados[carpeta]);
        } else {
            resultados[carpeta].tipo = `Paquete: ${
                tipoPaquete === "cronico" ? "Crónico" : "Crónico con terapias"
            }`;
        }

        // Crear fila placeholder
        createPlaceholderRow(tablaBody, carpeta, tipoValidacion, tipoPaquete);

        const archivos = carpetas[carpeta];
        const nombres = archivos.map((a) => a.name);
        const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";

        // Inicializar URLs de archivos
        inicializarURLsArchivos(archivos, resultados[carpeta]);

        if (tipoValidacion === "paquete") {
            await validarPorPaquete(
                carpeta,
                archivos,
                tipoPaquete,
                nroDocumento,
                resultados,
                estado,
                (carp, res) => updateRow(tablaBody, carp, res),
                convenio
            );
        } else {
            // Validación por evento
            await procesarValidacionEvento(
                carpeta,
                archivos,
                nombres,
                nroDocumento,
                resultados,
                convenio
            );
        }

        // Quitar spinner final
        const row = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
        if (row) row.classList.remove("processing");
    }

    estado.classList.add("oculto");
});

/**
 * Inicializa el objeto de resultados para una carpeta
 */
function inicializarResultado(tipoValidacion, tipoPaquete) {
    return {
        pdfs:
            tipoValidacion === "evento"
                ? {
                      "2.pdf": "—",
                      "3.pdf": "—",
                      "4.pdf": "—",
                      "5.pdf": "—",
                  }
                : {},
        pdfsPorServicio: {},
        fechasPorServicio: {},
        servicios: new Set(),
        errores: [],
        erroresPorServicio: {}, // Errores específicos por servicio
        exitosPorServicio: {}, // Validaciones exitosas por servicio
        alertasPorServicio: {}, // Alertas/advertencias por servicio
        fechas: [],
        fileUrls: {},
        tipoValidacion,
        tipoPaquete,
        buscarEn2Paq: new Set(), // Para FOMAG: servicios a buscar en 2 paq.pdf
        numerosPorServicio: {}, // Para FOMAG: números extraídos por servicio
        numeroFomag: null, // Para FOMAG evento: número extraído del 2.pdf
    };
}

/**
 * Detecta el tipo de carpeta basándose en su nombre
 */
function detectarTipoCarpeta(carpeta, resultado) {
    const carpetaUpper = carpeta.toUpperCase();
    const tipoDetectado = ALLOWED_TYPES.find((t) => carpetaUpper.includes(t));
    resultado.tipo = tipoDetectado || null;

    if (!tipoDetectado) {
        resultado.errores.push(
            `Tipo no reconocido (se esperaba uno de: ${ALLOWED_TYPES.join(
                ", "
            )})`
        );
    }
}

/**
 * Inicializa las URLs de los archivos PDF
 */
function inicializarURLsArchivos(archivos, resultado) {
    resultado.fileUrls = {
        "2.pdf": null,
        "3.pdf": null,
        "4.pdf": null,
        "5.pdf": null,
    };

    for (const f of archivos) {
        if (resultado.fileUrls.hasOwnProperty(f.name)) {
            resultado.fileUrls[f.name] = URL.createObjectURL(f);
        }
    }
}

/**
 * Procesa la validación por evento
 */
async function procesarValidacionEvento(
    carpeta,
    archivos,
    nombres,
    nroDocumento,
    resultados,
    convenio
) {
    // Verificar presencia de archivos
    ["2.pdf", "3.pdf", "4.pdf", "5.pdf"].forEach((p) => {
        if (nombres.includes(p)) {
            resultados[carpeta].pdfs[p] = "✔";
        } else {
            resultados[carpeta].errores.push(`Falta ${p}`);
        }
    });

    // Validar cada PDF
    for (const file of archivos.filter((f) => f.type === "application/pdf")) {
        estado.textContent = `Procesando: ${carpeta} / ${file.name}`;
        await validarPDF(file, carpeta, nroDocumento, resultados, convenio);
        updateRow(tablaBody, carpeta, resultados[carpeta]);
    }
}
