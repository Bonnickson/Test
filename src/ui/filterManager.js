import { SERVICIOS_NOMBRES } from "../config/constants.js";
import {
    copiarTextoAlPortapapeles,
    mostrarToastCopia,
} from "../utils/clipboardUtils.js";

/**
 * Normaliza el tipo de error para comparaciones consistentes
 */
export const normalizarTipoError = (txt) => (txt || "").trim().toLowerCase();

/**
 * Agrupa errores similares bajo un tipo general y catalogado
 */
export function clasificarErrorResumen(error) {
    const errorStr = (error || "").trim();

    // 1. Paciente programado en la matriz pero sin carpeta de soportes
    if (/No se encontr[oó] carpeta de soportes/i.test(errorStr)) {
        return {
            tipo: "Matriz programada no encuentra soportes",
            detalle: "Paciente está en matriz pero falta su carpeta de archivos",
        };
    }

    // 2. Carpeta física que no está en la matriz cargada
    if (/no se encuentra programado en la matriz/i.test(errorStr) || /No se encuentra cargado en matriz/i.test(errorStr) || /no est[aá] en la matriz/i.test(errorStr) || /no figura en la matriz/i.test(errorStr) || /no encontrado en matriz/i.test(errorStr)) {
        return {
            tipo: "No se encuentra programado en matriz",
            detalle: "El documento de la carpeta no figura en la matriz cargada",
        };
    }

    // 3. Matriz programa N sesiones de un servicio pero no se encontró el PDF
    if (/Matriz programa \d+ de .+, pero NO se encontr[oó] soporte/i.test(errorStr)) {
        return {
            tipo: "Falta PDF programado en matriz",
            detalle: "La matriz programa el servicio pero falta el soporte 5 [srv].pdf",
        };
    }

    // 4. Discrepancia entre evoluciones encontradas y matriz
    if (/Discrepancia en /i.test(errorStr) || /Matriz espera \d+ evoluciones/i.test(errorStr)) {
        return {
            tipo: "Discrepancia evoluciones vs matriz",
            detalle: "Cantidad de fechas en 5.pdf difiere de lo programado en matriz",
        };
    }

    // 5. Soporte en carpeta no programado en la matriz (matriz en 0)
    if (/Soporte no programado/i.test(errorStr) || /en la matriz est[aá] en 0/i.test(errorStr)) {
        return {
            tipo: "Soporte no programado en matriz",
            detalle: "Se encontró soporte pero en matriz está en 0 o vacío",
        };
    }

    // 6. Reglas de cantidad de paquete CPF (mínimo, máximo o exactamente X)
    if (/Paquete CPF\w+ debe tener/i.test(errorStr)) {
        return {
            tipo: "Incumple regla de cantidad de paquete",
            detalle: "No cumple con el número de evoluciones o terapias del paquete",
        };
    }

    // 7. No contiene número de documento
    if (/no contiene n[uú]mero/i.test(errorStr) || /no coincide con documento/i.test(errorStr)) {
        return {
            tipo: "Documento no coincide en PDF",
            detalle: "El número de documento no fue detectado en el archivo PDF",
        };
    }

    // 8. No contiene texto requerido / regla de servicio
    if (/no contiene el texto requerido/i.test(errorStr) || /no contiene ninguno de los textos/i.test(errorStr)) {
        return {
            tipo: "Falta texto requerido de servicio",
            detalle: "El soporte no incluye la leyenda obligatoria del servicio",
        };
    }

    // 9. Cant autorizaciones ≠ cant evoluciones (Capital Salud / FOMAG evento)
    const authEvoRegex = /cant\s+autorizaciones[^\n]*cant\s+evoluciones/i;
    if (authEvoRegex.test(errorStr)) {
        return {
            tipo: "Cant autorizaciones ≠ cant evoluciones",
            detalle: "Revisar que las autorizaciones coincidan con las evoluciones",
        };
    }

    // Fallback general: separar por dos puntos si existe
    const [tipoRaw, ...resto] = errorStr.split(":");
    const tipo = (tipoRaw || "").trim() || "Otras incidencias";
    const detalle = resto.join(":").trim();
    return { tipo, detalle };
}

/**
 * Actualiza la barra de progreso
 */
export function actualizarProgreso(actual, total, carpeta = "", archivo = "", elements = {}) {
    const { progresoFill, progresoPorcentaje, progresoTexto, progresoDetalle } = elements;
    const porcentaje = Math.round((actual / total) * 100);

    if (progresoFill) progresoFill.style.width = `${porcentaje}%`;
    if (progresoPorcentaje) progresoPorcentaje.textContent = `${porcentaje}%`;
    if (progresoTexto) progresoTexto.textContent = `Procesando ${actual} de ${total} carpetas`;

    if (progresoDetalle) {
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
}

/**
 * Aplica los filtros de búsqueda, servicio, estado y tipo de error a la tabla
 */
export function aplicarFiltros(elements = {}, state = {}) {
    const {
        buscarDocumentoInput,
        filtroServicioSelect,
        mostrarExitosCheckbox,
        tablaBody,
    } = elements;

    if (!tablaBody) return;

    const buscarDoc = buscarDocumentoInput ? buscarDocumentoInput.value.trim().toLowerCase() : "";
    const filtroServ = filtroServicioSelect ? filtroServicioSelect.value : "";
    const filtroEst = state.estadoFiltroActivo || "";
    const mostrarExitos = mostrarExitosCheckbox ? mostrarExitosCheckbox.checked : false;
    const tiposErroresActivos = new Set(state.erroresSeleccionados || []);

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

    Object.entries(filasPorCarpeta).forEach(([carpeta, filasCarpeta]) => {
        let mostrarCarpeta = true;
        if (buscarDoc && !carpeta.toLowerCase().includes(buscarDoc)) {
            mostrarCarpeta = false;
        }

        const filasVisibles = [];
        filasCarpeta.forEach((fila) => {
            let mostrarFila = mostrarCarpeta;

            if (filtroServ && mostrarFila) {
                const servicioFila = fila.getAttribute("data-servicio");
                if (servicioFila) {
                    const coincide =
                        servicioFila === filtroServ ||
                        ((filtroServ === "TRS" || filtroServ === "SUCCION") &&
                            (servicioFila === "TRS" || servicioFila === "SUCCION"));
                    if (!coincide) {
                        mostrarFila = false;
                    }
                }
            }

            if (filtroEst && mostrarFila) {
                const estadoFila = fila.getAttribute("data-estado");
                const esMatrizVirtual = fila.hasAttribute("data-es-matriz") || 
                    (carpeta && carpeta in (window.__todosLosResultados || {}) && window.__todosLosResultados[carpeta]?.esDesdeMatriz) ||
                    (fila.querySelector(".pkg-cpf1109 svg, .doc-package-tag svg path") && fila.querySelector(".carpeta-files-badge")?.textContent?.includes("0 soportes"));

                if (filtroEst === "con-novedades") {
                    if (estadoFila === "sin-errores") {
                        mostrarFila = false;
                    }
                } else if (filtroEst === "carpetas-vs-matriz") {
                    // Carpetas cargadas que tienen novedades o errores
                    const tieneNovedades = estadoFila !== "sin-errores";
                    if (!tieneNovedades || esMatrizVirtual) {
                        mostrarFila = false;
                    }
                } else if (filtroEst === "matriz-vs-carpetas") {
                    // Pacientes de la matriz que no tienen carpeta
                    if (!esMatrizVirtual) {
                        mostrarFila = false;
                    }
                } else if (estadoFila !== filtroEst) {
                    mostrarFila = false;
                }
            }

            if (tiposErroresActivos.size > 0 && mostrarFila) {
                const erroresFila = fila.querySelectorAll(
                    ".error-item[data-error-type]"
                );
                const coincide = Array.from(erroresFila).some((err) => {
                    const tNorm =
                        err.getAttribute("data-error-type-normalized") ||
                        normalizarTipoError(
                            err.getAttribute("data-error-type") || ""
                        );
                    return tiposErroresActivos.has(tNorm);
                });
                if (!coincide) {
                    mostrarFila = false;
                }
            }

            if (mostrarFila) {
                fila.style.display = "";
                filasVisibles.push(fila);
            } else {
                fila.style.display = "none";
            }
        });

        // Recalcular rowspan para la celda agrupada de la carpeta
        let cellCarpeta = null;
        for (const fila of filasCarpeta) {
            const cell = fila.querySelector("td.carpeta-cell.doc-header-grouped");
            if (cell) {
                cellCarpeta = cell;
                break;
            }
        }

            if (cellCarpeta) {
                if (filasVisibles.length > 0) {
                    const primeraVisible = filasVisibles[0];
                    if (!primeraVisible.contains(cellCarpeta)) {
                        primeraVisible.insertAdjacentElement("afterbegin", cellCarpeta);
                    }
                    cellCarpeta.setAttribute("rowspan", filasVisibles.length);
                    cellCarpeta.style.display = "";
                } else {
                    const headerRow = filasCarpeta[0];
                    if (headerRow && !headerRow.contains(cellCarpeta)) {
                        headerRow.insertAdjacentElement("afterbegin", cellCarpeta);
                    }
                    cellCarpeta.setAttribute("rowspan", filasCarpeta.length);
                }
            }
        });

        // Ordenar grupos de carpetas en la tabla según la opción activa
        const ordenarSelect = document.getElementById("ordenarTabla");
        const criterio = ordenarSelect ? ordenarSelect.value : "paquete";

        const ordenadas = Object.keys(filasPorCarpeta).sort((a, b) => {
            const fA = filasPorCarpeta[a][0];
            const fB = filasPorCarpeta[b][0];

            const docA = (fA?.getAttribute("data-documento") || a).trim();
            const docB = (fB?.getAttribute("data-documento") || b).trim();
            const paqA = (fA?.getAttribute("data-paquete") || "").trim();
            const paqB = (fB?.getAttribute("data-paquete") || "").trim();
            const respA = (fA?.getAttribute("data-responsable") || "").trim();
            const respB = (fB?.getAttribute("data-responsable") || "").trim();

            if (criterio === "documento") {
                return docA.localeCompare(docB, undefined, { numeric: true });
            }
            if (criterio === "responsable") {
                const cmp = respA.localeCompare(respB);
                return cmp !== 0 ? cmp : docA.localeCompare(docB, undefined, { numeric: true });
            }
            // Por defecto: paquete
            const cmpP = paqA.localeCompare(paqB);
            return cmpP !== 0 ? cmpP : docA.localeCompare(docB, undefined, { numeric: true });
        });

        ordenadas.forEach((carp) => {
            filasPorCarpeta[carp].forEach((fila) => tablaBody.appendChild(fila));
        });

        const exitosItems = document.querySelectorAll(".validacion-exitosa");
        exitosItems.forEach((item) => {
            item.style.display = mostrarExitos ? "" : "none";
        });
    }

/**
 * Copia todos los errores visibles en la tabla con el formato:
 * Paquete - Documento - Servicio - Archivo - Error
 */
export async function copiarTodosErroresVisibles(resultadosGlobales) {
    const tablaBody = document.querySelector("#tabla tbody");
    const carpetasVisibles = new Set();

    if (tablaBody) {
        const filas = Array.from(tablaBody.querySelectorAll("tr"));
        filas.forEach((tr) => {
            if (tr.style.display !== "none") {
                const c = tr.getAttribute("data-carpeta");
                if (c) carpetasVisibles.add(c);
            }
        });
    }

    if (carpetasVisibles.size === 0 && resultadosGlobales) {
        Object.keys(resultadosGlobales).forEach((c) => carpetasVisibles.add(c));
    }

    if (carpetasVisibles.size === 0) {
        mostrarToastCopia("No hay expedientes con errores visibles");
        return;
    }

    const lineas = [];

    carpetasVisibles.forEach((carpeta) => {
        const r = resultadosGlobales && resultadosGlobales[carpeta]
            ? resultadosGlobales[carpeta]
            : Object.values(resultadosGlobales || {}).find(item => item.carpetaNombre === carpeta || item.nroDocumento === carpeta);

        if (!r) return;

        const pkg = r?.tipoPaquete || r?.tipo || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
        const doc = r?.nroDocumento || carpeta;
        const prefijo = `${pkg} - ${doc}`;

        // 1. Errores generales / de paquete
        const errsGen = [...(r.errores || []), ...(r.erroresPorServicio?.["General"] || [])];
        const alertsGen = [...(r.alertas || []), ...(r.alertasPorServicio?.["General"] || [])];
        const todosGen = [...new Set([...errsGen, ...alertsGen])];

        todosGen.forEach((err) => {
            const fileMatch = err.match(/\b([0-9A-Za-z_-]+(?:\s+[0-9A-Za-z_-]+)?\.pdf)\b/i);
            const archivo = fileMatch ? fileMatch[1] : (r.pdfsPorServicio?.["General"] ? Object.keys(r.pdfsPorServicio["General"]).join(", ") : "2 PAQ.pdf");
            lineas.push(`${prefijo} - 📦 Paquete - ${archivo} - ${err.trim()}`);
        });

        // 2. Errores por servicio
        const servicios = [...(r.servicios || [])];
        servicios.forEach((s) => {
            if (s === "General") return;
            const sNombre = SERVICIOS_NOMBRES[s] || s;
            const errs = r.erroresPorServicio?.[s] || [];
            const alerts = r.alertasPorServicio?.[s] || [];
            const all = [...new Set([...errs, ...alerts])];

            all.forEach((err) => {
                const fileMatch = err.match(/\b([0-9A-Za-z_-]+(?:\s+[0-9A-Za-z_-]+)?\.pdf)\b/i);
                let archivo = fileMatch ? fileMatch[1] : "";
                if (!archivo) {
                    const pdfs = r.pdfsPorServicio?.[s] || {};
                    const pdfKeys = Object.keys(pdfs);
                    archivo = pdfKeys.length > 0 ? pdfKeys.join(", ") : "N/A";
                }
                lineas.push(`${prefijo} - ${sNombre} - ${archivo} - ${err.trim()}`);
            });
        });
    });

    if (lineas.length === 0) {
        mostrarToastCopia("No se encontraron errores en los expedientes visibles");
        return;
    }

    const textoFinal = lineas.join("\n");
    await copiarTextoAlPortapapeles(textoFinal);
    mostrarToastCopia(`${lineas.length} errores copiados`);

    const btn = document.getElementById("btnCopiarTodosErrores");
    if (btn) {
        const origHTML = btn.innerHTML;
        btn.innerHTML = `✓ ${lineas.length} Copiados`;
        btn.style.color = "#10b981";
        setTimeout(() => {
            btn.innerHTML = origHTML;
            btn.style.color = "";
        }, 2200);
    }
}

/**
 * Reinicia todos los filtros a su estado por defecto
 */
export function reiniciarFiltros(elements = {}, state = {}, ejecutarAplicar = true) {
    const {
        buscarDocumentoInput,
        filtroServicioSelect,
        grupoFiltroEstado,
        mostrarExitosCheckbox,
        listaErroresDiv,
    } = elements;

    if (buscarDocumentoInput) buscarDocumentoInput.value = "";
    if (filtroServicioSelect) filtroServicioSelect.value = "";
    state.estadoFiltroActivo = "";

    if (grupoFiltroEstado) {
        grupoFiltroEstado.querySelectorAll(".btn-segmented").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-estado") === "");
        });
    }

    if (mostrarExitosCheckbox) mostrarExitosCheckbox.checked = false;
    if (state.erroresSeleccionados) state.erroresSeleccionados.clear();

    const btnCopiar = document.getElementById("btnCopiarIncidenciasSeleccionadas");
    if (btnCopiar) btnCopiar.classList.add("oculto");

    if (listaErroresDiv) {
        listaErroresDiv
            .querySelectorAll(".error-tipo-item.selected, .error-card-pill.selected")
            .forEach((el) => el.classList.remove("selected"));
    }

    if (ejecutarAplicar) {
        aplicarFiltros(elements, state);
    }
}

/**
 * Actualiza el resumen estadístico y la cuadrícula de incidencias
 */
export function actualizarResumen(
    resultados,
    elements = {},
    state = {},
    incremental = false,
    onExportarErroresCallback = null
) {
    const {
        resumenDiv,
        filtrosDiv,
        resumenErroresDiv,
        listaErroresDiv,
    } = elements;

    const carpetas = Object.keys(resultados);
    const total = carpetas.length;

    let sinErrores = 0;
    let conAlertas = 0;
    let conErrores = 0;
    const erroresPorTipo = {};
    const detallePorTipo = {};
    const carpetasPorTipo = {};

    carpetas.forEach((carpeta) => {
        const r = resultados[carpeta];
        const todosLosErrores = [...(r.errores || [])];
        Object.values(r.erroresPorServicio || {}).forEach((arr) => {
            todosLosErrores.push(...arr);
        });

        if (!incremental) {
            const tiposProcesadosEnEstaCarpeta = new Set();
            todosLosErrores.forEach((error) => {
                const { tipo, detalle } = clasificarErrorResumen(error);
                const tipoNorm = normalizarTipoError(tipo);

                erroresPorTipo[tipo] = (erroresPorTipo[tipo] || 0) + 1;
                if (!detallePorTipo[tipo] && detalle) {
                    detallePorTipo[tipo] = detalle;
                }

                if (!carpetasPorTipo[tipo]) {
                    carpetasPorTipo[tipo] = new Set();
                }
                carpetasPorTipo[tipo].add(carpeta);
                tiposProcesadosEnEstaCarpeta.add(tipoNorm);
            });
        }

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

    const statTotal = document.getElementById("statTotal");
    const statExito = document.getElementById("statExito");
    const statAlertas = document.getElementById("statAlertas");
    const statErrores = document.getElementById("statErrores");

    if (statTotal) statTotal.textContent = total;
    if (statExito) statExito.textContent = sinErrores;
    if (statAlertas) statAlertas.textContent = conAlertas;
    if (statErrores) statErrores.textContent = conErrores;

    if (resumenDiv) resumenDiv.classList.remove("oculto");

    if (incremental) return;

    if (Object.keys(erroresPorTipo).length > 0 && listaErroresDiv) {
        const tiposDisponibles = new Set(
            Object.keys(erroresPorTipo).map(normalizarTipoError)
        );
        if (state.erroresSeleccionados) {
            [...state.erroresSeleccionados].forEach((t) => {
                if (!tiposDisponibles.has(t)) {
                    state.erroresSeleccionados.delete(t);
                }
            });
        }

        const errorItems = Object.entries(erroresPorTipo)
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, count]) => {
                const tipoNorm = normalizarTipoError(tipo);
                const seleccionado = state.erroresSeleccionados && state.erroresSeleccionados.has(tipoNorm)
                    ? " selected"
                    : "";

                const totalCarpetasConEsteError = (carpetasPorTipo[tipo] || []).size;
                const subtitulo = detallePorTipo[tipo] || "Incidencia detectada en la auditoría";

                // Icono temático según categoría
                let iconoIncidencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-card-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
                if (tipoNorm.includes("matriz programada no encuentra")) {
                    iconoIncidencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-card-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
                } else if (tipoNorm.includes("no se encuentra programado")) {
                    iconoIncidencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-card-icon"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
                } else if (tipoNorm.includes("discrepancia")) {
                    iconoIncidencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-card-icon"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
                } else if (tipoNorm.includes("falta pdf") || tipoNorm.includes("falta texto")) {
                    iconoIncidencia = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-card-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
                }

                return `<div class="error-card-pill${seleccionado}" data-tipo="${tipo}" data-tipo-normalized="${tipoNorm}" title="Click para filtrar por: ${tipo} (${totalCarpetasConEsteError} expedientes)">
                    <div class="error-card-leading">
                        ${iconoIncidencia}
                    </div>
                    <div class="error-card-body">
                        <div class="error-card-title">${tipo}</div>
                        <div class="error-card-subtitle">${subtitulo}</div>
                    </div>
                    <div class="error-card-badge" title="${count} incidencias">${count}</div>
                </div>`;
            })
            .join("");

        const totalSeleccionados = state.erroresSeleccionados ? state.erroresSeleccionados.size : 0;
        const exportBtnHtml = `
            <div class="resumen-toolbar">
                <div class="resumen-title-group">
                    <span class="resumen-counter-badge">${Object.keys(erroresPorTipo).length}</span>
                    <span class="resumen-counter-text">Tipos de incidencias catalogadas</span>
                </div>
                <div class="resumen-actions-group" style="display:flex;align-items:center;gap:6px;">
                    <button id="btnCopiarIncidenciasSeleccionadas" class="btn-studio btn-studio-primary ${totalSeleccionados > 0 ? '' : 'oculto'}" style="padding: 4px 10px; width: auto; font-size: 11px; background:#ef4444; border-color:#dc2626;" title="Copiar mensaje con los documentos de las incidencias seleccionadas">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar listado (${totalSeleccionados})
                    </button>
                    <button id="btnExportarErrores" class="btn-studio btn-studio-ghost" style="padding: 4px 9px; width: auto; font-size: 11px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="13"></line></svg>
                        Exportar XLSX
                    </button>
                </div>
            </div>
        `;

        listaErroresDiv.innerHTML = exportBtnHtml + `<div class="error-cards-grid">${errorItems}</div>`;
        if (resumenErroresDiv) {
            resumenErroresDiv.classList.remove("oculto");
            // Asegurar que el resizer esté al final del contenedor resumenErrores
            let resizer = resumenErroresDiv.querySelector(":scope > #resumenResizer");
            if (!resizer) {
                resizer = document.createElement("div");
                resizer.id = "resumenResizer";
                resizer.className = "resumen-resizer";
                resizer.title = "Arrastra verticalmente para redimensionar el panel de incidencias";
                resizer.innerHTML = `<div class="resizer-grip"></div>`;
                resumenErroresDiv.appendChild(resizer);
            }
        }

        const btnExport = document.getElementById("btnExportarErrores");
        if (btnExport && typeof onExportarErroresCallback === "function") {
            btnExport.addEventListener("click", (e) => {
                e.stopPropagation();
                onExportarErroresCallback(erroresPorTipo, detallePorTipo, carpetasPorTipo);
            });
        }

        const btnCopiar = document.getElementById("btnCopiarIncidenciasSeleccionadas");
        if (btnCopiar) {
            btnCopiar.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!state.erroresSeleccionados || state.erroresSeleccionados.size === 0) return;

                const lineasReporte = [];
                const tiposSeleccionados = Array.from(state.erroresSeleccionados);

                tiposSeleccionados.forEach((tipoNorm) => {
                    const tipoOriginal = Object.keys(erroresPorTipo).find(
                        (t) => normalizarTipoError(t) === tipoNorm
                    ) || tipoNorm;

                    lineasReporte.push(`*${tipoOriginal}*`);

                    const carpetasAfectadas = Array.from(carpetasPorTipo[tipoOriginal] || []);
                    carpetasAfectadas.forEach((carp) => {
                        const r = resultados[carp];
                        const pkg = r?.tipoPaquete || r?.tipo || "PAQUETE";
                        const doc = r?.nroDocumento || carp.replace(/^(\d+).*/, "$1") || carp;

                        // Extraer los errores específicos de este documento que corresponden a este tipo
                        const todosLosErroresCarp = [...(r?.errores || [])];
                        Object.values(r?.erroresPorServicio || {}).forEach((arr) => {
                            todosLosErroresCarp.push(...arr);
                        });

                        const erroresCoincidentes = todosLosErroresCarp.filter((err) => {
                            const { tipo } = clasificarErrorResumen(err);
                            return normalizarTipoError(tipo) === tipoNorm;
                        });

                        const detalleErrorTexto = erroresCoincidentes.length > 0
                            ? erroresCoincidentes.join(" | ")
                            : (detallePorTipo[tipoOriginal] || tipoOriginal);

                        // Si existe auditor/subcarpeta superior, incluirlo al inicio
                        const auditorTexto = r?.auditor ? `${r.auditor} - ` : "";

                        lineasReporte.push(`${auditorTexto}${pkg} - ${doc} - ${detalleErrorTexto}`);
                    });
                    lineasReporte.push(""); // línea en blanco entre tipos
                });

                const textoFinal = lineasReporte.join("\n").trim();
                try {
                    await navigator.clipboard.writeText(textoFinal);
                    const originalHTML = btnCopiar.innerHTML;
                    btnCopiar.innerHTML = `✓ ¡Copiado al portapapeles!`;
                    btnCopiar.style.background = "#10b981";
                    btnCopiar.style.borderColor = "#059669";
                    setTimeout(() => {
                        btnCopiar.innerHTML = originalHTML;
                        btnCopiar.style.background = "#ef4444";
                        btnCopiar.style.borderColor = "#dc2626";
                    }, 2000);
                } catch (err) {
                    console.error("Error al copiar al portapapeles:", err);
                    prompt("Copia el texto del reporte:", textoFinal);
                }
            });
        }
    } else if (resumenErroresDiv) {
        resumenErroresDiv.classList.add("oculto");
    }

    if (filtrosDiv) filtrosDiv.classList.remove("oculto");
    aplicarFiltros(elements, state);
}
