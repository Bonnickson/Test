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
const resumenDiv = document.getElementById("resumen");
const filtrosDiv = document.getElementById("filtros");
const buscarDocumentoInput = document.getElementById("buscarDocumento");
const mostrarExitosCheckbox = document.getElementById("mostrarExitos");
const filtroServicioSelect = document.getElementById("filtroServicio");
const filtroEstadoSelect = document.getElementById("filtroEstado");
const limpiarFiltrosBtn = document.getElementById("limpiarFiltros");
const btnLimpiarTodo = document.getElementById("btnLimpiar");
const barraProgresoDiv = document.getElementById("barraProgreso");
const progresoTexto = document.getElementById("progresoTexto");
const progresoDetalle = document.getElementById("progresoDetalle");
const progresoPorcentaje = document.getElementById("progresoPorcentaje");
const progresoFill = document.getElementById("progresoFill");
const resumenErroresDiv = document.getElementById("resumenErrores");
const listaErroresDiv = document.getElementById("listaErrores");

// Variables globales para filtrado
let todosLosResultados = {};
let todasLasCarpetas = [];

/**
 * Limpia los resultados y resetea la tabla
 */
function limpiarResultados(limpiarInput = false) {
    tablaBody.innerHTML = "";
    estado.classList.add("oculto");
    resumenDiv.classList.add("oculto");
    filtrosDiv.classList.add("oculto");
    barraProgresoDiv.classList.add("oculto");
    btnLimpiarTodo.classList.add("oculto");
    resumenErroresDiv.classList.add("oculto");
    if (limpiarInput) {
        input.value = "";
    }
    buscarDocumentoInput.value = "";
    filtroServicioSelect.value = "";
    filtroEstadoSelect.value = "";
    todosLosResultados = {};
    todasLasCarpetas = [];
    progresoFill.style.width = "0%";
}

// Event listener para botón limpiar todo
btnLimpiarTodo.addEventListener("click", () => {
    limpiarResultados(true); // Sí limpiar input
});

// Event listeners para cambios de configuración
tipoValidacionSelect.addEventListener("change", () => {
    limpiarResultados(false); // No limpiar input
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
    limpiarResultados(false); // No limpiar input
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value
    );
});

convenioSelect.addEventListener("change", () => {
    limpiarResultados(false); // No limpiar input
    actualizarHeadersTabla(
        tabla,
        tablaHeader,
        tipoValidacionSelect.value,
        tipoPaqueteSelect.value
    );
});

// Event listeners para filtros
buscarDocumentoInput.addEventListener("input", aplicarFiltros);
mostrarExitosCheckbox.addEventListener("change", aplicarFiltros);
filtroServicioSelect.addEventListener("change", aplicarFiltros);
filtroEstadoSelect.addEventListener("change", aplicarFiltros);
limpiarFiltrosBtn.addEventListener("click", () => {
    buscarDocumentoInput.value = "";
    filtroServicioSelect.value = "";
    filtroEstadoSelect.value = "";
    mostrarExitosCheckbox.checked = true;
    aplicarFiltros();
});

/**
 * Aplica los filtros a la tabla
 */
function aplicarFiltros() {
    const buscarDoc = buscarDocumentoInput.value.trim().toLowerCase();
    const filtroServ = filtroServicioSelect.value;
    const filtroEst = filtroEstadoSelect.value;
    const mostrarExitos = mostrarExitosCheckbox.checked;

    const filas = tablaBody.querySelectorAll("tr");

    // Agrupar filas por carpeta para el filtro de estado
    const filasPorCarpeta = {};
    filas.forEach((fila) => {
        const carpeta = fila.getAttribute("data-carpeta");
        if (carpeta) {
            if (!filasPorCarpeta[carpeta]) {
                filasPorCarpeta[carpeta] = [];
            }
            filasPorCarpeta[carpeta].push(fila);
        }
    });

    // Aplicar filtros
    Object.entries(filasPorCarpeta).forEach(([carpeta, filasCarpeta]) => {
        // Filtro por documento
        let mostrarCarpeta = true;
        if (buscarDoc && !carpeta.toLowerCase().includes(buscarDoc)) {
            mostrarCarpeta = false;
        }

        // Filtro por estado (a nivel de carpeta)
        if (filtroEst && mostrarCarpeta) {
            // Verificar si al menos una fila de la carpeta tiene el estado buscado
            const tieneEstado = filasCarpeta.some((fila) => {
                const estadoFila = fila.getAttribute("data-estado");
                return estadoFila === filtroEst;
            });
            if (!tieneEstado) {
                mostrarCarpeta = false;
            }
        }

        // Aplicar visibilidad a cada fila
        filasCarpeta.forEach((fila) => {
            let mostrarFila = mostrarCarpeta;

            // Filtro por servicio (solo en modo paquete)
            if (filtroServ && mostrarFila) {
                const servicioFila = fila.getAttribute("data-servicio");
                if (servicioFila !== filtroServ) {
                    mostrarFila = false;
                }
            }

            fila.style.display = mostrarFila ? "" : "none";
        });
    });

    // Mostrar/ocultar validaciones exitosas (items individuales dentro de las celdas)
    const exitosItems = document.querySelectorAll(".validacion-exitosa");
    exitosItems.forEach((item) => {
        item.style.display = mostrarExitos ? "" : "none";
    });
}

/**
 * Actualiza el resumen de validación
 */
function actualizarResumen(resultados, incremental = false) {
    const carpetas = Object.keys(resultados);
    const total = carpetas.length;

    let sinErrores = 0;
    let conAlertas = 0;
    let conErrores = 0;
    const erroresPorTipo = {};

    carpetas.forEach((carpeta) => {
        const r = resultados[carpeta];

        // Recopilar errores
        const todosLosErrores = [...(r.errores || [])];
        Object.values(r.erroresPorServicio || {}).forEach((arr) => {
            todosLosErrores.push(...arr);
        });

        // Contar errores por tipo
        todosLosErrores.forEach((error) => {
            const tipoError = error.split(":")[0].trim();
            erroresPorTipo[tipoError] = (erroresPorTipo[tipoError] || 0) + 1;
        });

        const tieneErrores = todosLosErrores.length > 0;
        const tieneAlertas = Object.values(r.alertasPorServicio || {}).some(
            (arr) => arr.length > 0
        );

        if (tieneErrores) {
            conErrores++;
        } else if (tieneAlertas) {
            conAlertas++;
        } else {
            sinErrores++;
        }
    });

    document.getElementById("statTotal").textContent = total;
    document.getElementById("statExito").textContent = sinErrores;
    document.getElementById("statAlertas").textContent = conAlertas;
    document.getElementById("statErrores").textContent = conErrores;

    // Mostrar resumen de errores por tipo
    if (Object.keys(erroresPorTipo).length > 0) {
        const errorItems = Object.entries(erroresPorTipo)
            .sort((a, b) => b[1] - a[1])
            .map(
                ([tipo, count]) =>
                    `<div class="error-tipo-item">
                    <span class="error-tipo-texto">${tipo}</span>
                    <span class="error-tipo-count">${count}</span>
                </div>`
            )
            .join("");

        listaErroresDiv.innerHTML = errorItems;
        resumenErroresDiv.classList.remove("oculto");
    } else {
        resumenErroresDiv.classList.add("oculto");
    }

    resumenDiv.classList.remove("oculto");
    if (!incremental) {
        filtrosDiv.classList.remove("oculto");
    }
}

/**
 * Actualiza la barra de progreso
 */
function actualizarProgreso(actual, total, carpeta = "", archivo = "") {
    const porcentaje = Math.round((actual / total) * 100);
    progresoFill.style.width = `${porcentaje}%`;
    progresoPorcentaje.textContent = `${porcentaje}%`;
    progresoTexto.textContent = `Procesando ${actual} de ${total} carpetas`;
    
    if (carpeta) {
        let detalleTexto = `📁 ${carpeta}`;
        if (archivo) {
            detalleTexto += ` → 📄 ${archivo}`;
        }
        progresoDetalle.textContent = detalleTexto;
    } else {
        progresoDetalle.textContent = "";
    }
}

// Event listener principal para procesar carpetas
input.addEventListener("change", async () => {
    console.log("Evento change disparado en input");
    tablaBody.innerHTML = "";
    estado.classList.remove("oculto");
    barraProgresoDiv.classList.remove("oculto");
    btnLimpiarTodo.classList.remove("oculto");
    resumenDiv.classList.add("oculto");
    filtrosDiv.classList.add("oculto");

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

    // Inicializar progreso
    const totalCarpetas = Object.keys(carpetas).length;
    let carpetasProcesadas = 0;

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
                convenio,
                (nombreArchivo) => {
                    // Callback para actualizar progreso con archivo actual
                    actualizarProgreso(carpetasProcesadas + 1, totalCarpetas, carpeta, nombreArchivo);
                }
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

        // Actualizar progreso y resumen incremental
        carpetasProcesadas++;
        actualizarProgreso(carpetasProcesadas, totalCarpetas, carpeta);
        actualizarResumen(resultados, true); // true = incremental
    }

    // Guardar resultados globales y actualizar resumen final
    todosLosResultados = resultados;
    todasLasCarpetas = Object.keys(carpetas);
    actualizarResumen(resultados, false); // false = mostrar filtros

    estado.classList.add("oculto");
    barraProgresoDiv.classList.add("oculto");
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
        // Actualizar barra de progreso con archivo actual
        const carpetaIndex = todasLasCarpetas.indexOf(carpeta) + 1;
        if (carpetaIndex > 0) {
            actualizarProgreso(carpetaIndex, todasLasCarpetas.length, carpeta, file.name);
        }
        await validarPDF(file, carpeta, nroDocumento, resultados, convenio);
        updateRow(tablaBody, carpeta, resultados[carpeta]);
    }
}

// ================= FUNCIONES GLOBALES PARA MODAL =================
window.abrirPDFModal = function (url, titulo) {
    const modal = document.getElementById("pdfModal");
    const frame = document.getElementById("pdfFrame");
    const tituloElement = document.getElementById("pdfModalTitle");

    tituloElement.textContent = titulo;
    frame.src = url;
    modal.style.display = "block";

    // Cerrar con ESC
    document.addEventListener("keydown", handleEscKey);
};

window.cerrarModal = function () {
    const modal = document.getElementById("pdfModal");
    const frame = document.getElementById("pdfFrame");

    modal.style.display = "none";
    frame.src = "";

    document.removeEventListener("keydown", handleEscKey);
};

function handleEscKey(e) {
    if (e.key === "Escape") {
        window.cerrarModal();
    }
}

// Cerrar modal al hacer clic fuera del contenido
window.addEventListener("click", function (event) {
    const modal = document.getElementById("pdfModal");
    if (event.target === modal) {
        window.cerrarModal();
    }
});

// Selección de filas en la tabla
tablaBody.addEventListener("click", function (event) {
    // Solo seleccionar si se hace clic en una celda (td) o en la fila
    const fila = event.target.closest("tr");
    if (fila && fila.parentElement === tablaBody) {
        // Si se hizo clic en un enlace, no seleccionar la fila
        if (event.target.tagName === "A" || event.target.closest("a")) {
            return;
        }

        // Remover selección previa
        const filaPrevia = tablaBody.querySelector("tr.selected");
        if (filaPrevia) {
            filaPrevia.classList.remove("selected");
        }

        // Agregar selección a la fila actual
        fila.classList.add("selected");
    }
});
