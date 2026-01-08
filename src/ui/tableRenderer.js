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
    tipoPaquete,
    convenio = "capital-salud"
) {
    // Resetear mapa de grupos
    gruposPorCarpeta.clear();
    contadorGrupo = 0;

    tabla.classList.remove(
        "modo-evento",
        "modo-evento-fomag",
        "modo-paquete-fijo",
        "modo-paquete-dinamico"
    );

    // Remover colgroup anterior si existe
    let colgroup = tabla.querySelector("colgroup");
    if (colgroup) colgroup.remove();

    if (tipoValidacion === "evento" && convenio === "fomag") {
        // Evento FOMAG: vista por servicios (similar a paquete)
        tabla.classList.add("modo-evento-fomag");
        tablaHeader.innerHTML = `
            <tr>
                <th>Carpeta</th>
                <th>Servicio</th>
                <th>Archivos</th>
                <th>Cant Auto</th>
                <th>Cant Evol</th>
                <th>Evoluciones</th>
                <th>Errores</th>
            </tr>
        `;
        const colgroupHTML = `
            <colgroup>
                <col style="width: 120px;">
                <col style="width: 140px;">
                <col style="width: 150px;">
                <col style="width: 70px;">
                <col style="width: 70px;">
                <col style="width: 140px;">
                <col style="width: 280px;">
            </colgroup>
        `;
        tabla.insertAdjacentHTML("afterbegin", colgroupHTML);
    } else if (tipoValidacion === "evento") {
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
export function updateRow(tablaBody, carpeta, r, mostrarExitos = false) {
    // Para paquetes o eventos FOMAG, eliminar las filas existentes del grupo y recrearlas
    if (
        r.tipoValidacion === "paquete" ||
        (r.tipoValidacion === "evento" && r.convenio === "fomag")
    ) {
        const existingRows = document.querySelectorAll(
            `tr[data-carpeta="${carpeta}"]`
        );
        existingRows.forEach((row) => row.remove());
        return pintarFila(tablaBody, carpeta, r, mostrarExitos);
    }

    // Para eventos normales, actualizar la fila existente
    const existing = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
    if (!existing) return pintarFila(tablaBody, carpeta, r, mostrarExitos);

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
export function pintarFila(tablaBody, carpeta, r, mostrarExitos = false) {
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
        renderPaqueteFilas(
            tablaBody,
            carpeta,
            r,
            tipoDisplay,
            erroresHTML,
            mostrarExitos
        );
    } else if (r.tipoValidacion === "evento" && r.convenio === "fomag") {
        // Para eventos FOMAG, crear filas por servicio detectado
        renderEventoFomagFilas(tablaBody, carpeta, r, mostrarExitos);
    } else {
        // Para eventos normales (Capital Salud), mostrar vista clásica
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
function renderPaqueteFilas(
    tablaBody,
    carpeta,
    r,
    tipoDisplay,
    erroresHTML,
    mostrarExitos = false
) {
    // Obtener clase de grupo para esta carpeta
    const grupoClase = obtenerGrupoClase(carpeta);

    // Orden personalizado de servicios: General primero, luego VM, ENF, TR, TF, y luego los demás
    const ordenServicios = [
        "General",
        "VM",
        "ENF",
        "ENF12",
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
                (e) =>
                    `<div class="exito-item validacion-exitosa" style="display: ${
                        mostrarExitos ? "" : "none"
                    }">✓ ${e}</div>`
            )
            .join("");
        const alertasHTML = alertasServicioRender
            .map((e) => `<div class="alerta-item">⚠ ${e}</div>`)
            .join("");
        const erroresHTML = renderErrorItems(erroresServicioRender);

        // Si solo hay éxitos (sin errores ni alertas), agregar badge verde
        const soloExitos = exitosHTML && !alertasHTML && !erroresHTML;
        const badgeExito = soloExitos
            ? `<div class="badge-exito">✔ Todo correcto</div>`
            : "";

        const erroresServicioHTML =
            exitosHTML || alertasHTML || erroresHTML || badgeExito
                ? badgeExito + exitosHTML + alertasHTML + erroresHTML
                : "—";

        // Agregar clase especial si solo tiene éxitos (sin errores ni alertas)
        if (soloExitos) {
            tr.classList.add("solo-exitos");
        }

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

/**
 * Renderiza filas de evento FOMAG - una fila por servicio detectado
 */
function renderEventoFomagFilas(tablaBody, carpeta, r, mostrarExitos = false) {
    const grupoClase = obtenerGrupoClase(carpeta);

    // Detectar servicios desde los nombres de archivos
    const serviciosDetectados = new Set();
    const archivosPorServicio = {};

    for (const archivo of r.listaArchivos || []) {
        const match = archivo
            .toLowerCase()
            .match(
                /^([2-5])\s+(vm|enf12|enf|tf|tr|succion|suc|ts|psi|to|fon)\.pdf$/
            );
        if (match) {
            let serv = match[2];
            if (serv === "suc") serv = "succion";
            const servicioUpper = serv.toUpperCase();
            serviciosDetectados.add(servicioUpper);
            archivosPorServicio[servicioUpper] =
                archivosPorServicio[servicioUpper] || [];
            archivosPorServicio[servicioUpper].push(archivo);
        }
    }

    // Si no hay servicios detectados, mostrar fila con errores generales
    if (serviciosDetectados.size === 0) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.classList.add(
            "paquete-row",
            grupoClase,
            "grupo-inicio",
            "grupo-fin"
        );

        const erroresHTML = renderErrorItems(r.errores) || "—";
        const tieneErrores = r.errores.length > 0;
        tr.setAttribute(
            "data-estado",
            tieneErrores ? "con-errores" : "sin-errores"
        );

        tr.innerHTML = `
            <td class="carpeta-cell"><span class="carpeta-nombre">${carpeta}
                <button class="copy-inline-btn" onclick="copiarNumero(event,'${carpeta}')" title="Copiar número">📋</button>
            </span></td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>${erroresHTML}</td>
        `;
        tablaBody.appendChild(tr);
        return;
    }

    // Orden de servicios
    const ordenServicios = [
        "VM",
        "ENF",
        "ENF12",
        "TR",
        "TF",
        "SUCCION",
        "FON",
        "PSI",
        "TS",
        "TO",
    ];
    const serviciosArray = [...serviciosDetectados].sort((a, b) => {
        const indexA = ordenServicios.indexOf(a);
        const indexB = ordenServicios.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    serviciosArray.forEach((servicio, index) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.setAttribute("data-servicio", servicio);
        tr.classList.add("paquete-row", grupoClase);

        if (index === 0) tr.classList.add("grupo-inicio");
        if (index === serviciosArray.length - 1) tr.classList.add("grupo-fin");

        const nombreCompleto = SERVICIOS_NOMBRES[servicio] || servicio;
        const archivosServicio = archivosPorServicio[servicio] || [];
        const servicioLower =
            servicio === "SUCCION" ? "succion" : servicio.toLowerCase();

        // Generar links a los archivos
        // Si el servicio tiene autorizaciones pero no tiene archivo 2 individual, agregar 2 paq.pdf
        // Solo archivos "2 [servicio].pdf" contienen autorizaciones (no el 4)
        const tiene2Individual = archivosServicio.some((a) =>
            a.match(/^2\s+/i)
        );
        const tieneAutoDe2Paq =
            r.numerosPorServicio?.[servicio] && !tiene2Individual;

        let archivosParaMostrar = [...archivosServicio];
        if (tieneAutoDe2Paq) {
            // Agregar 2 paq.pdf al inicio si se usó para este servicio
            const tiene2Paq = (r.listaArchivos || []).some(
                (a) => a.toLowerCase() === "2 paq.pdf"
            );
            if (tiene2Paq) {
                archivosParaMostrar.unshift("2 paq.pdf");
            }
        }

        const archivosHTML = archivosParaMostrar
            .map((archivo) => {
                const urlKey = Object.keys(r.fileUrls).find(
                    (k) => k.toLowerCase() === archivo.toLowerCase()
                );
                const url = urlKey ? r.fileUrls[urlKey] : null;
                if (url) {
                    return `<a href="#" onclick="abrirPDFModal('${url}', '${archivo}', this); return false;" class="archivo-link ok" title="Abrir ${archivo}">${archivo}</a>`;
                }
                return `<span class="archivo-link">${archivo}</span>`;
            })
            .join(" ");

        // Cantidad de autorizaciones del servicio
        const cantAuto = r.numerosPorServicio?.[servicio] || 0;

        // Extraer fechas de los archivos 5 de este servicio
        const fechasServicio = r.fechasPorServicio?.[servicio] || [];
        const fechasUnicas = [...new Set(fechasServicio)];
        const cantEvol = fechasUnicas.length;
        const fechasFormateadas = fechasUnicas.map(formatearFecha);
        const fechasPills = fechasFormateadas
            .map((f) => `<span class="fecha-text">${f}</span>`)
            .join("");
        const scrollClass = fechasFormateadas.length > 4 ? "fechas-scroll" : "";
        const fechasHTML =
            fechasFormateadas.length > 0
                ? `<div class="fechas-list ${scrollClass}">${fechasPills}</div>`
                : "—";

        // Errores del servicio (ya están separados por servicio en erroresPorServicio)
        const erroresServicio = r.erroresPorServicio?.[servicio] || [];
        // Alertas del servicio
        const alertasServicio = r.alertasPorServicio?.[servicio] || [];
        const erroresHTML = renderErrorItems(erroresServicio);
        const alertasHTML = alertasServicio
            .map((a) => `<div class="alerta-item">⚠️ ${a}</div>`)
            .join("");

        const exitosServicio = r.exitosPorServicio?.[servicio] || [];
        // Siempre generar HTML de éxitos pero ocultos por defecto si mostrarExitos es false
        const exitosHTML =
            exitosServicio.length > 0
                ? exitosServicio
                      .map(
                          (e) =>
                              `<div class="exito-item validacion-exitosa" style="display: ${
                                  mostrarExitos ? "" : "none"
                              }">✓ ${e}</div>`
                      )
                      .join("")
                : "";

        const tieneErrores = erroresServicio.length > 0;
        tr.setAttribute(
            "data-estado",
            tieneErrores ? "con-errores" : "sin-errores"
        );

        const soloExitos =
            exitosServicio.length > 0 &&
            erroresServicio.length === 0 &&
            alertasServicio.length === 0;
        // El badge se oculta cuando mostrarExitos es true (porque se ven los éxitos detallados)
        const badgeExito =
            soloExitos && !mostrarExitos
                ? `<div class="badge-exito">✔ Todo correcto</div>`
                : "";
        // Siempre incluir exitosHTML (aunque esté oculto) para que el filtro pueda mostrarlo
        const contenidoHTML =
            badgeExito + exitosHTML + alertasHTML + erroresHTML;
        const erroresServicioHTML = contenidoHTML || "—";

        // Colorear cantidad de autorizaciones según comparación (solo errores y alertas)
        let cantAutoClass = "";
        if (cantAuto > 0 && cantEvol > 0) {
            if (cantAuto < cantEvol) cantAutoClass = "cant-error";
            else if (cantAuto > cantEvol) cantAutoClass = "cant-alerta";
            // No colorear verde cuando coinciden
        }

        tr.innerHTML = `
            <td class="carpeta-cell"><span class="carpeta-nombre">${carpeta}
                <button class="copy-inline-btn" onclick="copiarNumero(event,'${carpeta}')" title="Copiar número">📋</button>
            </span></td>
            <td class="servicio-nombre">${nombreCompleto}</td>
            <td>${archivosHTML || "—"}</td>
            <td class="${cantAutoClass}">${cantAuto || "—"}</td>
            <td>${cantEvol || "—"}</td>
            <td>${fechasHTML}</td>
            <td>${erroresServicioHTML}</td>
        `;

        tablaBody.appendChild(tr);
    });

    // Si hay errores generales que no son de ningún servicio específico, mostrarlos
    const erroresGeneralesNoServicio = r.errores.filter((e) => {
        const eLower = e.toLowerCase();
        return !serviciosArray.some((s) => {
            const sLower = s === "SUCCION" ? "succion" : s.toLowerCase();
            return eLower.includes(sLower) || eLower.includes(`${sLower}.pdf`);
        });
    });

    if (erroresGeneralesNoServicio.length > 0) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-carpeta", carpeta);
        tr.setAttribute("data-servicio", "General");
        tr.classList.add("paquete-row", grupoClase);
        tr.setAttribute("data-estado", "con-errores");

        const erroresHTML = renderErrorItems(erroresGeneralesNoServicio);

        tr.innerHTML = `
            <td class="carpeta-cell"><span class="carpeta-nombre">${carpeta}</span></td>
            <td class="servicio-nombre">⚠️ General</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td>${erroresHTML}</td>
        `;

        tablaBody.appendChild(tr);
    }
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
