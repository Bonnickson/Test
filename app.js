import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { REGLAS_EVENTO, REGLAS_POR_CARPETA, REGEX_FECHA } from "./reglas.js";

const DEBUG = true;

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

const input = document.getElementById("inputFolder");
const estado = document.getElementById("estado");
const tabla = document.getElementById("tabla");
const tablaBody = document.querySelector("#tabla tbody");
const tablaHeader = document.getElementById("tablaHeader");
const tipoValidacionSelect = document.getElementById("tipoValidacion");
const tipoPaqueteSelect = document.getElementById("tipoPaquete");
const paqueteOptionsDiv = document.getElementById("paqueteOptions");
const ALLOWED_TYPES = ["TR", "SUCCION", "TF", "VM", "ENF", "PS", "TS"];
const SERVICIOS_TERAPIA = ["TF", "TR", "SUCCION"];

function limpiarResultados() {
    tablaBody.innerHTML = "";
    estado.classList.add("oculto");
    // opcional: limpiar selección de archivos para evitar procesar datos previos
    input.value = "";
}

// Función para actualizar los headers de la tabla
function actualizarHeadersTabla(tipoValidacion, tipoPaquete) {
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
        // Por paquete
        if (tipoPaquete === "cronico") {
            tabla.classList.add("modo-paquete-fijo");
            tablaHeader.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>Carpeta</th>
                    <th>2 vm</th>
                    <th>2 enf</th>
                    <th>4 vm</th>
                    <th>4 enf</th>
                    <th>5 vm</th>
                    <th>5 enf</th>
                    <th colspan="2">Fechas por servicio</th>
                    <th>Errores</th>
                </tr>
            `;
        } else {
            tabla.classList.add("modo-paquete-dinamico");
            // Crónico con terapias - headers dinámicos según servicios
            tablaHeader.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>Carpeta</th>
                    <th>Servicios (cant)</th>
                    <th>Archivos</th>
                    <th colspan="2">Errores</th>
                </tr>
            `;
        }
    }
}

// Mostrar/ocultar opciones de paquete según tipo de validación
tipoValidacionSelect.addEventListener("change", () => {
    limpiarResultados();
    if (tipoValidacionSelect.value === "paquete") {
        paqueteOptionsDiv.classList.remove("oculto");
    } else {
        paqueteOptionsDiv.classList.add("oculto");
    }
    actualizarHeadersTabla(tipoValidacionSelect.value, tipoPaqueteSelect.value);
});

tipoPaqueteSelect.addEventListener("change", () => {
    limpiarResultados();
    actualizarHeadersTabla(tipoValidacionSelect.value, tipoPaqueteSelect.value);
});

input.addEventListener("change", async () => {
    tablaBody.innerHTML = "";
    estado.classList.remove("oculto");

    const carpetas = {};
    const resultados = {};
    const tipoValidacion = tipoValidacionSelect.value;
    const tipoPaquete = tipoPaqueteSelect.value;

    // Actualizar headers de la tabla según tipo de validación
    actualizarHeadersTabla(tipoValidacion, tipoPaquete);

    // agrupar archivos
    for (const f of input.files) {
        const p = f.webkitRelativePath.split("/");
        if (p.length < 2) continue;
        carpetas[p[1]] ??= [];
        carpetas[p[1]].push(f);
    }

    for (const carpeta in carpetas) {
        resultados[carpeta] = {
            pdfs:
                tipoValidacion === "evento"
                    ? {
                          "2.pdf": "—",
                          "3.pdf": "—",
                          "4.pdf": "—",
                          "5.pdf": "—",
                      }
                    : {}, // En modo paquete, pdfs será dinámico
            pdfsPorServicio: {}, // Para modo paquete
            fechasPorServicio: {}, // Fechas por servicio (archivo 5)
            servicios: new Set(),
            errores: [],
            fechas: [],
            fileUrls: {},
            tipoValidacion,
            tipoPaquete,
        };

        // Si es validación por paquete, no validamos por tipo de carpeta
        if (tipoValidacion === "evento") {
            // detectar tipo de carpeta (ej: TF, TR, SUCCION...)
            const carpetaUpper = carpeta.toUpperCase();
            const tipoDetectado = ALLOWED_TYPES.find((t) =>
                carpetaUpper.includes(t)
            );
            resultados[carpeta].tipo = tipoDetectado || null;
            if (!tipoDetectado) {
                resultados[carpeta].errores.push(
                    `Tipo no reconocido (se esperaba uno de: ${ALLOWED_TYPES.join(
                        ", "
                    )})`
                );
            }
        } else {
            // Por paquete
            resultados[carpeta].tipo = `Paquete: ${
                tipoPaquete === "cronico" ? "Crónico" : "Crónico con terapias"
            }`;
        }

        // crear fila placeholder con spinner antes de procesar (tenemos el tipo ahora)
        createPlaceholderRow(carpeta);

        const archivos = carpetas[carpeta];
        const nombres = archivos.map((a) => a.name);
        const nroDocumento = carpeta.match(/^\d+/)?.[0] || "";

        // guardar URLs de los archivos para poder abrirlos desde la tabla
        resultados[carpeta].fileUrls = {
            "2.pdf": null,
            "3.pdf": null,
            "4.pdf": null,
            "5.pdf": null,
        };
        for (const f of archivos) {
            if (resultados[carpeta].fileUrls.hasOwnProperty(f.name)) {
                resultados[carpeta].fileUrls[f.name] = URL.createObjectURL(f);
            }
        }

        // Validación por paquete
        if (tipoValidacion === "paquete") {
            await validarPorPaquete(
                carpeta,
                archivos,
                tipoPaquete,
                nroDocumento,
                resultados
            );
        } else {
            // Validación por evento (lógica original)
            ["2.pdf", "3.pdf", "4.pdf", "5.pdf"].forEach((p) => {
                if (nombres.includes(p)) resultados[carpeta].pdfs[p] = "✔";
                else resultados[carpeta].errores.push(`Falta ${p}`);
            });

            for (const file of archivos.filter(
                (f) => f.type === "application/pdf"
            )) {
                estado.textContent = `Procesando: ${carpeta} / ${file.name}`;
                await validarPDF(file, carpeta, nroDocumento, resultados);
                // actualizar la fila en cuanto se procese cada PDF
                updateRow(carpeta, resultados[carpeta]);
            }
        }

        // pintar la fila de esta carpeta tan pronto termine su procesamiento
        // quitar spinner final (updateRow dejará el estado final)
        const row = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
        if (row) row.classList.remove("processing");
    }
    // pintarTabla(resultados); // ya se pintó por carpeta mientras procesa
    estado.classList.add("oculto");
});

// ================= VALIDACIÓN POR PAQUETE =================

async function validarPorPaquete(
    carpeta,
    archivos,
    tipoPaquete,
    nroDocumento,
    resultados
) {
    const nombres = archivos.map((a) => a.name);

    // Detectar servicios presentes en los archivos
    const serviciosEncontrados = new Set();
    for (const nombre of nombres) {
        const nombreUpper = nombre.toUpperCase();
        // Buscar patrones como 2 vm.pdf, 4 enf.pdf, 5 tf.pdf, etc.
        const match = nombreUpper.match(/\d+ (VM|ENF|TF|TR|SUCCION|SUC|TS|PS)/);
        if (match) {
            let servicio = match[1];
            // Normalizar SUCCION y SUC
            if (servicio === "SUC") servicio = "SUCCION";
            serviciosEncontrados.add(servicio);
        }
    }

    // Guardar servicios en resultados
    resultados[carpeta].servicios = serviciosEncontrados;
    // Inicializar contenedores de fechas por servicio (para conteos aunque falte 5)
    for (const s of serviciosEncontrados) {
        resultados[carpeta].fechasPorServicio[s] ||= [];
    }

    // Crear URLs para todos los archivos PDF
    for (const f of archivos) {
        if (f.type === "application/pdf") {
            resultados[carpeta].fileUrls[f.name] = URL.createObjectURL(f);
        }
    }

    if (tipoPaquete === "cronico") {
        // Paquete Crónico: solo VM y ENF, archivos 2, 4, 5 obligatorios

        // Verificar que solo existan VM y ENF
        const serviciosPermitidos = new Set(["VM", "ENF"]);
        const serviciosNoPermitidos = [...serviciosEncontrados].filter(
            (s) => !serviciosPermitidos.has(s)
        );

        if (serviciosNoPermitidos.length > 0) {
            resultados[carpeta].errores.push(
                `Paquete Crónico solo debe contener VM y ENF. Se encontró: ${serviciosNoPermitidos.join(
                    ", "
                )}`
            );
        }

        // Verificar que existan VM y ENF
        if (!serviciosEncontrados.has("VM")) {
            resultados[carpeta].errores.push(
                "Paquete Crónico debe incluir servicio VM"
            );
        }
        if (!serviciosEncontrados.has("ENF")) {
            resultados[carpeta].errores.push(
                "Paquete Crónico debe incluir servicio ENF"
            );
        }

        // Verificar archivos 2, 4, 5 para VM y ENF
        for (const servicio of ["VM", "ENF"]) {
            resultados[carpeta].pdfsPorServicio[servicio] = {};
            for (const num of ["2", "4", "5"]) {
                const nombreArchivo = `${num} ${servicio.toLowerCase()}.pdf`;
                const existe = nombres.some(
                    (n) => n.toLowerCase() === nombreArchivo
                );

                resultados[carpeta].pdfsPorServicio[servicio][num] = existe
                    ? "✔"
                    : "❌";

                if (!existe) {
                    resultados[carpeta].errores.push(`Falta ${nombreArchivo}`);
                }
            }
        }
    } else if (tipoPaquete === "cronico-terapias") {
        // Paquete Crónico con terapias

        // Verificar que existan VM y ENF
        if (!serviciosEncontrados.has("VM")) {
            resultados[carpeta].errores.push(
                "Paquete debe incluir servicio VM"
            );
        }
        if (!serviciosEncontrados.has("ENF")) {
            resultados[carpeta].errores.push(
                "Paquete debe incluir servicio ENF"
            );
        }

        // Verificar que exista al menos una terapia
        const terapiasEncontradas = [...serviciosEncontrados].filter((s) =>
            SERVICIOS_TERAPIA.includes(s)
        );

        if (terapiasEncontradas.length === 0) {
            resultados[carpeta].errores.push(
                "Paquete debe incluir al menos un servicio de terapia (TF, TR o SUCCION)"
            );
        }

        // Para cada servicio encontrado, verificar que tenga los PDFs 2, 4 y 5
        for (const servicio of serviciosEncontrados) {
            const servicioLower = servicio.toLowerCase();
            resultados[carpeta].pdfsPorServicio[servicio] = {};

            for (const num of ["2", "4", "5"]) {
                const nombreArchivo = `${num} ${servicioLower}.pdf`;
                const existe = nombres.some(
                    (n) => n.toLowerCase() === nombreArchivo
                );
                resultados[carpeta].pdfsPorServicio[servicio][num] = existe
                    ? "✔"
                    : "❌";
            }

            // Verificar si el servicio está completo
            const faltantes = ["2", "4", "5"].filter(
                (num) =>
                    !nombres.some(
                        (n) => n.toLowerCase() === `${num} ${servicioLower}.pdf`
                    )
            );

            if (faltantes.length > 0 && faltantes.length < 3) {
                // El servicio existe pero está incompleto
                resultados[carpeta].errores.push(
                    `Servicio ${servicio} incompleto: falta ${faltantes
                        .map((n) => `${n} ${servicioLower}.pdf`)
                        .join(", ")}`
                );
            }
        }
    }

    // Procesar cada archivo PDF para validación de contenido
    for (const file of archivos.filter((f) => f.type === "application/pdf")) {
        estado.textContent = `Procesando: ${carpeta} / ${file.name}`;

        // Extraer el servicio del nombre del archivo
        const nombreUpper = file.name.toUpperCase();
        const match = nombreUpper.match(/\d+ (VM|ENF|TF|TR|SUCCION|SUC|TS|PS)/);

        if (match) {
            let servicioArchivo = match[1];
            if (servicioArchivo === "SUC") servicioArchivo = "SUCCION";

            // Validar contenido del PDF
            await validarPDFPaquete(
                file,
                carpeta,
                nroDocumento,
                servicioArchivo,
                resultados
            );
        }

        updateRow(carpeta, resultados[carpeta]);
    }
}

async function validarPDFPaquete(
    file,
    carpeta,
    nroDocumento,
    servicio,
    resultados
) {
    try {
        const pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const c = await page.getTextContent();
            texto += c.items.map((t) => t.str).join(" ") + " ";
        }

        const textoPlano = texto.toUpperCase().replace(/\s+/g, " ").trim();
        const textoPlanoNorm = normalizeForSearch(texto);

        // -------- fechas (VB.NET style) --------
        let m;
        const fechas = [];
        REGEX_FECHA.lastIndex = 0;

        while ((m = REGEX_FECHA.exec(texto)) !== null) {
            fechas.push(m[1].replace(/\s+/g, "").trim());
        }

        resultados[carpeta].fechas.push(...fechas);

        // Guardar fechas específicas por servicio en el archivo 5
        const numArchivo = file.name.match(/^(\d+) /)?.[1];
        if (numArchivo === "5") {
            resultados[carpeta].fechasPorServicio[servicio] = fechas;
        }

        // -------- reglas por servicio --------
        if (REGLAS_POR_CARPETA[servicio]) {
            // Determinar qué archivo es (2.pdf o 5.pdf)
            const claveArchivo = numArchivo ? `${numArchivo}.pdf` : null;

            // Para paquetes, las reglas del archivo 2 son distintas (no se valida contenido como evento)
            const debeAplicarRegla = claveArchivo && claveArchivo !== "2.pdf";

            if (
                debeAplicarRegla &&
                REGLAS_POR_CARPETA[servicio][claveArchivo]
            ) {
                const regla = REGLAS_POR_CARPETA[servicio][claveArchivo];
                const buscar = regla.debeContener;
                const buscarNorm = normalizeForSearch(buscar);
                const safe = escapeRegExp(buscarNorm);
                const vecesTexto = (
                    textoPlanoNorm.match(new RegExp(safe, "g")) || []
                ).length;

                if (!textoPlanoNorm.includes(buscarNorm)) {
                    resultados[carpeta].errores.push(
                        `${file.name}: falta "${regla.debeContener}"`
                    );
                }

                // Regla de igualar con fechas para archivos 5
                if (regla.igualarConFechas) {
                    if (vecesTexto !== fechas.length) {
                        resultados[carpeta].errores.push(
                            `${file.name}: Registros ${vecesTexto} ≠ Fechas ${fechas.length}`
                        );
                    }
                }

                if (DEBUG)
                    console.log({
                        carpeta,
                        file: file.name,
                        servicio,
                        buscar,
                        vecesTexto,
                        fechasFound: fechas.length,
                    });
            }
        }
    } catch {
        resultados[carpeta].errores.push(`${file.name}: error leyendo PDF`);
    }
}

// ================= VALIDACIÓN PDF =================

async function validarPDF(file, carpeta, nroDocumento, resultados) {
    try {
        const pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const c = await page.getTextContent();
            texto += c.items.map((t) => t.str).join(" ") + " ";
        }

        const textoPlano = texto.toUpperCase().replace(/\s+/g, " ").trim();
        const textoPlanoNorm = normalizeForSearch(texto);

        // -------- fechas (VB.NET style) --------
        let m;
        const fechas = [];
        REGEX_FECHA.lastIndex = 0;

        while ((m = REGEX_FECHA.exec(texto)) !== null) {
            fechas.push(m[1].replace(/\s+/g, "").trim());
        }

        resultados[carpeta].fechas.push(...fechas);

        // -------- número documento --------
        if (["2.pdf", "3.pdf", "5.pdf"].includes(file.name)) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].errores.push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
                resultados[carpeta].pdfs[file.name] = "❌";
            }
        }

        // -------- reglas por carpeta (EVENTO) --------
        // aplicar reglas solo si la carpeta tiene un tipo reconocido
        const tipo = resultados[carpeta].tipo;
        if (tipo && REGLAS_EVENTO[tipo]) {
            const regla = REGLAS_EVENTO[tipo][file.name];
            if (regla) {
                const buscar = regla.debeContener;
                const buscarNorm = normalizeForSearch(buscar);
                const safe = escapeRegExp(buscarNorm);
                const vecesTexto = (
                    textoPlanoNorm.match(new RegExp(safe, "g")) || []
                ).length;

                if (!textoPlanoNorm.includes(buscarNorm)) {
                    resultados[carpeta].errores.push(
                        `${file.name}: falta "${regla.debeContener}"`
                    );
                    resultados[carpeta].pdfs[file.name] = "❌";
                }

                // 🔴 REGLA CLAVE DEL 5.PDF: mensaje corto y claro
                if (regla.igualarConFechas) {
                    if (vecesTexto !== fechas.length) {
                        resultados[carpeta].errores.push(
                            `${file.name}: Registros ${vecesTexto} ≠ Fechas ${fechas.length}`
                        );
                        resultados[carpeta].pdfs[file.name] = "❌";
                    }
                }
                if (DEBUG)
                    console.log({
                        carpeta,
                        file: file.name,
                        buscar,
                        vecesTexto,
                        fechasFound: fechas.length,
                    });
            }
        }
    } catch {
        resultados[carpeta].errores.push(`${file.name}: error leyendo PDF`);
        resultados[carpeta].pdfs[file.name] = "❌";
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeForSearch(s) {
    if (!s) return "";
    // normalize, remove diacritics, collapse spaces and uppercase
    return s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim();
}

// ================= TABLA =================

function pintarFila(carpeta, r) {
    const fechasUnicas = [...new Set(r.fechas)];
    const fechasFormateadas = fechasUnicas.map((f) => {
        const m = f.match(/(\d{4})-?(\d{2})-?(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return f;
    });

    const fechasPills = fechasFormateadas
        .map((f) => `<span class="fecha-text">${f}</span>`)
        .join("");

    const tr = document.createElement("tr");
    tr.setAttribute("data-carpeta", carpeta);
    tr.classList.remove("processing");

    const tipoDisplay = r.tipo || "—";
    const erroresHTML = r.errores.length
        ? r.errores.map((e) => `<div class="error-item">• ${e}</div>`).join("")
        : "—";

    // Renderizado según tipo de validación
    if (r.tipoValidacion === "paquete") {
        if (r.tipoPaquete === "cronico") {
            // Paquete Crónico: columnas específicas para VM y ENF
            const getCellHTML = (servicio, num) => {
                const status = r.pdfsPorServicio[servicio]?.[num] || "—";
                const cls =
                    status === "✔" ? "ok" : status === "—" ? "missing" : "fail";
                const nombreArchivo = `${num} ${servicio.toLowerCase()}.pdf`;
                const url = r.fileUrls[nombreArchivo];

                if (url) {
                    return `<td class="${cls}"><a href="${url}" target="_blank" class="pdf-link" title="Abrir ${nombreArchivo}">${status}</a></td>`;
                }
                return `<td class="${cls}">${status}</td>`;
            };

            // Fechas y cantidades por servicio
            const getFechasHTML = (servicio) => {
                const fechas = r.fechasPorServicio[servicio] || [];
                const fechasUnicas = [...new Set(fechas)];
                const fechasFormateadas = fechasUnicas.map((f) => {
                    const m = f.match(/(\d{4})-?(\d{2})-?(\d{2})/);
                    if (m) return `${m[2]}/${m[3]}`; // Formato compacto MM/DD
                    return f;
                });
                const fechasPills = fechasFormateadas.slice(0, 2).join(", "); // Máximo 2 fechas
                const extra =
                    fechasUnicas.length > 2
                        ? ` +${fechasUnicas.length - 2}`
                        : "";
                return `${fechasUnicas.length} ${
                    fechasPills ? `(${fechasPills}${extra})` : ""
                }`;
            };

            tr.innerHTML = `
                <td class="tipo-compact">${tipoDisplay}</td>
                <td class="carpeta-compact">${carpeta}</td>
                ${getCellHTML("VM", "2")}
                ${getCellHTML("ENF", "2")}
                ${getCellHTML("VM", "4")}
                ${getCellHTML("ENF", "4")}
                ${getCellHTML("VM", "5")}
                ${getCellHTML("ENF", "5")}
                <td class="fechas-compact" colspan="2">
                    <div class="fechas-servicio"><strong>VM:</strong> ${getFechasHTML(
                        "VM"
                    )}</div>
                    <div class="fechas-servicio"><strong>ENF:</strong> ${getFechasHTML(
                        "ENF"
                    )}</div>
                </td>
                <td class="errores-compact">${erroresHTML}</td>
            `;
        } else {
            // Crónico con terapias: servicios apilados con archivos por servicio
            const renderServicio = (s) => {
                const fechas = r.fechasPorServicio[s] || [];
                const cant = [...new Set(fechas)].length;
                const servicioLower =
                    s === "SUCCION" ? "succion" : s.toLowerCase();

                const archivos = Object.keys(r.fileUrls)
                    .filter((f) =>
                        f.toLowerCase().includes(` ${servicioLower}.pdf`)
                    )
                    .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

                const archivosHTML = archivos
                    .map((nombre) => {
                        const url = r.fileUrls[nombre];
                        const num = nombre.match(/^(\d+) /)?.[1] || "";
                        const status = r.pdfsPorServicio[s]?.[num] || "—";
                        const cls =
                            status === "✔"
                                ? "ok"
                                : status === "—"
                                ? "missing"
                                : "fail";
                        const label = `${num} ${servicioLower}`;
                        if (url) {
                            return `<a href="${url}" target="_blank" class="archivo-link ${cls}" title="Abrir ${nombre}">${label}</a>`;
                        }
                        return `<span class="archivo-link ${cls}">${label}</span>`;
                    })
                    .join(" ");

                return `<div class="servicio-row"><span class="servicio-name">${s} (${cant})</span><span class="servicio-files">${
                    archivosHTML || "—"
                }</span></div>`;
            };

            const serviciosList = [...r.servicios]
                .sort()
                .map(renderServicio)
                .join("");

            tr.innerHTML = `
                <td class="tipo-compact">${tipoDisplay}</td>
                <td class="carpeta-compact">${carpeta}</td>
                <td class="servicios-cell-compact" colspan="2">
                    <div class="servicio-stack">${serviciosList || "—"}</div>
                </td>
                <td class="errores-compact" colspan="2">${erroresHTML}</td>
            `;
        }
    } else {
        // Por evento (original)
        const pdfCells = ["2.pdf", "3.pdf", "4.pdf", "5.pdf"]
            .map((p) => {
                const url = r.fileUrls[p];
                const symbol = r.pdfs[p];
                const cls =
                    symbol === "✔" ? "ok" : symbol === "—" ? "missing" : "fail";
                if (url)
                    return `<td class="${cls}"><a href="${url}" target="_blank" class="pdf-link" data-file="${p}">${symbol}</a></td>`;
                return `<td class="${cls}">${symbol}</td>`;
            })
            .join("");

        tr.innerHTML = `
            <td class="tipo">${tipoDisplay}</td>
            <td>${carpeta}</td>
            ${pdfCells}
            <td class="count">${fechasUnicas.length}</td>
            <td class="fechas"><div class="fechas-list">${
                fechasPills || "—"
            }</div></td>
            <td class="errores">${erroresHTML}</td>
        `;
    }

    tablaBody.appendChild(tr);
}

function createPlaceholderRow(carpeta) {
    if (document.querySelector(`tr[data-carpeta="${carpeta}"]`)) return;
    const tr = document.createElement("tr");
    tr.setAttribute("data-carpeta", carpeta);
    tr.classList.add("processing");

    const tipoValidacion = tipoValidacionSelect.value;
    const tipoPaquete = tipoPaqueteSelect.value;

    if (tipoValidacion === "paquete") {
        if (tipoPaquete === "cronico") {
            tr.innerHTML = `
                <td class="tipo-compact">—</td>
                <td class="carpeta-compact">${carpeta} <span class="spinner" aria-hidden></span></td>
                <td>…</td><td>…</td><td>…</td><td>…</td><td>…</td><td>…</td>
                <td colspan="2">—</td>
                <td class="errores-compact">—</td>
            `;
        } else {
            tr.innerHTML = `
                <td class="tipo-compact">—</td>
                <td class="carpeta-compact">${carpeta} <span class="spinner" aria-hidden></span></td>
                <td>…</td>
                <td>…</td>
                <td colspan="2" class="errores-compact">—</td>
            `;
        }
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

function updateRow(carpeta, r) {
    const existing = document.querySelector(`tr[data-carpeta="${carpeta}"]`);
    if (!existing) return pintarFila(carpeta, r);

    const fechasUnicas = [...new Set(r.fechas)];
    const fechasFormateadas = fechasUnicas.map((f) => {
        const m = f.match(/(\d{4})-?(\d{2})-?(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return f;
    });
    const fechasPills = fechasFormateadas
        .map((f) => `<span class="fecha-text">${f}</span>`)
        .join("");

    const tipoDisplay = r.tipo || "—";
    const erroresHTML = r.errores.length
        ? r.errores.map((e) => `<div class="error-item">• ${e}</div>`).join("")
        : "—";
    const isProcessing = existing.classList.contains("processing");

    if (r.tipoValidacion === "paquete") {
        if (r.tipoPaquete === "cronico") {
            const getCellHTML = (servicio, num) => {
                const status = r.pdfsPorServicio[servicio]?.[num] || "—";
                const cls =
                    status === "✔" ? "ok" : status === "—" ? "missing" : "fail";
                const nombreArchivo = `${num} ${servicio.toLowerCase()}.pdf`;
                const url = r.fileUrls[nombreArchivo];

                if (url) {
                    return `<td class="${cls}"><a href="${url}" target="_blank" class="pdf-link" title="Abrir ${nombreArchivo}">${status}</a></td>`;
                }
                return `<td class="${cls}">${status}</td>`;
            };

            // Fechas y cantidades por servicio
            const getFechasHTML = (servicio) => {
                const fechas = r.fechasPorServicio[servicio] || [];
                const fechasUnicas = [...new Set(fechas)];
                const fechasFormateadas = fechasUnicas.map((f) => {
                    const m = f.match(/(\d{4})-?(\d{2})-?(\d{2})/);
                    if (m) return `${m[2]}/${m[3]}`;
                    return f;
                });
                const fechasPills = fechasFormateadas.slice(0, 2).join(", ");
                const extra =
                    fechasUnicas.length > 2
                        ? ` +${fechasUnicas.length - 2}`
                        : "";
                return `${fechasUnicas.length} ${
                    fechasPills ? `(${fechasPills}${extra})` : ""
                }`;
            };

            existing.innerHTML = `
                <td class="tipo-compact">${tipoDisplay}</td>
                <td class="carpeta-compact">${carpeta} ${
                isProcessing ? '<span class="spinner"></span>' : ""
            }</td>
                ${getCellHTML("VM", "2")}
                ${getCellHTML("ENF", "2")}
                ${getCellHTML("VM", "4")}
                ${getCellHTML("ENF", "4")}
                ${getCellHTML("VM", "5")}
                ${getCellHTML("ENF", "5")}
                <td class="fechas-compact" colspan="2">
                    <div class="fechas-servicio"><strong>VM:</strong> ${getFechasHTML(
                        "VM"
                    )}</div>
                    <div class="fechas-servicio"><strong>ENF:</strong> ${getFechasHTML(
                        "ENF"
                    )}</div>
                </td>
                <td class="errores-compact">${erroresHTML}</td>
            `;
        } else {
            const serviciosList = [...r.servicios]
                .sort()
                .map((s) => {
                    const fechas = r.fechasPorServicio[s] || [];
                    const cant = [...new Set(fechas)].length;
                    const servicioLower =
                        s === "SUCCION" ? "succion" : s.toLowerCase();

                    const archivos = Object.keys(r.fileUrls)
                        .filter((f) =>
                            f.toLowerCase().includes(` ${servicioLower}.pdf`)
                        )
                        .sort(
                            (a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)
                        );

                    const archivosHTML = archivos
                        .map((nombre) => {
                            const url = r.fileUrls[nombre];
                            const num = nombre.match(/^(\d+) /)?.[1] || "";
                            const status = r.pdfsPorServicio[s]?.[num] || "—";
                            const cls =
                                status === "✔"
                                    ? "ok"
                                    : status === "—"
                                    ? "missing"
                                    : "fail";
                            const label = `${num} ${servicioLower}`;
                            if (url) {
                                return `<a href="${url}" target="_blank" class="archivo-link ${cls}" title="Abrir ${nombre}">${label}</a>`;
                            }
                            return `<span class="archivo-link ${cls}">${label}</span>`;
                        })
                        .join(" ");

                    return `<div class="servicio-row"><span class="servicio-name">${s} (${cant})</span><span class="servicio-files">${
                        archivosHTML || "—"
                    }</span></div>`;
                })
                .join("");

            existing.innerHTML = `
                <td class="tipo-compact">${tipoDisplay}</td>
                <td class="carpeta-compact">${carpeta} ${
                isProcessing ? '<span class="spinner"></span>' : ""
            }</td>
                <td class="servicios-cell-compact" colspan="2">
                    <div class="servicio-stack">${serviciosList || "—"}</div>
                </td>
                <td class="errores-compact" colspan="2">${erroresHTML}</td>
            `;
        }
    } else {
        const pdfCells = ["2.pdf", "3.pdf", "4.pdf", "5.pdf"]
            .map((p) => {
                const url = r.fileUrls[p];
                const symbol = r.pdfs[p];
                const cls =
                    symbol === "✔" ? "ok" : symbol === "—" ? "missing" : "fail";
                if (url)
                    return `<td class="${cls}"><a href="${url}" target="_blank" class="pdf-link" data-file="${p}">${symbol}</a></td>`;
                return `<td class="${cls}">${symbol}</td>`;
            })
            .join("");

        existing.innerHTML = `
            <td class="tipo">${tipoDisplay}</td>
            <td>${carpeta} ${
            isProcessing ? '<span class="spinner"></span>' : ""
        }</td>
            ${pdfCells}
            <td class="count">${fechasUnicas.length}</td>
            <td class="fechas"><div class="fechas-list">${
                fechasPills || "—"
            }</div></td>
            <td class="errores">${erroresHTML}</td>
        `;
    }
}

function pintarTabla(resultados) {
    tablaBody.innerHTML = "";
    for (const carpeta in resultados) {
        pintarFila(carpeta, resultados[carpeta]);
    }
}
