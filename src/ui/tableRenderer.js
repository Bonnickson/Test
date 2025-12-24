import { formatearFecha, formatearFechaCompacta } from "../utils/textUtils.js";
import { SERVICIOS_NOMBRES } from "../config/constants.js";

/**
 * Actualiza los encabezados de la tabla según el tipo de validación
 */
export function actualizarHeadersTabla(
    tabla,
    tablaHeader,
    tipoValidacion,
    tipoPaquete
) {
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
                <th>Cant.</th>
                <th>Fechas (cantidad y detalle)</th>
                <th>Errores</th>
            </tr>
        `;
    } else {
        // Ambos tipos de paquete usan el mismo formato dinámico
        tabla.classList.add("modo-paquete-dinamico");
        tablaHeader.innerHTML = `
            <tr>
                <th>Tipo</th>
                <th>Carpeta</th>
                <th>Servicios</th>
                <th>Cant HC</th>
                <th>Archivos</th>
                <th>Cant Auto</th>
                <th>Fechas</th>
                <th>Errores</th>
            </tr>
        `;
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
    const erroresHTML = r.errores.length
        ? r.errores.map((e) => `<div class="error-item">• ${e}</div>`).join("")
        : "—";
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
    const erroresHTML = r.errores.length
        ? r.errores.map((e) => `<div class="error-item">• ${e}</div>`).join("")
        : "—";

    if (r.tipoValidacion === "paquete") {
        // Para paquete, crear una fila por servicio
        renderPaqueteFilas(tablaBody, carpeta, r, tipoDisplay, erroresHTML);
    } else {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.classList.remove("processing");
        tr.innerHTML = renderEvento(
            carpeta,
            r,
            tipoDisplay,
            fechasPills,
            erroresHTML,
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
    // Orden personalizado de servicios
    const ordenServicios = ["VM", "ENFERMERIA", "TR", "TF", "PSICOLOGIA", "TS"];

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

    serviciosArray.forEach((s, index) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.classList.add("paquete-row");

        const fechas5 = r.fechasPorServicio[s] || [];
        const cant5 = [...new Set(fechas5)].length;
        const numero2 = r.numerosPorServicio?.[s] || "—";
        const servicioLower = s === "SUCCION" ? "succion" : s.toLowerCase();

        // Mostrar siempre los archivos 2, 4, 5 (existan o no)
        const archivosEsperados = ["2", "4", "5"];
        const archivosHTML = archivosEsperados
            .map((num) => {
                const nombreArchivo = `${num} ${servicioLower}.pdf`;
                // Buscar la URL sin importar mayúsculas/minúsculas
                const urlKey = Object.keys(r.fileUrls).find(
                    (k) => k.toLowerCase() === nombreArchivo.toLowerCase()
                );
                const url = urlKey ? r.fileUrls[urlKey] : null;
                const status = r.pdfsPorServicio[s]?.[num] || "—";
                const cls =
                    status === "✔" ? "ok" : status === "—" ? "missing" : "fail";
                const label = `${num} ${status}`;
                if (url) {
                    return `<a href="${url}" target="_blank" class="archivo-link ${cls}" title="Abrir ${nombreArchivo}">${label}</a>`;
                }
                return `<span class="archivo-link ${cls}">${label}</span>`;
            })
            .join(" ");

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

        // Obtener errores, éxitos y alertas específicos del servicio
        const erroresServicio = r.erroresPorServicio?.[s] || [];
        const exitosServicio = r.exitosPorServicio?.[s] || [];
        const alertasServicio = r.alertasPorServicio?.[s] || [];

        const exitosHTML = exitosServicio
            .map((e) => `<div class="exito-item">✓ ${e}</div>`)
            .join("");
        const alertasHTML = alertasServicio
            .map((e) => `<div class="alerta-item">⚠ ${e}</div>`)
            .join("");
        const erroresHTML = erroresServicio
            .map((e) => `<div class="error-item">• ${e}</div>`)
            .join("");

        const erroresServicioHTML =
            exitosHTML || alertasHTML || erroresHTML
                ? exitosHTML + alertasHTML + erroresHTML
                : "—";

        // Solo mostrar tipo y carpeta en la primera fila
        if (index === 0) {
            tr.innerHTML = `
                <td rowspan="${serviciosArray.length}">${tipoDisplay}</td>
                <td rowspan="${serviciosArray.length}">${carpeta}</td>
                <td>${nombreCompleto}</td>
                <td>${cant5}</td>
                <td>${archivosHTML || "—"}</td>
                <td>${numero2}</td>
                <td>${fechasHTML}</td>
                <td>${erroresServicioHTML}</td>
            `;
        } else {
            tr.innerHTML = `
                <td>${nombreCompleto}</td>
                <td>${cant5}</td>
                <td>${archivosHTML || "—"}</td>
                <td>${numero2}</td>
                <td>${fechasHTML}</td>
                <td>${erroresServicioHTML}</td>
            `;
        }

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
                return `<td class="${cls}"><a href="${url}" target="_blank" class="pdf-link" data-file="${p}">${symbol}</a></td>`;
            }
            return `<td class="${cls}">${symbol}</td>`;
        })
        .join("");

    const fechasUnicas = [...new Set(r.fechas)];

    return `
        <td class="tipo">${tipoDisplay}</td>
        <td>${carpeta} ${
        isProcessing ? '<span class="spinner"></span>' : ""
    }</td>
        ${pdfCells}
        <td class="count">${fechasUnicas.length}</td>
        <td class="fechas"><div class="fechas-list ${scrollClass}">${
        fechasPills || "—"
    }</div></td>
        <td class="errores">${erroresHTML}</td>
    `;
}
