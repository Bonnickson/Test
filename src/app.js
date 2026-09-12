import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import {
    ALLOWED_TYPES,
    PDF_WORKER_URL,
} from "./config/constants.js";
import {
    validarPDF,
    validarArchivosPermitidosEvento,
    procesarArchivo2PaqEvento,
} from "./validators/eventoValidator.js";
import { validarPorPaquete } from "./validators/paqueteValidator.js";
import {
    actualizarHeadersTabla,
    createPlaceholderRow,
    updateRow,
} from "./ui/tableRenderer.js";
import {
    abrirPDFModal,
    cerrarModal,
    inicializarControlesPDF,
} from "./ui/pdfViewer.js";
import {
    mostrarCondicionesPaquete,
    mostrarModalReglasPaquete,
    mostrarAvisoRevisionFirmas,
    mostrarModalPrevalidacionMatriz,
    mostrarModalAlertaFinalValidacion,
    mostrarModalProgramadoDetallado,
    verArchivosCarpeta as verArchivosCarpetaUI,
    verProgramadoCarpeta as verProgramadoCarpetaUI,
    cerrarTodosLosPopupsYModales,
    inicializarCierrePorEscape,
} from "./ui/modalManager.js";
import {
    aplicarFiltros,
    reiniciarFiltros,
    actualizarResumen,
    actualizarProgreso,
    normalizarTipoError,
    copiarTodosErroresVisibles,
} from "./ui/filterManager.js";
import {
    copiarNumero,
    copiarFormatoCompleto,
    copiarHallazgosCompletos,
} from "./utils/clipboardUtils.js";
import {
    agruparArchivosInteligente,
    ordenarCarpetasPorPaquete,
    recorrerCarpetaRecursivo,
} from "./services/folderService.js";
import {
    cargarXLSX,
    exportarXLSX,
    exportarResumenErroresXLSX,
    exportarFomagEvento,
} from "./services/excelExportService.js";
import {
    leerArchivoMatriz,
    parsearMatriz,
    normalizarDocumentoMatriz,
} from "./services/matrixService.js";

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

// Elementos del DOM
const inputMatriz = document.getElementById("inputMatriz");
const matrixDropzone = document.getElementById("matrixDropzone");
const matrixDropzoneTitle = document.getElementById("matrixDropzoneTitle");
const matrixDropzoneSubtitle = document.getElementById("matrixDropzoneSubtitle");
const matrizInfoBadge = document.getElementById("matrizInfoBadge");
const matrizNombreArchivo = document.getElementById("matrizNombreArchivo");
const matrizStatsTexto = document.getElementById("matrizStatsTexto");
const btnVerPrevalidacion = document.getElementById("btnVerPrevalidacion");

const input = document.getElementById("inputFolder");
const btnAbrirFS = document.getElementById("btnAbrirFS");
const btnDescargar = document.getElementById("btnDescargar");
const btnDescargarMatriz = document.getElementById("btnDescargarMatriz");
const estado = document.getElementById("estado");
const tabla = document.getElementById("tabla");
const tablaBody = document.querySelector("#tabla tbody");
const tablaHeader = document.getElementById("tablaHeader");
const tipoValidacionSelect = document.getElementById("tipoValidacion");
const tipoPaqueteSelect = document.getElementById("tipoPaquete");
const paqueteOptionsDiv = document.getElementById("paqueteOptions");
const convenioSelect = document.getElementById("convenio");
const resumenDiv = document.getElementById("resumen");
const filtrosDiv = document.getElementById("filtros");
const buscarDocumentoInput = document.getElementById("buscarDocumento");
const mostrarExitosCheckbox = document.getElementById("mostrarExitos");
const filtroServicioSelect = document.getElementById("filtroServicio");
const grupoFiltroEstado = document.getElementById("grupoFiltroEstado");
const limpiarFiltrosBtn = document.getElementById("limpiarFiltros");
const btnLimpiarTodo = document.getElementById("btnLimpiar");
const barraProgresoDiv = document.getElementById("barraProgreso");
const progresoTexto = document.getElementById("progresoTexto");
const progresoDetalle = document.getElementById("progresoDetalle");
const progresoPorcentaje = document.getElementById("progresoPorcentaje");
const progresoFill = document.getElementById("progresoFill");
const resumenErroresDiv = document.getElementById("resumenErrores");
const listaErroresDiv = document.getElementById("listaErrores");
const paqueteCondicionesContent = document.getElementById("paqueteCondicionesContent");
const seccionSoportes = document.getElementById("seccionSoportes");

// Agrupación de elementos para gestores de UI
const domElements = {
    input,
    tabla,
    tablaBody,
    tablaHeader,
    resumenDiv,
    filtrosDiv,
    buscarDocumentoInput,
    mostrarExitosCheckbox,
    filtroServicioSelect,
    grupoFiltroEstado,
    resumenErroresDiv,
    listaErroresDiv,
    progresoFill,
    progresoPorcentaje,
    progresoTexto,
    progresoDetalle,
};

// Estado global de la aplicación
let todosLosResultados = {};
let todasLasCarpetas = [];
let datosMatrizGlobal = null; // Almacena { pacientesPorDoc, pacientesList, diagnosticoGlobal }
const appState = {
    estadoFiltroActivo: "",
    erroresSeleccionados: new Set(),
};

// Ceder ejecución al hilo principal para mantener la UI responsiva
const cederHiloPrincipal = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Selección de carpetas y filas en la tabla
 */
export function seleccionarCarpeta(carpeta, filaEspecifica = null) {
    if (!tablaBody) return;

    tablaBody.querySelectorAll("tr.selected, tr.selected-folder").forEach((tr) => {
        tr.classList.remove("selected", "selected-folder");
    });

    if (!carpeta) {
        if (filaEspecifica) filaEspecifica.classList.add("selected");
        return;
    }

    const selector = `tr[data-carpeta="${CSS.escape ? CSS.escape(carpeta) : carpeta}"]`;
    const filas = tablaBody.querySelectorAll(selector);
    filas.forEach((tr) => {
        tr.classList.add("selected-folder");
    });

    if (filaEspecifica) {
        filaEspecifica.classList.add("selected");
    } else if (filas.length > 0) {
        filas[0].classList.add("selected");
    }
}

export function seleccionarFila(fila) {
    if (!fila) return;
    const carpeta = fila.getAttribute("data-carpeta");
    seleccionarCarpeta(carpeta, fila);
}

/**
 * Limpia los resultados y resetea la interfaz
 */
function limpiarResultados(limpiarInput = false) {
    if (todosLosResultados) {
        Object.values(todosLosResultados).forEach((r) => {
            if (r && r.fileUrls) {
                Object.values(r.fileUrls).forEach((url) => {
                    if (url && typeof url === "string" && url.startsWith("blob:")) {
                        URL.revokeObjectURL(url);
                    }
                });
            }
        });
    }
    tablaBody.innerHTML = "";
    estado.classList.add("oculto");
    resumenDiv.classList.add("oculto");
    filtrosDiv.classList.add("oculto");
    barraProgresoDiv.classList.add("oculto");
    btnLimpiarTodo.classList.add("oculto");
    btnDescargar.classList.add("oculto");
    btnDescargarMatriz.classList.add("oculto");
    resumenErroresDiv.classList.add("oculto");

    if (limpiarInput && input) {
        input.value = "";
    }

    // Resetear también la matriz cargada si se limpia todo
    if (limpiarInput) {
        datosMatrizGlobal = null;
        if (inputMatriz) inputMatriz.value = "";
        if (matrizInfoBadge) matrizInfoBadge.classList.add("oculto");
        if (matrixDropzoneTitle) matrixDropzoneTitle.textContent = "Adjuntar Matriz";
        if (matrixDropzoneSubtitle) matrixDropzoneSubtitle.textContent = "Excel o CSV de programación";
        if (matrizNombreArchivo) matrizNombreArchivo.textContent = "";
        if (matrizStatsTexto) matrizStatsTexto.textContent = "0 pacientes cargados";
        if (seccionSoportes) seccionSoportes.classList.add("oculto");
    }

    reiniciarFiltros(domElements, appState, false);
    todosLosResultados = {};
    todasLasCarpetas = [];
    listaErroresDiv.innerHTML = "";
    progresoFill.style.width = "0%";
}

/**
 * Inicializa el objeto de resultados para una carpeta
 */
function inicializarResultado(tipoValidacion, tipoPaquete, convenio = "capital-salud") {
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
        erroresPorServicio: {},
        exitosPorServicio: {},
        alertasPorServicio: {},
        fechas: [],
        fileUrls: {},
        tipoValidacion,
        tipoPaquete,
        convenio,
        buscarEn2Paq: new Set(),
        numerosPorServicio: {},
        numeroFomag: null,
    };
}

/**
 * Detecta el tipo de servicio desde el nombre de carpeta para validación por evento
 */
function detectarTipoCarpeta(carpeta, resultado, convenio = "capital-salud") {
    const carpetaUpper = carpeta.toUpperCase();
    const tipoDetectado = ALLOWED_TYPES.find((t) => carpetaUpper.includes(t));
    resultado.tipo = tipoDetectado || null;

    if (!tipoDetectado && convenio !== "fomag") {
        resultado.errores.push(
            `Por Evento: la carpeta debe incluir un tipo válido (${ALLOWED_TYPES.join(", ")})`
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
        if (f.type === "application/pdf") {
            const url = URL.createObjectURL(f);
            resultado.fileUrls[f.name] = url;
            if (resultado.fileUrls.hasOwnProperty(f.name)) {
                resultado.fileUrls[f.name] = url;
            }
        }
    }
}

/**
 * Procesa la validación por evento para una carpeta
 */
async function procesarValidacionEvento(
    carpeta,
    archivos,
    nombres,
    nroDocumento,
    resultados,
    convenio
) {
    validarArchivosPermitidosEvento(archivos, resultados, carpeta, convenio);

    if (convenio === "fomag") {
        const tieneNum = (num) =>
            nombres.some((n) => new RegExp(`^${num}\\s+`, "i").test(n));
        ["2", "4", "5"].forEach((num) => {
            const key = `${num}.pdf`;
            if (nombres.includes(key) || tieneNum(num)) {
                resultados[carpeta].pdfs[key] = "✔";
            } else {
                resultados[carpeta].errores.push(`Falta ${key}`);
            }
        });
        resultados[carpeta].pdfs["3.pdf"] = nombres.includes("3.pdf")
            ? "✔"
            : "—";
    } else {
        ["2.pdf", "3.pdf", "4.pdf", "5.pdf"].forEach((p) => {
            if (nombres.includes(p)) {
                resultados[carpeta].pdfs[p] = "✔";
            } else {
                resultados[carpeta].errores.push(`Falta ${p}`);
            }
        });
    }

    const archivosPDF = archivos
        .filter((f) => f.type === "application/pdf")
        .sort((a, b) => {
            const numA = parseInt(a.name.match(/^(\d+)/)?.[1] || "99");
            const numB = parseInt(b.name.match(/^(\d+)/)?.[1] || "99");
            return numA - numB;
        });

    let archivo2Paq = null;
    const serviciosCon5 = new Set();

    if (convenio === "fomag") {
        archivo2Paq = archivos.find(
            (f) => f.name.toLowerCase() === "2 paq.pdf"
        );
        for (const nombre of nombres) {
            const match5 = nombre
                .toLowerCase()
                .match(
                    /^5\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/
                );
            if (match5) {
                let serv = match5[1];
                if (serv === "suc") serv = "succion";
                serviciosCon5.add(serv.toUpperCase());
            }
        }

        if (archivo2Paq && serviciosCon5.size > 0) {
            estado.textContent = `Procesando: ${carpeta} / 2 paq.pdf`;
            await procesarArchivo2PaqEvento(archivo2Paq, carpeta, resultados, [
                ...serviciosCon5,
            ]);
        }

        const serviciosDetectados = new Set();
        const regexServicioValidacion =
            /^([245])\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/i;

        for (const nombre of nombres) {
            const match = nombre.match(regexServicioValidacion);
            if (match) {
                let s = match[2].toLowerCase();
                if (s === "suc") s = "succion";
                serviciosDetectados.add(s.toUpperCase());
            }
        }

        for (const servicio of serviciosDetectados) {
            const srvLower = servicio.toLowerCase();
            const tiene5 = nombres.some((n) =>
                new RegExp(`^5\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene4 = nombres.some((n) =>
                new RegExp(`^4\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene2Individual = nombres.some((n) =>
                new RegExp(`^2\\s+${srvLower}\\.pdf$`, "i").test(n)
            );
            const tiene2Paq = nombres.some(
                (n) => n.toLowerCase() === "2 paq.pdf"
            );
            const tiene2 = tiene2Individual || tiene2Paq;

            resultados[carpeta].erroresPorServicio[servicio] =
                resultados[carpeta].erroresPorServicio[servicio] || [];

            if (!tiene5) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 5 ${srvLower}.pdf`);
            if (!tiene4) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 4 ${srvLower}.pdf`);
            if (!tiene2) resultados[carpeta].erroresPorServicio[servicio].push(`Falta 2 ${srvLower}.pdf (o 2 paq.pdf)`);
        }
    }

    for (const file of archivosPDF) {
        if (file.name.toLowerCase() === "2 paq.pdf") continue;

        estado.textContent = `Procesando: ${carpeta} / ${file.name}`;
        const carpetaIndex = todasLasCarpetas.indexOf(carpeta) + 1;
        if (carpetaIndex > 0) {
            actualizarProgreso(
                carpetaIndex,
                todasLasCarpetas.length,
                carpeta,
                file.name,
                domElements
            );
        }
        await validarPDF(file, carpeta, nroDocumento, resultados, convenio);
        updateRow(
            tablaBody,
            carpeta,
            resultados[carpeta],
            mostrarExitosCheckbox ? mostrarExitosCheckbox.checked : false
        );
    }
}

/**
 * Orquesta el procesamiento de archivos agrupados
 */
async function procesarLoteArchivos(archivosLista) {
    try {
        reiniciarFiltros(domElements, appState, false);
        tablaBody.innerHTML = "";
        estado.classList.remove("oculto");
        barraProgresoDiv.classList.remove("oculto");
        btnLimpiarTodo.classList.remove("oculto");
        resumenDiv.classList.add("oculto");
        filtrosDiv.classList.add("oculto");

        const resultados = {};
        const tipoValidacion = tipoValidacionSelect.value;
        const tipoPaqueteFallback = tipoPaqueteSelect.value;
        const convenio = convenioSelect.value;

        actualizarHeadersTabla(
            tabla,
            tablaHeader,
            tipoValidacion,
            tipoPaqueteFallback,
            convenio
        );

        // Validar que la matriz esté cargada obligatoriamente para validación por paquete
        if (tipoValidacion === "paquete" && !datosMatrizGlobal) {
            estado.classList.remove("oculto");
            estado.textContent = "❌ Error: Debe adjuntar primero la matriz Excel/CSV (Paso 1) antes de validar los soportes.";
            alert("Por favor adjunta la matriz de programación (.xlsx, .xls, .csv) en el Paso 1 antes de cargar los soportes.");
            return;
        }

        const carpetasAgrupadas = agruparArchivosInteligente(
            archivosLista,
            tipoPaqueteFallback,
            tipoValidacion
        );
        const carpetasKeys = ordenarCarpetasPorPaquete(carpetasAgrupadas);
        const totalCarpetas = carpetasKeys.length;

        if (totalCarpetas === 0) {
            estado.classList.remove("oculto");
            estado.textContent =
                "❌ Error: No se encontraron carpetas. Asegúrate de seleccionar una carpeta (no archivos individuales).";
            return;
        }

        // Registrar qué documentos de la matriz fueron encontrados en las carpetas
        const documentosProcesadosSet = new Set();

        todasLasCarpetas = carpetasKeys;
        let carpetasProcesadas = 0;

        for (const carpetaKey of carpetasKeys) {
            const infoCarpeta = carpetasAgrupadas[carpetaKey];
            const carpeta = infoCarpeta.carpetaNombre;
            let paqueteParaCarpeta = infoCarpeta.tipoPaquete;

            // Búsqueda en la matriz tal cual viene escrita la carpeta
            const claveBusquedaMatriz = normalizarDocumentoMatriz(carpeta);
            // Extracción del número de documento (solo dígitos numéricos, ignorando prefijos como TI, CC, RC, etc.)
            const nroDocumento = (carpeta.match(/\d+/)?.[0] || carpeta).trim();

            // Cruce con la matriz si existe
            let datosMatrizPaciente = null;
            if (datosMatrizGlobal && datosMatrizGlobal.pacientesPorDoc) {
                if (claveBusquedaMatriz && datosMatrizGlobal.pacientesPorDoc.has(claveBusquedaMatriz)) {
                    datosMatrizPaciente = datosMatrizGlobal.pacientesPorDoc.get(claveBusquedaMatriz);
                    documentosProcesadosSet.add(claveBusquedaMatriz);
                    // Si la carpeta no tenía paquete explícito en disco, tomar el de la matriz
                    if (!infoCarpeta.tipoPaquete || infoCarpeta.tipoPaquete === "auto" || infoCarpeta.tipoPaquete === "CPF1108") {
                        if (datosMatrizPaciente.paquete) {
                            paqueteParaCarpeta = datosMatrizPaciente.paquete;
                        } else if (datosMatrizPaciente.esFacturarEvento) {
                            paqueteParaCarpeta = "EVENTO";
                        } else {
                            paqueteParaCarpeta = "SIN_PAQUETE";
                        }
                    }
                }
            }

            resultados[carpetaKey] = inicializarResultado(
                tipoValidacion,
                paqueteParaCarpeta,
                convenio
            );
            resultados[carpetaKey].tipoPaquete = paqueteParaCarpeta;
            resultados[carpetaKey].nroDocumento = nroDocumento;
            resultados[carpetaKey].datosMatriz = datosMatrizPaciente;
            resultados[carpetaKey].auditor = infoCarpeta.auditor || "";
            resultados[carpetaKey].rutaRelativa = infoCarpeta.rutaRelativa || "";

            if (tipoValidacion === "evento") {
                detectarTipoCarpeta(carpeta, resultados[carpetaKey], convenio);
            } else {
                resultados[carpetaKey].tipo = paqueteParaCarpeta;
            }

            // Si el paciente de la carpeta NO está en la matriz cargada: ERROR
            if (datosMatrizGlobal && !datosMatrizPaciente && tipoValidacion === "paquete") {
                resultados[carpetaKey].servicios.add("General");
                resultados[carpetaKey].erroresPorServicio["General"] =
                    resultados[carpetaKey].erroresPorServicio["General"] || [];
                resultados[carpetaKey].erroresPorServicio["General"].push(
                    `El paciente ${carpeta} NO se encuentra programado en la matriz cargada.`
                );
            }

            if (infoCarpeta.errorPaquete) {
                resultados[carpetaKey].servicios.add("General");
                resultados[carpetaKey].erroresPorServicio["General"] =
                    resultados[carpetaKey].erroresPorServicio["General"] || [];
                resultados[carpetaKey].erroresPorServicio["General"].push(
                    infoCarpeta.errorPaquete
                );
            }

            createPlaceholderRow(
                tablaBody,
                carpetaKey,
                tipoValidacion,
                paqueteParaCarpeta
            );

            const archivos = infoCarpeta.archivos;
            const nombres = archivos.map((a) => a.name);

            resultados[carpetaKey].primerArchivoRelPath =
                archivos[0]?.webkitRelativePath || carpeta;
            resultados[carpetaKey].listaArchivos = nombres;
            inicializarURLsArchivos(archivos, resultados[carpetaKey]);

            if (tipoValidacion === "paquete") {
                await validarPorPaquete(
                    carpetaKey,
                    archivos,
                    paqueteParaCarpeta,
                    nroDocumento,
                    resultados,
                    estado,
                    (carp, res) =>
                        updateRow(
                            tablaBody,
                            carp,
                            res,
                            Boolean(mostrarExitosCheckbox?.checked)
                        ),
                    convenio,
                    (nombreArchivo) => {
                        actualizarProgreso(
                            carpetasProcesadas + 1,
                            totalCarpetas,
                            carpeta,
                            nombreArchivo,
                            domElements
                        );
                    }
                );
            } else {
                await procesarValidacionEvento(
                    carpetaKey,
                    archivos,
                    nombres,
                    nroDocumento,
                    resultados,
                    convenio
                );
                updateRow(
                    tablaBody,
                    carpetaKey,
                    resultados[carpetaKey],
                    Boolean(mostrarExitosCheckbox?.checked)
                );
            }

            const row = document.querySelector(`tr[data-carpeta="${carpetaKey}"]`);
            if (row) row.classList.remove("processing");

            carpetasProcesadas++;
            actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta, "", domElements);
            actualizarResumen(resultados, domElements, appState, true, exportarResumenErroresXLSX);

            await cederHiloPrincipal();
        }

        // VALIDACIÓN BIDIRECCIONAL: Pacientes de la matriz que no tienen carpeta de soportes
        if (datosMatrizGlobal && tipoValidacion === "paquete") {
            for (const [doc, pac] of datosMatrizGlobal.pacientesPorDoc.entries()) {
                // Omitir si es un paciente que factura por evento y no tiene paquete
                if (pac.esFacturarEvento && !pac.paquete) {
                    continue;
                }

                if (!documentosProcesadosSet.has(doc)) {
                    const carpetaVirtual = `${doc}`.trim();
                    const paqueteAsignado = pac.paquete || "SIN_PAQUETE";
                    resultados[carpetaVirtual] = inicializarResultado(
                        "paquete",
                        paqueteAsignado,
                        convenio
                    );
                    resultados[carpetaVirtual].nroDocumento = doc;
                    resultados[carpetaVirtual].tipo = paqueteAsignado;
                    resultados[carpetaVirtual].tipoPaquete = paqueteAsignado;
                    resultados[carpetaVirtual].datosMatriz = pac;
                    resultados[carpetaVirtual].esDesdeMatriz = true;
                    resultados[carpetaVirtual].servicios.add("General");
                    
                    const mensajeError = !pac.paquete
                        ? `No se encontró carpeta de soportes y el paciente ${doc} no tiene paquete asignado en la matriz.`
                        : `No se encontró carpeta de soportes PDF para el documento ${doc} programado en la matriz.`;

                    resultados[carpetaVirtual].erroresPorServicio["General"] = [mensajeError];

                    createPlaceholderRow(tablaBody, carpetaVirtual, "paquete", paqueteAsignado);
                    updateRow(tablaBody, carpetaVirtual, resultados[carpetaVirtual], Boolean(mostrarExitosCheckbox?.checked));
                }
            }
        }

        todosLosResultados = resultados;
        actualizarResumen(resultados, domElements, appState, false, exportarResumenErroresXLSX);
        btnDescargar.classList.remove("oculto");

        if (tipoValidacion === "evento" && convenio === "fomag") {
            btnDescargarMatriz.classList.remove("oculto");
        } else {
            btnDescargarMatriz.classList.add("oculto");
        }

        estado.classList.add("oculto");
        barraProgresoDiv.classList.add("oculto");

        // Mostrar mensaje emergente indicando si hay errores/novedades
        const totalItems = Object.keys(resultados).length;
        let totalConErrores = 0;
        let totalConAlertas = 0;
        Object.values(resultados).forEach((r) => {
            const errs = [
                ...(r.errores || []),
                ...Object.values(r.erroresPorServicio || {}).flat()
            ];
            const alerts = [
                ...(r.alertas || []),
                ...Object.values(r.alertasPorServicio || {}).flat()
            ];
            if (errs.length > 0) {
                totalConErrores++;
            } else if (alerts.length > 0) {
                totalConAlertas++;
            }
        });

        mostrarModalAlertaFinalValidacion(totalItems, totalConErrores, totalConAlertas);
    } catch (error) {
        console.error("❌ Error en procesamiento de lote:", error);
        estado.classList.remove("oculto");
        estado.textContent = `❌ Error: ${error.message}`;
    }
}

// ================= CONFIGURACIÓN DE EVENT LISTENERS =================

// Input file selector de Matriz
if (inputMatriz) {
    inputMatriz.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            estado.classList.remove("oculto");
            estado.textContent = "📊 Leyendo y analizando matriz...";

            const rawRows = await leerArchivoMatriz(file);
            const resultadoMatriz = parsearMatriz(rawRows);

            datosMatrizGlobal = resultadoMatriz;

            // Actualizar Badge en la UI
            if (matrizInfoBadge) {
                matrizInfoBadge.classList.remove("oculto");
                matrizNombreArchivo.textContent = file.name;
                const totalP = resultadoMatriz.diagnosticoGlobal.totalPacientes;
                const errP = resultadoMatriz.diagnosticoGlobal.pacientesConErrores;
                matrizStatsTexto.textContent = `${totalP} pacientes (${totalP - errP} conformes, ${errP} con novedades)`;
            }
            if (matrixDropzoneTitle) {
                matrixDropzoneTitle.textContent = "Matriz Cargada ✓";
            }
            if (matrixDropzoneSubtitle) {
                matrixDropzoneSubtitle.textContent = file.name;
            }

            // Mostrar sección de carga de soportes
            if (seccionSoportes) {
                seccionSoportes.classList.remove("oculto");
            }

            estado.classList.add("oculto");

            // Mostrar modal de prevalidación inmediatamente para diagnóstico
            mostrarModalPrevalidacionMatriz(datosMatrizGlobal);
        } catch (err) {
            console.error("Error al leer matriz:", err);
            estado.classList.remove("oculto");
            estado.textContent = `❌ Error leyendo matriz: ${err.message}`;
            alert(`Error al procesar la matriz: ${err.message}`);
        }
    });
}

// Botón para reabrir diagnóstico de la matriz
if (btnVerPrevalidacion) {
    btnVerPrevalidacion.addEventListener("click", () => {
        if (datosMatrizGlobal) {
            mostrarModalPrevalidacionMatriz(datosMatrizGlobal);
        }
    });
}

// Input file selector de soportes
input.addEventListener("change", async () => {
    if (!input.files || input.files.length === 0) return;
    estado.classList.remove("oculto");
    estado.textContent = "📂 Cargando y organizando soportes seleccionados...";
    barraProgresoDiv.classList.remove("oculto");
    progresoFill.style.width = "5%";
    await cederHiloPrincipal();
    await procesarLoteArchivos(input.files);
});

// Selector de File System Access API
if (btnAbrirFS) {
    btnAbrirFS.addEventListener("click", async () => {
        if (!window.showDirectoryPicker) {
            alert(
                "Esta opción requiere Chrome/Edge con permisos de sitio. Abra en Chrome o use el selector de carpeta."
            );
            return;
        }
        try {
            const dirHandle = await window.showDirectoryPicker();
            estado.classList.remove("oculto");
            estado.textContent = "🔍 Escaneando carpetas...";

            const files = await recorrerCarpetaRecursivo(dirHandle);
            if (files.length === 0) {
                estado.textContent = "❌ No se encontraron archivos en la carpeta seleccionada.";
                return;
            }
            await procesarLoteArchivos(files);
        } catch (error) {
            if (error.name !== "AbortError") {
                console.error("Error al abrir carpeta:", error);
                estado.classList.remove("oculto");
                estado.textContent = `❌ Error: ${error.message}`;
            }
        }
    });
}

// Botones de descarga Excel
btnDescargar.addEventListener("click", async () => {
    if (!todosLosResultados || Object.keys(todosLosResultados).length === 0) {
        alert("No hay resultados para descargar");
        return;
    }
    const ok = await cargarXLSX();
    if (!ok) {
        alert("No se pudo cargar la librería XLSX. Verifica tu conexión a internet.");
        return;
    }
    exportarXLSX(todosLosResultados);
});

btnDescargarMatriz.addEventListener("click", async () => {
    const ok = await cargarXLSX();
    if (!ok) {
        alert("No se pudo cargar la librería XLSX. Verifica tu conexión a internet.");
        return;
    }
    exportarFomagEvento(todosLosResultados);
});

btnLimpiarTodo.addEventListener("click", () => {
    limpiarResultados(true);
});

// Eventos de configuración de parámetros
function manejarCambioConfiguracion() {
    limpiarResultados(false);
    if (tipoValidacionSelect.value === "paquete" && convenioSelect.value === "capital-salud") {
        tipoValidacionSelect.value = "evento";
        paqueteOptionsDiv.classList.add("oculto");
        estado.classList.remove("oculto");
        estado.textContent = "Capital Salud no valida por paquete. Cambiando a Evento.";
        setTimeout(() => estado.classList.add("oculto"), 2500);
    } else {
        if (tipoValidacionSelect.value === "paquete") {
            paqueteOptionsDiv.classList.remove("oculto");
        } else {
            paqueteOptionsDiv.classList.add("oculto");
        }
    }
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value
    );
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
}

tipoValidacionSelect.addEventListener("change", manejarCambioConfiguracion);
tipoPaqueteSelect.addEventListener("change", () => {
    limpiarResultados(false);
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value,
        convenioSelect.value
    );
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
});
convenioSelect.addEventListener("change", manejarCambioConfiguracion);

// Event listeners de filtros y búsqueda
if (buscarDocumentoInput) buscarDocumentoInput.addEventListener("input", () => aplicarFiltros(domElements, appState));
if (mostrarExitosCheckbox) mostrarExitosCheckbox.addEventListener("change", () => aplicarFiltros(domElements, appState));
if (filtroServicioSelect) filtroServicioSelect.addEventListener("change", () => aplicarFiltros(domElements, appState));

const ordenarTablaSelect = document.getElementById("ordenarTabla");
if (ordenarTablaSelect) {
    ordenarTablaSelect.addEventListener("change", () => aplicarFiltros(domElements, appState));
}

const btnCopiarTodos = document.getElementById("btnCopiarTodosErrores");
if (btnCopiarTodos) {
    btnCopiarTodos.addEventListener("click", () => copiarTodosErroresVisibles(todosLosResultados));
}

if (grupoFiltroEstado) {
    grupoFiltroEstado.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-segmented");
        if (!btn) return;
        const nuevoEstado = btn.getAttribute("data-estado") || "";
        grupoFiltroEstado.querySelectorAll(".btn-segmented").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        appState.estadoFiltroActivo = nuevoEstado;
        aplicarFiltros(domElements, appState);

        if (nuevoEstado === "con-novedades") {
            mostrarAvisoRevisionFirmas();
        }
    });
}

limpiarFiltrosBtn.addEventListener("click", () => {
    reiniciarFiltros(domElements, appState, true);
});

// Selección de tipos de error en el resumen
listaErroresDiv.addEventListener("click", (e) => {
    const item = e.target.closest(".error-card-pill, .error-tipo-item");
    if (!item) return;
    const tipo = item.getAttribute("data-tipo");
    if (!tipo) return;
    const tipoNorm = item.getAttribute("data-tipo-normalized") || normalizarTipoError(tipo);

    if (item.classList.toggle("selected")) {
        appState.erroresSeleccionados.add(tipoNorm);
    } else {
        appState.erroresSeleccionados.delete(tipoNorm);
    }

    const btnCopiar = document.getElementById("btnCopiarIncidenciasSeleccionadas");
    if (btnCopiar) {
        const count = appState.erroresSeleccionados.size;
        if (count > 0) {
            btnCopiar.classList.remove("oculto");
            btnCopiar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copiar listado (${count})`;
        } else {
            btnCopiar.classList.add("oculto");
        }
    }

    aplicarFiltros(domElements, appState);
});

// Selección de filas al hacer clic en la tabla
tablaBody.addEventListener("click", (event) => {
    const fila = event.target.closest("tr");
    if (fila && fila.parentElement === tablaBody) {
        seleccionarFila(fila);
    }
});

/**
 * Inicializa el redimensionador interactivo por arrastre del panel de incidencias
 */
function initResumenResizer() {
    const container = document.getElementById("resumenErrores");
    if (!container) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;
    let rafId = 0;

    const applyHeight = (newHeight) => {
        container.style.setProperty("height", `${newHeight}px`, "important");
        container.style.setProperty("max-height", `${newHeight}px`, "important");
    };

    const onMouseMove = (moveEvt) => {
        if (!isDragging) return;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const deltaY = moveEvt.clientY - startY;
            const newHeight = Math.min(800, Math.max(80, startHeight + deltaY));
            applyHeight(newHeight);
        });
    };

    const onMouseUp = () => {
        isDragging = false;
        cancelAnimationFrame(rafId);
        const resizer = container.querySelector(":scope > #resumenResizer");
        if (resizer) resizer.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    };

    container.addEventListener("mousedown", (e) => {
        const resizer = e.target.closest("#resumenResizer");
        if (!resizer) return;
        e.preventDefault();
        isDragging = true;
        startY = e.clientY;
        startHeight = container.getBoundingClientRect().height;
        resizer.classList.add("dragging");
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    });
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    const tipoValidacionInicial = tipoValidacionSelect.value;
    if (tipoValidacionInicial === "paquete") {
        paqueteOptionsDiv.classList.remove("oculto");
    } else {
        paqueteOptionsDiv.classList.add("oculto");
    }
    mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent);
    inicializarControlesPDF();
    initResumenResizer();
    inicializarCierrePorEscape();
});

// ================= EXPOSICIÓN GLOBAL PARA COMPATIBILIDAD CON UI =================
window.abrirPDFModal = (url, titulo, anchorEl) => abrirPDFModal(url, titulo, anchorEl, seleccionarFila);
window.cerrarModal = cerrarModal;
window.cerrarTodosLosPopupsYModales = cerrarTodosLosPopupsYModales;
window.seleccionarCarpeta = seleccionarCarpeta;
window.seleccionarFila = seleccionarFila;
window.verArchivosCarpeta = (carpeta, triggerEl) =>
    verArchivosCarpetaUI(carpeta, triggerEl, todosLosResultados, seleccionarCarpeta, abrirPDFModal);
window.verProgramadoCarpeta = (carpeta, triggerEl) =>
    verProgramadoCarpetaUI(carpeta, triggerEl, todosLosResultados, datosMatrizGlobal, seleccionarCarpeta);
window.abrirModalProgramadoDetallado = (carpeta) =>
    mostrarModalProgramadoDetallado(carpeta, todosLosResultados, datosMatrizGlobal);
window.copiarNumero = (event, carpeta) => copiarNumero(event, carpeta, seleccionarCarpeta);
window.copiarFormatoCompleto = (event, paquete, carpeta) =>
    copiarFormatoCompleto(event, paquete, carpeta, seleccionarCarpeta);
window.copiarHallazgosCompletos = (event, carpeta) =>
    copiarHallazgosCompletos(event, carpeta, todosLosResultados, seleccionarCarpeta);
window.copiarTextoSimple = (event, texto) => copiarTextoSimple(event, texto);
window.copiarErrorMatriz = (event, paquete, documento, erroresTexto) =>
    copiarErrorMatriz(event, paquete, documento, erroresTexto);
window.mostrarAvisoRevisionFirmas = mostrarAvisoRevisionFirmas;
window.mostrarModalReglasPaquete = mostrarModalReglasPaquete;
