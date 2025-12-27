import { formatearFecha, formatearFechaCompacta } from "../utils/textUtils.js";
import { SERVICIOS_NOMBRES } from "../config/constants.js";

// Map para rastrear el color de grupo de cada carpeta
const gruposPorCarpeta = new Map();
let contadorGrupo = 0;

const normalizarTipoError = (txt) => (txt || "").trim().toLowerCase();

const renderErrorItem = (errorText) => {
    const [tipoRaw] = errorText.split(":");
    const tipoError = (tipoRaw || "").trim() || "Error";
    const esAuthEvo = /cant\s+autorizaciones[^\n]*cant\s+evoluciones/i.test(
        errorText
    );
    const tipoFiltro = esAuthEvo
        ? "Cant autorizaciones ≠ cant evoluciones"
        : tipoError;
    const tipoNorm = normalizarTipoError(tipoFiltro);
    return `<div class="error-item" data-error-type="${tipoFiltro}" data-error-type-normalized="${tipoNorm}">• ${errorText}</div>`;
};

const renderErrorItems = (errors = []) =>
    errors && errors.length ? errors.map(renderErrorItem).join("") : "";

/**
 * Obtiene la clase de grupo para una carpeta
 */
function obtenerGrupoClase(carpeta) {
    if (!gruposPorCarpeta.has(carpeta)) {
        gruposPorCarpeta.set(
            carpeta,
            contadorGrupo % 2 === 0 ? "grupo-par" : "grupo-impar"
        );
        contadorGrupo++;
    }
    return gruposPorCarpeta.get(carpeta);
}

/**
 * Actualiza los encabezados de la tabla según el tipo de validación
 */
export function actualizarHeadersTabla(
    tabla,
    tablaHeader,
    tipoValidacion,
    tipoPaquete
) {
    // Resetear mapa de grupos
    gruposPorCarpeta.clear();
    contadorGrupo = 0;

    tabla.classList.remove(
        "modo-evento",
        "modo-paquete-fijo",
        "modo-paquete-dinamico"
    );

    if (tipoValidacion === "evento") {
        tabla.classList.add("modo-evento");
        tablaHeader.innerHTML = `
            <tr>
                <th>Tipo</th>
                <th>Carpeta</th>
                <th>2.pdf</th>
                <th>3.pdf</th>
                <th>4.pdf</th>
                <th>5.pdf</th>
                <th>Cantidad</th>
                <th>Evoluciones (Cantidad Y Detalle)</th>
                <th>Errores</th>
            </tr>
        `;

        // Remover colgroup anterior si existe
        let colgroup = tabla.querySelector("colgroup");
        if (colgroup) colgroup.remove();

        // Agregar colgroup para modo evento
        const colgroupHTML = `
            <colgroup>
                <col style="width: 100px;">
                <col style="width: 120px;">
                <col style="width: 50px;">
                <col style="width: 50px;">
                <col style="width: 50px;">
                <col style="width: 50px;">
                <col style="width: 60px;">
                <col style="width: 140px;">
                <col style="width: 220px;">
            </colgroup>
        `;
        tabla.insertAdjacentHTML("afterbegin", colgroupHTML);
    } else {
        // Ambos tipos de paquete usan el mismo formato dinámico
        tabla.classList.add("modo-paquete-dinamico");
        tablaHeader.innerHTML = `
            <tr>
                <th>Tipo</th>
                <th>Carpeta</th>
                <th>Servicios</th>
                <th>Autorizaciones</th>
                <th>Evoluciones</th>
                <th>Archivos</th>
                <th>Evoluciones Detalle</th>
                <th>Errores</th>
            </tr>
        `;

        // Remover colgroup anterior si existe
        let colgroup = tabla.querySelector("colgroup");
        if (colgroup) colgroup.remove();

        // Agregar colgroup para modo paquete
        const colgroupHTML = `
            <colgroup>
                <col style="width: 100px;">
                <col style="width: 130px;">
                <col style="width: 130px;">
                <col style="width: 70px;">
                <col style="width: 70px;">
                <col style="width: 130px;">
                <col style="width: 130px;">
                <col style="width: 220px;">
            </colgroup>
        `;
        tabla.insertAdjacentHTML("afterbegin", colgroupHTML);
    }
}

/**
 * Crea una fila placeholder con spinner
 */
export function createPlaceholderRow(
    tablaBody,
    carpeta,
    tipoValidacion,
    tipoPaquete
) {
    if (document.querySelector(`tr[data-carpeta="${carpeta}"]`)) return;

    const tr = document.createElement("tr");
    tr.setAttribute("data-carpeta", carpeta);
    tr.classList.add("processing");

    if (tipoValidacion === "paquete") {
        // Placeholder simple para paquete
        tr.innerHTML = `
            <td>—</td>
            <td>${carpeta} <span class="spinner" aria-hidden></span></td>
            <td>…</td>
            <td>…</td>
            <td>…</td>
            <td>…</td>
            <td>…</td>
            <td>—</td>
        `;
    } else {
        tr.innerHTML = `
            <td class="tipo">—</td>
            <td>${carpeta} <span class="spinner" aria-hidden></span></td>
            <td>…</td><td>…</td><td>…</td><td>…</td>
            <td class="count">0</td>
            <td class="fechas"><div class="fechas-list">—</div></td>
            <td class="errores">—</td>
        `;
    }

    tablaBody.appendChild(tr);
}

/**
 * Actualiza una fila existente de la tabla
 */
export function updateRow(tablaBody, carpeta, r) {
    // Para paquetes, eliminar las filas existentes del grupo y recrearlas
    if (r.tipoValidacion === "paquete") {
        const existingRows = document.querySelectorAll(
            `tr[data-carpeta="${carpeta}"]`
        );
        existingRows.forEach((row) => row.remove());
        return pintarFila(tablaBody, carpeta, r);
    }

    // Para eventos, actualizar la fila existente
    const existing = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
    if (!existing) return pintarFila(tablaBody, carpeta, r);

    const fechasUnicas = [...new Set(r.fechas)];
    const fechasFormateadas = fechasUnicas.map(formatearFecha);
    const scrollClass = fechasFormateadas.length > 4 ? "fechas-scroll" : "";
    const fechasPills = fechasFormateadas
        .map((f) => `<span class="fecha-text">${f}</span>`)
        .join("");

    const tipoDisplay = r.tipo || "—";

    // Combinar errores generales con errores del servicio "General" si existe
    let todosLosErrores = [...r.errores];
    if (r.servicios?.has("General") && r.erroresPorServicio?.["General"]) {
        todosLosErrores.push(...r.erroresPorServicio["General"]);
    }

    const erroresHTML = renderErrorItems(todosLosErrores) || "—";
    const isProcessing = existing.classList.contains("processing");

    existing.innerHTML = renderEvento(
        carpeta,
        r,
        tipoDisplay,
        fechasPills,
        erroresHTML,
        isProcessing,
        scrollClass
    );
}

/**
 * Pinta una nueva fila en la tabla
 */
export function pintarFila(tablaBody, carpeta, r) {
    const fechasUnicas = [...new Set(r.fechas)];
    const fechasFormateadas = fechasUnicas.map(formatearFecha);
    const scrollClass = fechasFormateadas.length > 4 ? "fechas-scroll" : "";
    const fechasPills = fechasFormateadas
        .map((f) => `<span class="fecha-text">${f}</span>`)
        .join("");

    const tipoDisplay = r.tipo || "—";
    const erroresHTML = renderErrorItems(r.errores) || "—";

    if (r.tipoValidacion === "paquete") {
        // Para paquete, crear una fila por servicio
        renderPaqueteFilas(tablaBody, carpeta, r, tipoDisplay, erroresHTML);
    } else {
        // Para eventos, si hay servicio "General", mostrar también esos errores
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.classList.remove("processing");

        // Combinar errores generales con errores del servicio "General" si existe
        let todosLosErrores = [...r.errores];
        if (r.servicios?.has("General") && r.erroresPorServicio?.["General"]) {
            todosLosErrores.push(...r.erroresPorServicio["General"]);
        }

        const erroresHTMLCompleto = renderErrorItems(todosLosErrores) || "—";

        // Determinar estado
        const tieneErrores = todosLosErrores.length > 0;
        const tieneAlertas = Object.values(r.alertasPorServicio || {}).some(
            (arr) => arr.length > 0
        );
        let estado = "sin-errores";
        if (tieneErrores) {
            estado = "con-errores";
        } else if (tieneAlertas) {
            estado = "con-alertas";
        }
        tr.setAttribute("data-estado", estado);

        tr.innerHTML = renderEvento(
            carpeta,
            r,
            tipoDisplay,
            fechasPills,
            erroresHTMLCompleto,
            false,
            scrollClass
        );
        tablaBody.appendChild(tr);
    }
}

// ================= HELPERS DE RENDERIZADO =================

/**
 * Renderiza filas de paquete - una fila por servicio
 */
function renderPaqueteFilas(tablaBody, carpeta, r, tipoDisplay, erroresHTML) {
    // Obtener clase de grupo para esta carpeta
    const grupoClase = obtenerGrupoClase(carpeta);

    // Orden personalizado de servicios: General primero, luego VM, ENF, TR, TF, y luego los demás
    const ordenServicios = [
        "General",
        "VM",
        "ENF",
        "TR",
        "TF",
        "SUCCION",
        "FON",
        "PSI",
        "TS",
        "TO",
    ];

    const serviciosArray = [...r.servicios].sort((a, b) => {
        const indexA = ordenServicios.indexOf(a);
        const indexB = ordenServicios.indexOf(b);

        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const erroresGenerales = r.errores || [];

    serviciosArray.forEach((s, index) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.setAttribute("data-servicio", s);
        tr.classList.add("paquete-row");
        tr.classList.add(grupoClase);

        // Marcar la primera fila del grupo para agregar espaciado
        if (index === 0) {
            tr.classList.add("grupo-inicio");
        }

        // Marcar la última fila del grupo
        if (index === serviciosArray.length - 1) {
            tr.classList.add("grupo-fin");
        }

        const fechas5 = r.fechasPorServicio[s] || [];
        const numero2 = r.numerosPorServicio?.[s] || "—";
        const cant5 = [...new Set(fechas5)].length;
        const servicioLower = s === "SUCCION" ? "succion" : s.toLowerCase();

        // Determinar estado para filtrado
        const erroresServicio = r.erroresPorServicio?.[s] || [];
        const alertasServicio = r.alertasPorServicio?.[s] || [];

        // Incluir errores generales una sola vez (en la primera fila del grupo)
        const erroresGeneralesFila = index === 0 ? erroresGenerales : [];

        const tieneErrores =
            erroresServicio.length > 0 || erroresGeneralesFila.length > 0;
        const tieneAlertas = alertasServicio.length > 0;

        let estado = "sin-errores";
        if (tieneErrores) {
            estado = "con-errores";
        } else if (tieneAlertas) {
            estado = "con-alertas";
        }
        tr.setAttribute("data-estado", estado);

        // Para "General", no mostrar archivos (es solo para validación general)
        let archivosHTML = "—";
        if (s !== "General") {
            // Mostrar siempre los archivos 2, 4, 5 (existan o no)
            const archivosEsperados = ["2", "4", "5"];
            archivosHTML = archivosEsperados
                .map((num) => {
                    const nombreArchivo = `${num} ${servicioLower}.pdf`;
                    // Buscar la URL sin importar mayúsculas/minúsculas
                    const urlKey = Object.keys(r.fileUrls).find(
                        (k) => k.toLowerCase() === nombreArchivo.toLowerCase()
                    );
                    const url = urlKey ? r.fileUrls[urlKey] : null;
                    const status = r.pdfsPorServicio[s]?.[num] || "—";
                    const cls =
                        status === "✔"
                            ? "ok"
                            : status === "—"
                            ? "missing"
                            : "fail";
                    const label = `${num} ${status}`;
                    if (url) {
                        return `<a href="#" onclick="abrirPDFModal('${url}', '${nombreArchivo}', this); return false;" class="archivo-link ${cls}" title="Abrir ${nombreArchivo}">${label}</a>`;
                    }
                    return `<span class="archivo-link ${cls}">${label}</span>`;
                })
                .join(" ");
        }

        // Formatear fechas con el mismo diseño que evento (pills)
        const fechasFormateadas = [...new Set(fechas5)].map(formatearFecha);
        const fechasPills = fechasFormateadas
            .map((f) => `<span class="fecha-text">${f}</span>`)
            .join("");
        const scrollClass = fechasFormateadas.length > 4 ? "fechas-scroll" : "";
        const fechasHTML =
            fechasFormateadas.length > 0
                ? `<div class="fechas-list ${scrollClass}">${fechasPills}</div>`
                : "—";

        const nombreCompleto = SERVICIOS_NOMBRES[s] || s;

        // Obtener errores, éxitos y alertas específicos del servicio para renderizar
        const erroresServicioRender = [
            ...(r.erroresPorServicio?.[s] || []),
            ...erroresGeneralesFila,
        ];
        const exitosServicio = r.exitosPorServicio?.[s] || [];
        const alertasServicioRender = r.alertasPorServicio?.[s] || [];

        // Ordenar validaciones exitosas por número de archivo (2, 4, 5)
        const ordenArchivo = { 2: 1, 4: 2, 5: 3 };
        const exitosOrdenados = [...exitosServicio].sort((a, b) => {
            const aNum =
                (a.match(/^(\d)\.pdf/) || [])[1] ||
                (a.match(/^(\d)\.pdf:/) || [])[1] ||
                "9";
            const bNum =
                (b.match(/^(\d)\.pdf/) || [])[1] ||
                (b.match(/^(\d)\.pdf:/) || [])[1] ||
                "9";
            return (ordenArchivo[aNum] || 9) - (ordenArchivo[bNum] || 9);
        });
        const exitosHTML = exitosOrdenados
            .map(
                (e) => `<div class="exito-item validacion-exitosa">✓ ${e}</div>`
            )
            .join("");
        const alertasHTML = alertasServicioRender
            .map((e) => `<div class="alerta-item">⚠ ${e}</div>`)
            .join("");
        const erroresHTML = renderErrorItems(erroresServicioRender);

        const erroresServicioHTML =
            exitosHTML || alertasHTML || erroresHTML
                ? exitosHTML + alertasHTML + erroresHTML
                : "—";

        // Todas las filas tienen 8 celdas con TIPO y CARPETA visibles
        tr.innerHTML = `
            <td>${tipoDisplay}</td>
            <td class="carpeta-cell"><span class="carpeta-nombre">${carpeta}
                <button class="copy-inline-btn" onclick="copiarNumero(event,'${carpeta}')" title="Copiar número" aria-label="Copiar número">📋</button>
            </span>
                <div class="carpeta-contenido">${(r.listaArchivos || [])
                    .map((a) => `<span class='archivo-mini'>${a}</span>`)
                    .join(" ")}</div>
            </td>
            <td class="servicio-nombre">${nombreCompleto}</td>
            <td>${numero2}</td>
            <td>${cant5}</td>
            <td>${archivosHTML || "—"}</td>
            <td>${fechasHTML}</td>
            <td>${erroresServicioHTML}</td>
        `;

        tablaBody.appendChild(tr);
    });
}

function renderEvento(
    carpeta,
    r,
    tipoDisplay,
    fechasPills,
    erroresHTML,
    isProcessing,
    scrollClass = ""
) {
    const pdfCells = ["2.pdf", "3.pdf", "4.pdf", "5.pdf"]
        .map((p) => {
            const url = r.fileUrls[p];
            const symbol = r.pdfs[p];
            const cls =
                symbol === "✔" ? "ok" : symbol === "—" ? "missing" : "fail";
            if (url) {
                return `<td class="${cls}"><a href="#" onclick="abrirPDFModal('${url}', '${p}', this); return false;" class="pdf-link" data-file="${p}" title="Abrir ${p}">${symbol}</a></td>`;
            }
            return `<td class="${cls}">${symbol}</td>`;
        })
        .join("");

    const fechasUnicas = [...new Set(r.fechas)];

    return `
        <td class="tipo">${tipoDisplay}</td>
        <td class="carpeta-cell"><span class="carpeta-nombre">${carpeta} ${
        isProcessing ? '<span class="spinner"></span>' : ""
    }
                <button class="copy-inline-btn" onclick="copiarNumero(event,'${carpeta}')" title="Copiar número" aria-label="Copiar número">📋</button>
            </span>
            <div class="carpeta-contenido">${(r.listaArchivos || [])
                .map((a) => `<span class='archivo-mini'>${a}</span>`)
                .join(" ")}</div>
        </td>
        ${pdfCells}
        <td class="count">${fechasUnicas.length}</td>
        <td class="fechas"><div class="fechas-list ${scrollClass}">${
        fechasPills || "—"
    }</div></td>
        <td class="errores">${erroresHTML}</td>
    `;
}
