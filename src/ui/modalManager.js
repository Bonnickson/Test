import {
    PAQUETES_INFO,
    REGLAS_TERAPIAS_PAQUETES,
    obtenerInfoSoporte,
} from "../config/constants.js";
import {
    copiarTextoSimple,
    copiarErrorMatriz,
    copiarTextoAlPortapapeles,
    mostrarToastCopia,
} from "../utils/clipboardUtils.js";
import { formatearErrorConIconosPDF } from "../utils/textUtils.js";

/**
 * Muestra el resumen de condiciones del paquete seleccionado en el panel lateral
 */
export function mostrarCondicionesPaquete(tipoPaqueteSelect, paqueteCondicionesContent) {
    if (!paqueteCondicionesContent || !tipoPaqueteSelect) return;

    const paquete = tipoPaqueteSelect.value;
    const regla = REGLAS_TERAPIAS_PAQUETES[paquete] || { descripcion: "Requisitos según paquete." };
    const terapias = regla.descripcion;

    const html = `
        <div class="paquete-rules-card">
            <div class="rule-group">
                <span class="rule-label">Archivo Base:</span>
                <span class="rule-value">Código en <code>2 PAQ.pdf</code></span>
            </div>
            <div class="rule-group">
                <span class="rule-label">Obligatorios / Enfermería:</span>
                <div class="rule-chips">
                    <span class="rule-chip required">VM: 1</span>
                    <span class="rule-chip optional">ENF / VENF (1)</span>
                </div>
            </div>
            <div class="rule-group">
                <span class="rule-label">A Elección (1 solo):</span>
                <div class="rule-chips">
                    <span class="rule-chip choice">PSI (1)</span>
                    <span class="rule-chip choice">NUT (1)</span>
                    <span class="rule-chip choice">TS (1)</span>
                </div>
            </div>
            <div class="rule-group">
                <span class="rule-label">Terapias:</span>
                <span class="rule-value highlight">${terapias}</span>
            </div>
        </div>
    `;

    paqueteCondicionesContent.innerHTML = html;
}

/**
 * Modal Pop-up para Reglas de Paquete
 */
export function mostrarModalReglasPaquete(paquete) {
    const pkg = paquete || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
    const regla = REGLAS_TERAPIAS_PAQUETES[pkg] || { descripcion: "Requisitos según paquete." };
    const terapias = regla.descripcion;

    const prev = document.getElementById("modalReglasPaqueteActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalReglasPaqueteActivo";
    backdrop.className = "modal-rules-backdrop";

    backdrop.innerHTML = `
        <div class="modal-rules-card" onclick="event.stopPropagation()">
            <div class="modal-rules-header">
                <div class="modal-rules-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span>Reglas de Validación: <strong>${pkg}</strong></span>
                </div>
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalReglasPaqueteActivo')?.remove()">&times;</button>
            </div>
            <div class="modal-rules-body">
                <div class="paquete-rules-card">
                    <div class="rule-group">
                        <span class="rule-label">Archivo Base:</span>
                        <span class="rule-value">Código del paquete dentro de <code>2 PAQ.pdf</code></span>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">Obligatorios / Enfermería:</span>
                        <div class="rule-chips">
                            <span class="rule-chip required">🩺 Valoración Médica (1)</span>
                            <span class="rule-chip optional">💉 ENF / VENF (1 o ambas)</span>
                        </div>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">A Elección (1 solo):</span>
                        <div class="rule-chips">
                            <span class="rule-chip choice">🧠 Psicología (1)</span>
                            <span class="rule-chip choice">🥗 Nutrición (1)</span>
                            <span class="rule-chip choice">👥 Trabajo Social (1)</span>
                        </div>
                    </div>
                    <div class="rule-group">
                        <span class="rule-label">Terapias:</span>
                        <span class="rule-value highlight">${terapias}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Modal de Aviso Obligatorio de Revisión de Firmas con temporizador
 */
export function mostrarAvisoRevisionFirmas() {
    const prev = document.getElementById("modalAvisoFirmasActivo");
    if (prev) prev.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "modalAvisoFirmasActivo";
    backdrop.className = "modal-aviso-firmas-backdrop";

    let segundosRestantes = 4;

    backdrop.innerHTML = `
        <div class="modal-aviso-firmas-card" onclick="event.stopPropagation()">
            <div class="modal-aviso-firmas-header">
                <div class="modal-aviso-firmas-icon">✍️</div>
                <div class="modal-aviso-firmas-title">Control Obligatorio: Verificación de Firmas (4.pdf)</div>
            </div>
            <div class="modal-aviso-firmas-body">
                <div class="aviso-intro-text">
                    Es requisito indispensable <strong>verificar manualmente 1 a 1</strong> el archivo <strong>4.pdf</strong> haciendo clic sobre el <strong>«4»</strong> de cada servicio y constatar:
                </div>

                <div class="aviso-checklist">
                    <div class="checklist-item">
                        <span class="chk-icon">📅</span>
                        <div class="chk-content"><strong>Fechas coincidentes:</strong> Deben coincidir exactamente con las fechas de la historia clínica (5.pdf).</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">🔢</span>
                        <div class="chk-content"><strong>Cantidad acorde:</strong> El total de firmas registradas debe corresponder al número de evoluciones.</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">🔍</span>
                        <div class="chk-content"><strong>Legibilidad completa:</strong> El documento debe ser nítido, sin borrones, tachones ni firmas cortadas.</div>
                    </div>
                    <div class="checklist-item">
                        <span class="chk-icon">📐</span>
                        <div class="chk-content"><strong>Orientación de lectura vertical:</strong> Las firmas y el texto deben leerse al derecho (en sentido vertical de lectura natural), nunca de lado, acostadas ni rotadas 90°.</div>
                    </div>
                </div>

                <div class="orientacion-ejemplo-box">
                    <div class="orientacion-title">Sentido de Lectura de las Firmas:</div>
                    <div class="orientacion-grid">
                        <div class="orientacion-card incorrecto">
                            <div class="firma-table-container incorrecto-box">
                                <table class="mini-tabla-firmas">
                                    <thead>
                                        <tr><th>Fecha</th><th>Serv</th><th>Firma</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>02/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                        <tr><td>05/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <span class="orientacion-label">❌ De lado / Rotado</span>
                        </div>
                        <div class="orientacion-card correcto">
                            <div class="firma-table-container correcto-box">
                                <table class="mini-tabla-firmas">
                                    <thead>
                                        <tr><th>Fecha</th><th>Serv</th><th>Firma</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr><td>02/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                        <tr><td>05/08</td><td>TF</td><td>✍️ Ok</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <span class="orientacion-label">✅ Al derecho / Vertical</span>
                        </div>
                    </div>
                </div>
            </div>
            <button type="button" id="btnCerrarAvisoFirmas" class="btn-aviso-firmas" disabled>
                He leído las instrucciones (${segundosRestantes}s)...
            </button>
        </div>
    `;

    document.body.appendChild(backdrop);

    const btnCerrar = backdrop.querySelector("#btnCerrarAvisoFirmas");

    const timer = setInterval(() => {
        segundosRestantes--;
        if (segundosRestantes > 0) {
            btnCerrar.textContent = `He leído las instrucciones (${segundosRestantes}s)...`;
        } else {
            clearInterval(timer);
            btnCerrar.disabled = false;
            btnCerrar.textContent = "Entendido, proceder con la auditoría";
            btnCerrar.classList.add("btn-aviso-firmas-ready");
        }
    }, 1000);

    const cerrarModal = () => {
        if (btnCerrar.disabled) return;
        clearInterval(timer);
        backdrop.remove();
    };

    btnCerrar.addEventListener("click", cerrarModal);
}

/**
 * Helper para hacer un popover flotante arrastrable y redimensionable
 */
function hacerDraggableYResizable(popover, header) {
    if (!popover || !header) return;

    header.style.cursor = "move";
    header.style.userSelect = "none";

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onMouseDown = (e) => {
        if (e.button !== 0 || e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const parent = popover.offsetParent || document.body;
        const parentRect = parent.getBoundingClientRect();
        const rect = popover.getBoundingClientRect();

        initialLeft = rect.left - parentRect.left + (parent.scrollLeft || 0);
        initialTop = rect.top - parentRect.top + (parent.scrollTop || 0);

        popover.style.left = `${initialLeft}px`;
        popover.style.top = `${initialTop}px`;
        popover.style.right = "auto";
        popover.style.bottom = "auto";

        const onMouseMove = (moveEvent) => {
            if (!isDragging) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            newLeft = Math.max(5, newLeft);
            newTop = Math.max(5, newTop);

            popover.style.left = `${newLeft}px`;
            popover.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
    };

    header.addEventListener("mousedown", onMouseDown);
}

/**
 * Popover para ver archivos de la carpeta (Arrastrable, Redimensionable y Anclado al Scroll)
 */
export function verArchivosCarpeta(
    carpeta,
    triggerEl,
    todosLosResultados,
    seleccionarCarpetaCallback,
    abrirPDFModalCallback
) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const triggerBtn = triggerEl ? (triggerEl.closest("button") || triggerEl) : null;
    const r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r || !r.listaArchivos || r.listaArchivos.length === 0) return;

    const prev = document.getElementById("archivosPopoverActivo");
    if (prev) {
        prev.remove();
        if (prev._trigger === triggerBtn) return;
    }

    const popover = document.createElement("div");
    popover.id = "archivosPopoverActivo";
    popover.className = "archivos-floating-popover floating-popover-movable";
    popover._trigger = triggerBtn;

    const filesListHTML = r.listaArchivos
        .map((archivo) => {
            const info = obtenerInfoSoporte(archivo);
            const urlKey = Object.keys(r.fileUrls || {}).find(
                (k) => k.toLowerCase() === archivo.toLowerCase()
            );
            const url = urlKey ? r.fileUrls[urlKey] : null;
            const extraCls = info.reconocido ? "soporte-valido" : "soporte-no-reconocido";
            const iconHTML = info.reconocido
                ? `<span class="soporte-icon">${info.icono}</span>`
                : `<span class="soporte-icon error-x">❌</span>`;
            const badgeTexto = info.reconocido
                ? ""
                : `<span class="badge-no-reconocido" title="Soporte no reconocido">No reconocido</span>`;

            if (url) {
                return `<a href="#" onclick="abrirPDFModal('${url}', '${archivo}', this); return false;" class="popover-file-link ${extraCls}" title="${info.tipo}: ${archivo}">
                    ${iconHTML}
                    <span class="popover-file-name">${archivo}</span>
                    ${badgeTexto}
                </a>`;
            }
            return `<div class="popover-file-item ${extraCls}" title="${info.tipo}: ${archivo}">
                ${iconHTML}
                <span class="popover-file-name">${archivo}</span>
                ${badgeTexto}
            </div>`;
        })
        .join("");

    popover.innerHTML = `
        <div class="popover-header">
            <span class="popover-header-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                Soportes (${r.listaArchivos.length})
            </span>
            <button type="button" class="popover-close-btn" onclick="document.getElementById('archivosPopoverActivo')?.remove()">&times;</button>
        </div>
        <div class="popover-body">${filesListHTML}</div>
    `;

    const container = document.querySelector(".table-wrapper") || document.querySelector(".workspace-body") || document.body;
    container.appendChild(popover);

    if (triggerBtn) {
        const parent = popover.offsetParent || container;
        const parentRect = parent.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        const left = btnRect.left - parentRect.left + (parent.scrollLeft || 0);
        const top = btnRect.bottom - parentRect.top + (parent.scrollTop || 0) + 1;
        const maxLeft = Math.max(5, parent.clientWidth - (popover.offsetWidth || 270) - 10);

        popover.style.left = `${Math.max(5, Math.min(maxLeft, left))}px`;
        popover.style.top = `${Math.max(0, top)}px`;
    } else {
        popover.style.left = "260px";
        popover.style.top = "100px";
    }

    const closeListener = (e) => {
        if (!popover.contains(e.target) && (!triggerBtn || !triggerBtn.contains(e.target))) {
            popover.remove();
            document.removeEventListener("click", closeListener);
        }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 50);
}

/**
 * Popover para ver la programación de la matriz del paciente (Arrastrable y Redimensionable)
 */
export function verProgramadoCarpeta(
    carpeta,
    triggerEl,
    todosLosResultados,
    datosMatrizGlobal,
    seleccionarCarpetaCallback
) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const triggerBtn = triggerEl ? (triggerEl.closest("button") || triggerEl) : null;
    
    // Búsqueda inteligente y robusta del resultado del paciente
    let r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r && todosLosResultados) {
        const cNorm = String(carpeta).replace(/\\/g, "/").trim();
        for (const [k, v] of Object.entries(todosLosResultados)) {
            if (k.replace(/\\/g, "/").trim() === cNorm) {
                r = v;
                break;
            }
        }
    }
    if (!r && todosLosResultados) {
        const docClean = String(carpeta).replace(/\D/g, "");
        for (const [k, v] of Object.entries(todosLosResultados)) {
            const kDoc = (v.nroDocumento || k).replace(/\D/g, "");
            const kLast = k.replace(/\\/g, "/").split("/").pop().trim();
            if ((docClean && kDoc === docClean) || kLast === carpeta || k.includes(carpeta) || carpeta.includes(k)) {
                r = v;
                break;
            }
        }
    }

    const prev = document.getElementById("programadoPopoverActivo");
    if (prev) {
        prev.remove();
        if (prev._trigger === triggerBtn) return;
    }

    const calcularSoportesServicio = (servicioCod) => {
        if (!r?.fechasPorServicio) return 0;
        const cod = servicioCod.toUpperCase().trim();

        // 1. Clave canónica directa
        if (r.fechasPorServicio[cod] && Array.isArray(r.fechasPorServicio[cod])) {
            return [...new Set(r.fechasPorServicio[cod])].length;
        }

        // 2. Succión / TRS
        if (cod === "TRS" && r.fechasPorServicio["SUCCION"] && Array.isArray(r.fechasPorServicio["SUCCION"])) {
            return [...new Set(r.fechasPorServicio["SUCCION"])].length;
        }
        if (cod === "SUCCION" && r.fechasPorServicio["TRS"] && Array.isArray(r.fechasPorServicio["TRS"])) {
            return [...new Set(r.fechasPorServicio["TRS"])].length;
        }

        // 3. Comparación estricta de nombres completos exactos (sin includes parcial)
        const exactKeysMap = {
            "VM": ["VM", "MEDICA", "VISITA MEDICA", "VALORACION MEDICA", "VALORACIÓN MÉDICA"],
            "VENF": ["VENF", "ENFERMERIA PROFESIONAL", "ENF PROF", "ENFERMERA PROFESIONAL", "ENFERMERÍA PROFESIONAL"],
            "ENF": ["ENF", "AUXILIAR ENFERMERIA", "AUXILIAR DE ENFERMERIA", "AUXILIAR DE ENFERMERÍA", "ENFERMERIA", "AUX ENF"],
            "TF": ["TF", "TERAPIA FISICA", "FISICA", "TERAPIA FÍSICA", "FÍSICA"],
            "TR": ["TR", "TERAPIA RESPIRATORIA", "RESPIRATORIA"],
            "TRS": ["TRS", "SUCCION", "SUC", "SUCCIÓN", "TERAPIA RESPIRATORIA SUCCION", "TERAPIA RESPIRATORIA SUCCIÓN"],
            "FON": ["FON", "FONOAUDIOLOGIA", "FONO", "FONOAUDIOLOGÍA"],
            "TO": ["TO", "TERAPIA OCUPACIONAL", "OCUPACIONAL"],
            "NUT": ["NUT", "NUTRICION", "NUTRICIÓN"],
            "TS": ["TS", "TRABAJO SOCIAL"],
            "PSI": ["PSI", "PSICOLOGIA", "PSICOLOGÍA"]
        };

        const validNames = exactKeysMap[cod] || [cod];
        for (const [k, fechas] of Object.entries(r.fechasPorServicio)) {
            if (k === "General") continue;
            const kNorm = k.toUpperCase().trim();
            if (validNames.includes(kNorm)) {
                if (Array.isArray(fechas) && fechas.length > 0) {
                    return [...new Set(fechas)].length;
                }
            }
        }
        return 0;
    };

    const buscarSoporte = (servicioCod, num) => {
        if (!r?.fileUrls) return null;
        const cod = servicioCod.toUpperCase().trim();
        const aliasCod = (cod === "TRS") ? ["TRS", "SUCCION", "SUC"] : [cod];

        for (const [nombre, url] of Object.entries(r.fileUrls)) {
            const nomUpper = nombre.toUpperCase().trim();
            for (const al of aliasCod) {
                const regex = new RegExp(`^${num}[\\s_-]+${al}(\\.[a-z0-9]+|\\s|$)`, "i");
                if (regex.test(nomUpper) || nomUpper === `${num} ${al}.PDF`.toUpperCase()) {
                    return { nombre, url };
                }
            }
        }
        return null;
    };

    // Buscar datos de la matriz del paciente
    let mat = r?.datosMatriz;
    if (!mat && datosMatrizGlobal?.pacientesPorDoc) {
        const docClean = (r?.nroDocumento || carpeta || "").replace(/\D/g, "");
        if (docClean && datosMatrizGlobal.pacientesPorDoc.has(docClean)) {
            mat = datosMatrizGlobal.pacientesPorDoc.get(docClean);
        } else {
            for (const [k, v] of datosMatrizGlobal.pacientesPorDoc.entries()) {
                if (carpeta.includes(k) || (r?.nroDocumento && r.nroDocumento.includes(k))) {
                    mat = v;
                    break;
                }
            }
        }
    }

    const popover = document.createElement("div");
    popover.id = "programadoPopoverActivo";
    popover.className = "programado-floating-popover floating-popover-movable";
    popover._trigger = triggerBtn;

    let contentHTML = "";
    if (!mat) {
        contentHTML = `
            <div class="popover-empty-state">
                <div style="font-size:18px; margin-bottom:2px;">⚠️</div>
                <div style="font-weight:700; color:var(--text-pure); font-size:11px;">Sin datos en Matriz</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">No figura en la matriz Excel.</div>
            </div>
        `;
    } else {
        const s = mat.servicios || {};
        const pkgCode = mat.paquete || mat.paqueteRaw || r?.tipoPaquete || "—";
        const pkgCls = pkgCode !== "—" ? `pkg-${pkgCode.toLowerCase()}` : "";

        const renderFilaServicio = (item) => {
            const activo = item.progCount > 0 || item.sopCount > 0;
            const match = item.progCount === item.sopCount && item.progCount > 0;
            const diff = item.progCount > 0 && item.sopCount !== item.progCount;

            return `
                <div class="prog-row-item ${activo ? 'row-active' : 'row-muted'}">
                    <span class="prog-col-name" title="${item.label}">${item.label}</span>
                    <span class="prog-col-prog" title="Programado: ${item.progCount}">P:<b>${item.progCount}</b></span>
                    <span class="prog-col-sop ${match ? 'sop-ok' : (diff ? 'sop-warn' : '')}" title="En soportes: ${item.sopCount}">S:<b>${item.sopCount}</b></span>
                    <span class="prog-col-chip">
                        ${item.sop4 
                            ? `<button type="button" class="btn-pdf-subtle" onclick="abrirPDFModal('${item.sop4.url}', '${item.sop4.nombre}', this); return false;" title="Ver ${item.sop4.nombre} en visor PDF">4</button>` 
                            : `<span class="chip-dash">—</span>`}
                    </span>
                    <span class="prog-col-chip">
                        ${item.sop5 
                            ? `<button type="button" class="btn-pdf-subtle" onclick="abrirPDFModal('${item.sop5.url}', '${item.sop5.nombre}', this); return false;" title="Ver ${item.sop5.nombre} en visor PDF">5</button>` 
                            : `<span class="chip-dash">—</span>`}
                    </span>
                </div>
            `;
        };

        // 1. Servicios Fijos
        const grupoFijos = [
            { id: "VM", label: "Médica (VM)", progCount: s.VM ?? 0 },
            { id: "VENF", label: "Enf. Profesional (VENF)", progCount: s.VENF ?? 0 },
            { id: "ENF", label: "Aux. Enfermería (ENF)", progCount: s.ENF ?? 0 },
        ].map(f => {
            const cantFechas = calcularSoportesServicio(f.id);
            const sop4 = buscarSoporte(f.id, "4");
            const sop5 = buscarSoporte(f.id, "5");
            const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
            return { ...f, sopCount, sop4, sop5 };
        });

        // 2. Terapias
        const grupoTerapias = [
            { id: "TF", label: "Terapia Física (TF)", progCount: s.TF || 0 },
            { id: "TR", label: "Terapia Respiratoria (TR)", progCount: s.TR || 0 },
            { id: "TRS", label: "T. Resp. Succión (TRS)", progCount: s.TRS || s.SUCCION || 0 },
            { id: "FON", label: "Fonoaudiología (FON)", progCount: s.FON || 0 },
            { id: "TO", label: "Terapia Ocupacional (TO)", progCount: s.TO || 0 },
        ].map(t => {
            const sopCount = calcularSoportesServicio(t.id);
            const sop4 = buscarSoporte(t.id, "4");
            const sop5 = buscarSoporte(t.id, "5");
            return { ...t, sopCount, sop4, sop5 };
        });

        // 3. Otros Servicios
        const grupoOtros = [
            { id: "PSI", label: "Psicología (PSI)", progCount: s.PSI || 0 },
            { id: "TS", label: "Trabajo Social (TS)", progCount: s.TS || 0 },
            { id: "NUT", label: "Nutrición (NUT)", progCount: s.NUT || 0 },
        ].map(o => {
            const sopCount = calcularSoportesServicio(o.id);
            const sop4 = buscarSoporte(o.id, "4");
            const sop5 = buscarSoporte(o.id, "5");
            return { ...o, sopCount, sop4, sop5 };
        });

        const totalTerapiasProg = mat.totalTerapias !== undefined 
            ? mat.totalTerapias 
            : ((s.TF || 0) + (s.TR || 0) + (s.TRS || s.SUCCION || 0) + (s.FON || 0) + (s.TO || 0));

        const totalTerapiasSop = ["TF", "TR", "TRS", "FON", "TO"].reduce((acc, tid) => acc + calcularSoportesServicio(tid), 0);

        let avisosHTML = "";
        if ((mat.errores && mat.errores.length > 0) || (mat.alertas && mat.alertas.length > 0)) {
            const errs = (mat.errores || []).map(e => `<div class="prog-err-line error">❌ ${e}</div>`).join("");
            const alts = (mat.alertas || []).map(a => `<div class="prog-err-line warning">⚠️ ${a}</div>`).join("");
            avisosHTML = `
                <div class="prog-section-title" style="color:#ef4444; margin-top:6px;">Novedades Matriz</div>
                <div class="prog-err-container">${errs}${alts}</div>
            `;
        }

        contentHTML = `
            <div class="prog-patient-header">
                <div class="prog-patient-name" title="${mat.nombre || '—'}">${mat.nombre || 'Paciente'}</div>
                <div class="prog-patient-meta">
                    <span class="prog-meta-badge">Doc: <strong>${mat.documento || carpeta}</strong></span>
                    ${mat.filaExcel ? `<span class="prog-meta-badge">Fila: <strong>#${mat.filaExcel}</strong></span>` : ''}
                    <span class="doc-package-tag ${pkgCls} prog-pkg-badge">${pkgCode}</span>
                </div>
            </div>

            <!-- Servicios Fijos -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Servicios Fijos</span>
                </div>
                <div class="prog-category-list">
                    ${grupoFijos.map(renderFilaServicio).join("")}
                </div>
            </div>

            <!-- Terapias -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Terapias</span>
                    <span class="prog-total-terapias-badge" title="Total Programado: ${totalTerapiasProg} | Total Soportes: ${totalTerapiasSop}">Prog: ${totalTerapiasProg} | Sop: ${totalTerapiasSop}</span>
                </div>
                <div class="prog-category-list">
                    ${grupoTerapias.map(renderFilaServicio).join("")}
                </div>
            </div>

            <!-- Otros Servicios -->
            <div class="prog-category-block">
                <div class="prog-category-header">
                    <span>Otros Servicios</span>
                </div>
                <div class="prog-category-list">
                    ${grupoOtros.map(renderFilaServicio).join("")}
                </div>
            </div>

            ${avisosHTML}
        `;
    }

    popover.innerHTML = `
        <div class="popover-header">
            <span class="popover-header-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                Programado
            </span>
            <div class="popover-header-actions">
                <button type="button" class="popover-expand-btn" onclick="abrirModalProgramadoDetallado('${carpeta}'); return false;" title="Abrir en ventana grande / Pop up">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>
                </button>
                <button type="button" class="popover-close-btn" onclick="document.getElementById('programadoPopoverActivo')?.remove()">&times;</button>
            </div>
        </div>
        <div class="popover-body prog-popover-body">${contentHTML}</div>
    `;

    const container = document.querySelector(".table-wrapper") || document.querySelector(".workspace-body") || document.body;
    container.appendChild(popover);

    if (triggerBtn) {
        const parent = popover.offsetParent || container;
        const parentRect = parent.getBoundingClientRect();
        const btnRect = triggerBtn.getBoundingClientRect();

        const left = btnRect.left - parentRect.left + (parent.scrollLeft || 0);
        const top = btnRect.bottom - parentRect.top + (parent.scrollTop || 0) + 1;
        const maxLeft = Math.max(5, parent.clientWidth - (popover.offsetWidth || 250) - 10);

        popover.style.left = `${Math.max(5, Math.min(maxLeft, left))}px`;
        popover.style.top = `${Math.max(0, top)}px`;
    } else {
        popover.style.left = "260px";
        popover.style.top = "100px";
    }

    const closeListener = (e) => {
        if (!popover.contains(e.target) && (!triggerBtn || !triggerBtn.contains(e.target))) {
            popover.remove();
            document.removeEventListener("click", closeListener);
        }
    };
    setTimeout(() => document.addEventListener("click", closeListener), 50);
}

/**
 * Modal amplio y detallado para ver la programación vs soportes del paciente (Pop Up grande y claro)
 */
export function mostrarModalProgramadoDetallado(
    carpeta,
    todosLosResultados,
    datosMatrizGlobal
) {
    const prev = document.getElementById("modalProgramadoDetalladoActivo");
    if (prev) prev.remove();

    // Búsqueda inteligente del resultado
    let r = todosLosResultados ? todosLosResultados[carpeta] : null;
    if (!r && todosLosResultados) {
        const cNorm = String(carpeta).replace(/\\/g, "/").trim();
        for (const [k, v] of Object.entries(todosLosResultados)) {
            if (k.replace(/\\/g, "/").trim() === cNorm) {
                r = v;
                break;
            }
        }
    }
    if (!r && todosLosResultados) {
        const docClean = String(carpeta).replace(/\D/g, "");
        for (const [k, v] of Object.entries(todosLosResultados)) {
            const kDoc = (v.nroDocumento || k).replace(/\D/g, "");
            const kLast = k.replace(/\\/g, "/").split("/").pop().trim();
            if ((docClean && kDoc === docClean) || kLast === carpeta || k.includes(carpeta) || carpeta.includes(k)) {
                r = v;
                break;
            }
        }
    }

    const calcularSoportesServicio = (servicioCod) => {
        if (!r?.fechasPorServicio) return 0;
        const cod = servicioCod.toUpperCase().trim();

        // 1. Clave canónica directa
        if (r.fechasPorServicio[cod] && Array.isArray(r.fechasPorServicio[cod])) {
            return [...new Set(r.fechasPorServicio[cod])].length;
        }

        // 2. Succión / TRS
        if (cod === "TRS" && r.fechasPorServicio["SUCCION"] && Array.isArray(r.fechasPorServicio["SUCCION"])) {
            return [...new Set(r.fechasPorServicio["SUCCION"])].length;
        }
        if (cod === "SUCCION" && r.fechasPorServicio["TRS"] && Array.isArray(r.fechasPorServicio["TRS"])) {
            return [...new Set(r.fechasPorServicio["TRS"])].length;
        }

        // 3. Comparación estricta de nombres completos exactos (sin includes parcial)
        const exactKeysMap = {
            "VM": ["VM", "MEDICA", "VISITA MEDICA", "VALORACION MEDICA", "VALORACIÓN MÉDICA"],
            "VENF": ["VENF", "ENFERMERIA PROFESIONAL", "ENF PROF", "ENFERMERA PROFESIONAL", "ENFERMERÍA PROFESIONAL"],
            "ENF": ["ENF", "AUXILIAR ENFERMERIA", "AUXILIAR DE ENFERMERIA", "AUXILIAR DE ENFERMERÍA", "ENFERMERIA", "AUX ENF"],
            "TF": ["TF", "TERAPIA FISICA", "FISICA", "TERAPIA FÍSICA", "FÍSICA"],
            "TR": ["TR", "TERAPIA RESPIRATORIA", "RESPIRATORIA"],
            "TRS": ["TRS", "SUCCION", "SUC", "SUCCIÓN", "TERAPIA RESPIRATORIA SUCCION", "TERAPIA RESPIRATORIA SUCCIÓN"],
            "FON": ["FON", "FONOAUDIOLOGIA", "FONO", "FONOAUDIOLOGÍA"],
            "TO": ["TO", "TERAPIA OCUPACIONAL", "OCUPACIONAL"],
            "NUT": ["NUT", "NUTRICION", "NUTRICIÓN"],
            "TS": ["TS", "TRABAJO SOCIAL"],
            "PSI": ["PSI", "PSICOLOGIA", "PSICOLOGÍA"]
        };

        const validNames = exactKeysMap[cod] || [cod];
        for (const [k, fechas] of Object.entries(r.fechasPorServicio)) {
            if (k === "General") continue;
            const kNorm = k.toUpperCase().trim();
            if (validNames.includes(kNorm)) {
                if (Array.isArray(fechas) && fechas.length > 0) {
                    return [...new Set(fechas)].length;
                }
            }
        }
        return 0;
    };

    const buscarSoporte = (servicioCod, num) => {
        if (!r?.fileUrls) return null;
        const cod = servicioCod.toUpperCase().trim();
        const aliasCod = (cod === "TRS") ? ["TRS", "SUCCION", "SUC"] : [cod];

        for (const [nombre, url] of Object.entries(r.fileUrls)) {
            const nomUpper = nombre.toUpperCase().trim();
            for (const al of aliasCod) {
                const regex = new RegExp(`^${num}[\\s_-]+${al}(\\.[a-z0-9]+|\\s|$)`, "i");
                if (regex.test(nomUpper) || nomUpper === `${num} ${al}.PDF`.toUpperCase()) {
                    return { nombre, url };
                }
            }
        }
        return null;
    };

    let mat = r?.datosMatriz;
    if (!mat && datosMatrizGlobal?.pacientesPorDoc) {
        const docClean = (r?.nroDocumento || carpeta || "").replace(/\D/g, "");
        if (docClean && datosMatrizGlobal.pacientesPorDoc.has(docClean)) {
            mat = datosMatrizGlobal.pacientesPorDoc.get(docClean);
        } else {
            for (const [k, v] of datosMatrizGlobal.pacientesPorDoc.entries()) {
                if (carpeta.includes(k) || (r?.nroDocumento && r.nroDocumento.includes(k))) {
                    mat = v;
                    break;
                }
            }
        }
    }

    const backdrop = document.createElement("div");
    backdrop.id = "modalProgramadoDetalladoActivo";
    backdrop.className = "modal-rules-backdrop";

    if (!mat) {
        backdrop.innerHTML = `
            <div class="modal-rules-card" style="max-width: 440px;" onclick="event.stopPropagation()">
                <div class="modal-rules-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:18px;">⚠️</span>
                        <h3 class="modal-rules-title">Programado en Matriz</h3>
                    </div>
                    <button type="button" class="btn-close-rules" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">&times;</button>
                </div>
                <div class="modal-rules-body" style="text-align:center; padding:24px 16px;">
                    <div style="font-weight:700; font-size:14px; color:var(--text-pure);">Sin datos en la Matriz Excel</div>
                    <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">El paciente <strong>${carpeta}</strong> no figura en la matriz Excel cargada.</div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);
        backdrop.addEventListener("click", () => backdrop.remove());
        return;
    }

    const s = mat.servicios || {};
    const pkgCode = mat.paquete || mat.paqueteRaw || r?.tipoPaquete || "—";
    const pkgCls = pkgCode !== "—" ? `pkg-${pkgCode.toLowerCase()}` : "";

    const renderFilaServicioModal = (item) => {
        const activo = item.progCount > 0 || item.sopCount > 0;
        const match = item.progCount === item.sopCount && item.progCount > 0;
        const diff = item.progCount > 0 && item.sopCount !== item.progCount;

        return `
            <div class="prog-modal-stat-item ${activo ? 'stat-active' : 'stat-muted'}">
                <span class="prog-modal-stat-label"><strong>${item.label}</strong></span>
                <span class="prog-modal-val-p" title="Programado: ${item.progCount}">Prog: <b>${item.progCount}</b></span>
                <span class="prog-modal-val-s ${match ? 'sop-ok' : (diff ? 'sop-warn' : '')}" title="En Soportes: ${item.sopCount}">Sop: <b>${item.sopCount}</b></span>
                <div class="prog-modal-stat-btns">
                    ${item.sop4 ? `<button type="button" class="btn-pdf-subtle modal-btn" onclick="abrirPDFModal('${item.sop4.url}', '${item.sop4.nombre}', this); return false;" title="Ver ${item.sop4.nombre}">4</button>` : `<span class="chip-dash">—</span>`}
                    ${item.sop5 ? `<button type="button" class="btn-pdf-subtle modal-btn" onclick="abrirPDFModal('${item.sop5.url}', '${item.sop5.nombre}', this); return false;" title="Ver ${item.sop5.nombre}">5</button>` : `<span class="chip-dash">—</span>`}
                </div>
            </div>
        `;
    };

    // 1. Servicios Fijos
    const grupoFijos = [
        { id: "VM", label: "Médica (VM)", progCount: s.VM ?? 0 },
        { id: "VENF", label: "Enf. Profesional (VENF)", progCount: s.VENF ?? 0 },
        { id: "ENF", label: "Aux. Enfermería (ENF)", progCount: s.ENF ?? 0 },
    ].map(f => {
        const cantFechas = calcularSoportesServicio(f.id);
        const sop4 = buscarSoporte(f.id, "4");
        const sop5 = buscarSoporte(f.id, "5");
        const sopCount = cantFechas > 0 ? cantFechas : ((sop4 || sop5) ? 1 : 0);
        return { ...f, sopCount, sop4, sop5 };
    });

    // 2. Terapias
    const grupoTerapias = [
        { id: "TF", label: "Terapia Física (TF)", progCount: s.TF || 0 },
        { id: "TR", label: "Terapia Respiratoria (TR)", progCount: s.TR || 0 },
        { id: "TRS", label: "T. Resp. Succión (TRS)", progCount: s.TRS || s.SUCCION || 0 },
        { id: "FON", label: "Fonoaudiología (FON)", progCount: s.FON || 0 },
        { id: "TO", label: "Terapia Ocupacional (TO)", progCount: s.TO || 0 },
    ].map(t => {
        const sopCount = calcularSoportesServicio(t.id);
        const sop4 = buscarSoporte(t.id, "4");
        const sop5 = buscarSoporte(t.id, "5");
        return { ...t, sopCount, sop4, sop5 };
    });

    // 3. Otros Servicios
    const grupoOtros = [
        { id: "PSI", label: "Psicología (PSI)", progCount: s.PSI || 0 },
        { id: "TS", label: "Trabajo Social (TS)", progCount: s.TS || 0 },
        { id: "NUT", label: "Nutrición (NUT)", progCount: s.NUT || 0 },
    ].map(o => {
        const sopCount = calcularSoportesServicio(o.id);
        const sop4 = buscarSoporte(o.id, "4");
        const sop5 = buscarSoporte(o.id, "5");
        return { ...o, sopCount, sop4, sop5 };
    });

    const totalTerapiasProg = mat.totalTerapias !== undefined 
        ? mat.totalTerapias 
        : ((s.TF || 0) + (s.TR || 0) + (s.TRS || s.SUCCION || 0) + (s.FON || 0) + (s.TO || 0));

    const totalTerapiasSop = ["TF", "TR", "TRS", "FON", "TO"].reduce((acc, tid) => acc + calcularSoportesServicio(tid), 0);

    let avisosModalHTML = "";
    if ((mat.errores && mat.errores.length > 0) || (mat.alertas && mat.alertas.length > 0)) {
        const errs = (mat.errores || []).map(e => `<div class="prog-err-line error">❌ ${e}</div>`).join("");
        const alts = (mat.alertas || []).map(a => `<div class="prog-err-line warning">⚠️ ${a}</div>`).join("");
        avisosModalHTML = `
            <div style="font-size:12px; font-weight:700; color:#ef4444; margin-top:10px;">Novedades Detectadas en la Matriz</div>
            <div class="prog-err-container" style="padding:8px 10px; font-size:11.5px;">${errs}${alts}</div>
        `;
    }

    backdrop.innerHTML = `
        <div class="modal-rules-card" style="max-width: 580px; width: 95%; max-height: 85vh; display:flex; flex-direction:column; box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
            <div class="modal-rules-header" style="padding:14px 18px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:#107c41;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
                    <h3 class="modal-rules-title" style="font-size:15px; margin:0;">Programado en Matriz vs Soportes</h3>
                </div>
                <button type="button" class="btn-close-rules" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">&times;</button>
            </div>

            <div class="modal-rules-body" style="padding:16px 20px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
                <div class="prog-patient-header" style="padding:10px 14px; font-size:12px;">
                    <div style="font-size:13.5px; font-weight:800; color:var(--text-pure);">${mat.nombre || 'Paciente'}</div>
                    <div class="prog-patient-meta" style="font-size:11px; margin-top:4px; gap:8px;">
                        <span class="prog-meta-badge" style="padding:2px 6px;">Doc: <strong>${mat.documento || carpeta}</strong></span>
                        ${mat.filaExcel ? `<span class="prog-meta-badge" style="padding:2px 6px;">Fila: <strong>#${mat.filaExcel}</strong></span>` : ''}
                        <span class="doc-package-tag ${pkgCls} prog-pkg-badge" style="font-size:10px !important; padding:2px 8px !important;">${pkgCode}</span>
                    </div>
                </div>

                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">Servicios Fijos</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoFijos.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.4px;">Terapias</span>
                        <span class="prog-total-terapias-badge" style="font-size:10.5px; padding:2px 8px;">Total Prog: ${totalTerapiasProg} | Total Sop: ${totalTerapiasSop}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoTerapias.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                <div>
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px; letter-spacing:0.4px;">Otros Servicios</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        ${grupoOtros.map(renderFilaServicioModal).join("")}
                    </div>
                </div>

                ${avisosModalHTML}
            </div>

            <div style="padding:10px 20px; background:var(--bg-subtle); border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end;">
                <button type="button" class="btn-studio btn-studio-primary" style="padding:6px 18px; font-size:12px; font-weight:600;" onclick="document.getElementById('modalProgramadoDetalladoActivo')?.remove()">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Modal de diagnóstico y prevalidación de matriz
 */
export function mostrarModalPrevalidacionMatriz(matrizData) {
    if (!matrizData) return;

    const prev = document.getElementById("modalPrevalidacionMatrizActivo");
    if (prev) prev.remove();

    const { diagnosticoGlobal, pacientesList } = matrizData;

    const backdrop = document.createElement("div");
    backdrop.id = "modalPrevalidacionMatrizActivo";
    backdrop.className = "modal-rules-backdrop";

    const totalPacientes = diagnosticoGlobal.totalPacientes || 0;
    const conErrores = diagnosticoGlobal.pacientesConErrores || 0;
    const conformes = totalPacientes - conErrores;

    // Badges de conteo por paquete con los colores oficiales de badges
    const paquetesHTML = Object.entries(diagnosticoGlobal.conteoPorPaquete || {})
        .map(([pkg, count]) => {
            const pkgCls = `pkg-${pkg.toLowerCase()}`;
            return `
                <div class="preval-pkg-chip doc-package-tag ${pkgCls}">
                    <span class="package-name">${pkg}</span>
                    <span class="preval-pkg-count">${count}</span>
                </div>
            `;
        })
        .join("") || "<span style='color:var(--text-muted); font-size:11px;'>Sin paquetes</span>";

    // Helper para formatear nombres a Title/PascalCase
    const formatPascalCase = (str) => {
        if (!str) return "—";
        return str.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, match => match.toUpperCase());
    };

    // Filas de la tabla
    const filasHTML = pacientesList.map((p) => {
        const estadoBadge = p.valido
            ? `<span class="preval-badge success">✔ Conforme</span>`
            : `<span class="preval-badge error">✗ Novedades</span>`;

        const renderDiagItem = (texto, tipo) => {
            const icon = tipo === "error" ? "✕" : "!";
            const cls = tipo === "error" ? "preval-item-error" : "preval-item-warning";
            const parts = texto.split(":");
            if (parts.length > 1) {
                const header = parts[0].trim();
                const body = parts.slice(1).join(":").trim();
                return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span class="preval-err-tag">${header}</span><span class="preval-err-desc">${formatearErrorConIconosPDF(body)}</span></div>`;
            }
            return `<div class="${cls}"><span class="preval-icon-bullet">${icon}</span><span>${formatearErrorConIconosPDF(texto)}</span></div>`;
        };

        const detalles = [
            ...(p.errores || []).map(e => renderDiagItem(e, "error")),
            ...(p.alertas || []).map(a => renderDiagItem(a, "warning")),
        ].join("");

        const pkgCode = p.paquete || p.paqueteRaw || "—";
        const pkgCls = p.paquete ? `pkg-${p.paquete.toLowerCase()}` : "";
        const s = p.servicios || {};

        // Helper para formatear cadenas a PascalCase
        const toPascalCase = (str) => {
            if (!str) return "—";
            return str
                .toLowerCase()
                .replace(/(?:^|\s|\/|-)\S/g, (match) => match.toUpperCase());
        };

        const nombrePascal = toPascalCase(p.nombre);

        // Desglose de terapias con formato visual (grisesito las que tienen 0)
        const listaTerapias = [
            { nombre: "TF", cant: s.TF || 0 },
            { nombre: "TR", cant: s.TR || 0 },
            { nombre: "TRS", cant: s.TRS || 0 },
            { nombre: "FON", cant: s.FON || 0 },
            { nombre: "TO", cant: s.TO || 0 },
        ];

        const terapiasDetalleChips = listaTerapias
            .map((t) => `<span class="pserv-ter-item ${t.cant === 0 ? 'zero' : 'active'}">${t.nombre}:${t.cant}</span>`)
            .join(" ");

        // Texto plano del error para el botón de copiar
        const textoErroresRaw = (p.errores || []).join(" | ") || (p.alertas || []).join(" | ") || "Conforme";
        const textoErroresEscaped = textoErroresRaw.replace(/'/g, "\\'");

        // 3 Grupos ordenados, alineados en columnas consistentes
        const chipsServicios = `
            <div class="preval-services-structured">
                <!-- 1. Fijos Obligatorios -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Fijos:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag oblig ${s.VM === 1 ? 'ok' : 'err'}">VM: ${s.VM}</span>
                        <span class="pserv-tag oblig ${s.VENF === 1 ? 'ok' : 'err'}">VENF: ${s.VENF}</span>
                        <span class="pserv-tag oblig ${s.ENF === 1 ? 'ok' : 'err'}">ENF: ${s.ENF}</span>
                    </div>
                </div>

                <!-- 2. Opcional A Elección -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Opcional:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag opt ${s.PSI > 0 ? 'active' : 'dim'}">PSI: ${s.PSI}</span>
                        <span class="pserv-tag opt ${s.NUT > 0 ? 'active' : 'dim'}">NUT: ${s.NUT}</span>
                        <span class="pserv-tag opt ${s.TS > 0 ? 'active' : 'dim'}">TS: ${s.TS}</span>
                    </div>
                </div>

                <!-- 3. Terapias con Desglose y Suma -->
                <div class="pserv-group">
                    <span class="pserv-group-title">Terapias:</span>
                    <div class="pserv-group-items">
                        <span class="pserv-tag ter-total">Total: ${p.totalTerapias}</span>
                        <div class="pserv-tag ter-detail">${terapiasDetalleChips}</div>
                    </div>
                </div>
            </div>
        `;

        return `
            <tr class="preval-row ${p.valido ? 'valido' : 'con-novedad'}" data-doc="${p.documento || ''}" data-nombre="${(p.nombre || '').toLowerCase()}" data-pkg="${pkgCode}" data-estado="${p.valido ? 'conforme' : 'novedades'}">
                <td class="preval-cell-num">${p.filaExcel}</td>
                <td class="preval-cell-doc">
                    <div class="doc-badge-stack preval-doc-badge-stack">
                        <div class="doc-package-tag ${pkgCls}">
                            <span class="package-name">${pkgCode}</span>
                            <button type="button" class="btn-package-rules" onclick="mostrarModalReglasPaquete('${pkgCode}')" title="Ver reglas de ${pkgCode}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </button>
                        </div>
                        <div class="doc-title-line preval-doc-title-line">
                            <span class="carpeta-nombre preval-doc-num">${p.documento || "—"}</span>
                        </div>
                        <div class="preval-copy-btn-group">
                            <button type="button" class="btn-copy-minimal btn-copy-doc" title="Copiar sólo documento (${p.documento})">📋</button>
                            <button type="button" class="btn-copy-minimal btn-copy-pkg-doc" title="Copiar '${pkgCode} - ${p.documento} - '">🏷️</button>
                            <button type="button" class="btn-copy-minimal btn-copy-err" title="Copiar con novedad">📝</button>
                        </div>
                    </div>
                </td>
                <td class="preval-cell-name-full" title="${p.nombre || ''}">${nombrePascal}</td>
                <td class="preval-cell-terapias">
                    ${chipsServicios}
                </td>
                <td class="preval-cell-status">${estadoBadge}</td>
                <td class="preval-cell-diag">${detalles || '<span class="preval-ok-text">Cumple todas las condiciones</span>'}</td>
            </tr>
        `;
    }).join("");

    backdrop.innerHTML = `
        <div class="preval-modal-card" onclick="event.stopPropagation()">
            <!-- Modal Header Compacto -->
            <div class="preval-modal-header">
                <div class="preval-title-group">
                    <div class="preval-header-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </div>
                    <div>
                        <h2 class="preval-modal-title">Pre-validación de Matriz</h2>
                        <p class="preval-modal-subtitle">Verificación automática de reglas de paquete antes de la auditoría</p>
                    </div>
                </div>
                <button type="button" class="modal-rules-close" onclick="document.getElementById('modalPrevalidacionMatrizActivo')?.remove()" title="Cerrar">&times;</button>
            </div>

            <!-- Modal Content Body -->
            <div class="preval-modal-body">
                <!-- Ribbon Stats y Chips de Paquete -->
                <div class="preval-top-toolbar">
                    <div class="stats-cluster">
                        <div class="stat-pill">
                            <span class="stat-pill-label">Total</span>
                            <span class="stat-pill-value" id="prevalKpiTotal">${totalPacientes}</span>
                        </div>
                        <div class="stat-pill success">
                            <span class="stat-pill-label">Conformes</span>
                            <span class="stat-pill-value" id="prevalKpiConformes">${conformes}</span>
                        </div>
                        <div class="stat-pill ${conErrores > 0 ? 'error' : ''}" style="display: flex; align-items: center; gap: 8px;">
                            <div>
                                <span class="stat-pill-label">Novedades</span>
                                <span class="stat-pill-value" id="prevalKpiNovedades">${conErrores}</span>
                            </div>
                            <button type="button" id="btnCopiarTodasNovedadesMatriz" class="btn-copy-pill" title="Copiar todas las novedades visibles de la matriz (Documento - Paquete - Novedad)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                <span>Copiar</span>
                            </button>
                        </div>
                    </div>

                    <div class="preval-pkg-section">
                        <span class="preval-pkg-section-label">Paquetes:</span>
                        <div class="preval-pkg-cluster">${paquetesHTML}</div>
                    </div>
                </div>

                <!-- Barra de Búsqueda y Filtros Integrada -->
                <div class="preval-filter-strip">
                    <div class="preval-search-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="prevalBuscarInput" class="preval-input-search" placeholder="Buscar por documento o nombre..." />
                    </div>

                    <div class="preval-filter-group">
                        <div class="studio-segmented-control" id="prevalFiltroEstadoGroup">
                            <button type="button" class="btn-segmented active" data-filter-estado="">Todos</button>
                            <button type="button" class="btn-segmented" data-filter-estado="conforme">Conformes</button>
                            <button type="button" class="btn-segmented" data-filter-estado="novedades">Con novedades</button>
                        </div>
                    </div>
                </div>

                <!-- Tabla de Diagnóstico Compacta -->
                <div class="preval-table-container">
                    <table class="preval-table" id="prevalTableMain">
                        <thead>
                            <tr>
                                <th style="width: 36px;">Fila</th>
                                <th style="width: 120px;">Documento</th>
                                <th style="width: 180px;">Nombre Paciente</th>
                                <th style="width: 320px;">Programación Matriz</th>
                                <th style="width: 95px;">Estado</th>
                                <th>Hallazgos / Reglas</th>
                            </tr>
                        </thead>
                        <tbody id="prevalTableBody">
                            ${filasHTML}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="preval-modal-footer">
                <span class="preval-footer-hint">Las cantidades programadas en la matriz se compararán de forma estricta contra las evoluciones de los PDFs.</span>
                <label class="studio-dropzone mini-dropzone" id="dropzoneModalSoportes" title="Click o arrastra la carpeta de soportes aquí">
                    <div class="dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div class="dropzone-text-row">
                        <span class="dropzone-title">Cargar Soportes</span>
                        <span class="dropzone-subtitle">(Click o arrastra carpeta)</span>
                    </div>
                    <input type="file" id="inputFolderModal" webkitdirectory directory multiple />
                </label>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    // Conectar el input del mini dropzone con el input principal para disparar la validación
    const inputFolderModal = document.getElementById("inputFolderModal");
    if (inputFolderModal) {
        inputFolderModal.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                // Cerrar modal de prevalidación
                backdrop.remove();
                // Mostrar sección de soportes
                const secSoportes = document.getElementById("seccionSoportes");
                if (secSoportes) secSoportes.classList.remove("oculto");
                // Transferir archivos y disparar validación en el input principal
                const mainInput = document.getElementById("inputFolder");
                if (mainInput) {
                    mainInput.files = files;
                    mainInput.dispatchEvent(new Event("change"));
                }
            }
        });
    }

    // ================= FUNCIONALIDAD DE FILTRADO DINÁMICO =================
    const buscarInput = document.getElementById("prevalBuscarInput");
    const filtroEstadoBtns = document.querySelectorAll("#prevalFiltroEstadoGroup .btn-segmented");
    const tbody = document.getElementById("prevalTableBody");

    let estadoActivo = "";

    const aplicarFiltrosModal = () => {
        if (!tbody) return;
        const q = (buscarInput?.value || "").toLowerCase().trim();
        const filas = tbody.querySelectorAll("tr.preval-row");

        filas.forEach((tr) => {
            const doc = tr.getAttribute("data-doc") || "";
            const nombre = tr.getAttribute("data-nombre") || "";
            const estado = tr.getAttribute("data-estado") || "";

            const matchTexto = !q || doc.includes(q) || nombre.includes(q);
            const matchEstado = !estadoActivo || estado === estadoActivo;

            if (matchTexto && matchEstado) {
                tr.style.display = "";
            } else {
                tr.style.display = "none";
            }
        });
    };

    if (buscarInput) {
        buscarInput.addEventListener("input", aplicarFiltrosModal);
    }

    if (filtroEstadoBtns) {
        filtroEstadoBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                filtroEstadoBtns.forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                estadoActivo = btn.getAttribute("data-filter-estado") || "";
                aplicarFiltrosModal();
            });
        });
    }

    // Event delegation para los 3 botones de copiar en cada fila
    if (tbody) {
        tbody.addEventListener("click", (e) => {
            const btnDoc = e.target.closest(".btn-copy-doc");
            const btnPkgDoc = e.target.closest(".btn-copy-pkg-doc");
            const btnErr = e.target.closest(".btn-copy-err");

            if (!btnDoc && !btnPkgDoc && !btnErr) return;
            e.stopPropagation();

            const tr = e.target.closest("tr.preval-row");
            if (!tr) return;

            const doc = tr.getAttribute("data-doc") || "";
            const pkg = tr.getAttribute("data-pkg") || "";
            const paciente = pacientesList.find((p) => String(p.documento || "").trim() === String(doc).trim());

            if (btnDoc) {
                copiarTextoSimple(e, doc);
            } else if (btnPkgDoc) {
                copiarTextoSimple(e, `${pkg} - ${doc} - `);
            } else if (btnErr) {
                const textoErroresRaw = paciente
                    ? (paciente.errores || []).join(" | ") || (paciente.alertas || []).join(" | ") || "Conforme"
                    : "Conforme";
                copiarErrorMatriz(e, pkg, doc, textoErroresRaw);
            }
        });
    }

    // Botón masivo para copiar todas las novedades de la matriz
    const btnCopiarTodas = document.getElementById("btnCopiarTodasNovedadesMatriz");
    if (btnCopiarTodas) {
        btnCopiarTodas.addEventListener("click", async (e) => {
            e.stopPropagation();

            // Obtener documentos de filas visibles según filtros actuales
            const filasVisibles = tbody
                ? Array.from(tbody.querySelectorAll("tr.preval-row")).filter((tr) => tr.style.display !== "none")
                : [];
            const docsVisibles = new Set(filasVisibles.map((tr) => (tr.getAttribute("data-doc") || "").trim()).filter(Boolean));

            const pacientesConNovedad = pacientesList.filter((p) => {
                const tieneNovedad = (p.errores && p.errores.length > 0) || (p.alertas && p.alertas.length > 0);
                if (!tieneNovedad) return false;
                const docStr = String(p.documento || "").trim();
                return docsVisibles.size > 0 ? docsVisibles.has(docStr) : true;
            });

            if (pacientesConNovedad.length === 0) {
                mostrarToastCopia("No hay novedades para copiar");
                return;
            }

            const lineas = pacientesConNovedad.map((p) => {
                const pkg = p.paquete || p.paqueteRaw || "CPF";
                const errText = (p.errores || []).join(" | ") || (p.alertas || []).join(" | ") || "Sin novedades";
                return `${p.documento} - ${pkg} - ${errText.trim()}`;
            });

            const textoFinal = lineas.join("\n");
            await copiarTextoAlPortapapeles(textoFinal);
            mostrarToastCopia(`${lineas.length} novedades copiadas`);

            const origHTML = btnCopiarTodas.innerHTML;
            btnCopiarTodas.innerHTML = `✓ ${lineas.length} Copiadas`;
            btnCopiarTodas.style.color = "#10b981";
            btnCopiarTodas.style.borderColor = "#10b981";
            setTimeout(() => {
                btnCopiarTodas.innerHTML = origHTML;
                btnCopiarTodas.style.color = "";
                btnCopiarTodas.style.borderColor = "";
            }, 2000);
        });
    }
}

/**
 * Modal emergente al terminar la validación que avisa si se encontraron errores
 */
export function mostrarModalAlertaFinalValidacion(totalCarpetas, totalConErrores, totalConAlertas, contexto = "auditoria") {
    const prev = document.getElementById("modalAlertaFinalValidacionActivo");
    if (prev) prev.remove();

    const esMatriz = contexto === "matriz";
    const hayProblemas = totalConErrores > 0;
    const soloAlertas = !hayProblemas && totalConAlertas > 0;
    const conformes = Math.max(0, totalCarpetas - totalConErrores - totalConAlertas);

    const backdrop = document.createElement("div");
    backdrop.id = "modalAlertaFinalValidacionActivo";
    backdrop.className = "modal-rules-backdrop";
    backdrop.style.zIndex = "2100";

    const iconoSVG = hayProblemas
        ? `<div class="modal-aviso-firmas-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">⚠️</div>`
        : soloAlertas
            ? `<div class="modal-aviso-firmas-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">🔔</div>`
            : `<div class="modal-aviso-firmas-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">✅</div>`;

    const tituloModal = esMatriz
        ? (hayProblemas
            ? "Pre-validación: Matriz con Novedades"
            : (soloAlertas ? "Pre-validación: Matriz con Alertas" : "Pre-validación: Matriz Conforme"))
        : (hayProblemas
            ? "Validación Finalizada con Novedades"
            : (soloAlertas ? "Validación Finalizada con Alertas" : "Validación Finalizada con Éxito"));

    const subtituloModal = esMatriz
        ? "Diagnóstico de programación de matriz"
        : "Resumen general de auditoría";

    const mensajePrincipal = esMatriz
        ? (hayProblemas
            ? `Se han detectado <strong style="color:#ef4444;">${totalConErrores} paciente(s) con inconsistencias</strong> en las reglas de paquetes programados en la matriz.`
            : (soloAlertas
                ? `Se han detectado <strong style="color:#f59e0b;">${totalConAlertas} paciente(s) con alertas</strong> en la matriz.`
                : `Los <strong>${totalCarpetas} paciente(s)</strong> de la matriz cumplen las reglas de paquete.`))
        : (hayProblemas
            ? `Se han detectado <strong style="color:#ef4444;">${totalConErrores} paciente(s) con novedades o inconsistencias</strong> durante la validación de los soportes.`
            : (soloAlertas
                ? `Se han detectado <strong style="color:#f59e0b;">${totalConAlertas} paciente(s) con alertas</strong> durante la auditoría.`
                : `Todos los <strong>${totalCarpetas} paciente(s)</strong> han superado la validación sin errores.`));

    backdrop.innerHTML = `
        <div class="modal-rules-card" style="max-width: 480px; padding: 0; overflow: hidden; box-shadow: var(--shadow-modal);" onclick="event.stopPropagation()">
            <div style="padding: 16px 20px; display: flex; align-items: center; gap: 14px; background: var(--bg-subtle); border-bottom: 1px solid var(--border-subtle);">
                ${iconoSVG}
                <div>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-pure);">${tituloModal}</h3>
                    <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">${subtituloModal}</p>
                </div>
            </div>
            <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
                <p style="margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-primary);">${mensajePrincipal}</p>
                
                <div class="stats-cluster" style="display: flex; gap: 8px; justify-content: stretch; width: 100%;">
                    <div class="stat-pill" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Total</span>
                        <span class="stat-pill-value">${totalCarpetas}</span>
                    </div>
                    <div class="stat-pill success" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Conformes</span>
                        <span class="stat-pill-value">${conformes}</span>
                    </div>
                    <div class="stat-pill ${totalConErrores > 0 ? 'error' : ''}" style="flex: 1; text-align: center; justify-content: center;">
                        <span class="stat-pill-label">Novedades</span>
                        <span class="stat-pill-value">${totalConErrores}</span>
                    </div>
                </div>
            </div>
            <div style="padding: 12px 20px; background: var(--bg-subtle); border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn-studio btn-studio-primary" style="padding: 7px 18px; font-size: 12px; font-weight: 600;" onclick="document.getElementById('modalAlertaFinalValidacionActivo')?.remove()">
                    Entendido
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", () => backdrop.remove());
}

/**
 * Cierra exactamente una ventana o popup activo por pulsación de la tecla Escape (de a una por vez)
 */
export function cerrarUnPopupActivoConEscape() {
    // 1. Modales de pantalla completa con backdrop (Prevalidación, Reglas, Alertas)
    const backdropModals = document.querySelectorAll(".modal-rules-backdrop, .modal-aviso-firmas-backdrop");
    if (backdropModals.length > 0) {
        const topBackdrop = backdropModals[backdropModals.length - 1];
        if (topBackdrop.id === "modalAvisoFirmasActivo") {
            const btn = topBackdrop.querySelector("#btnCerrarAvisoFirmas");
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
        } else {
            topBackdrop.remove();
            return true;
        }
    }

    // 2. Visor de PDF si está abierto en pantalla
    const pdfModal = document.getElementById("pdfModal");
    if (pdfModal && pdfModal.style.display !== "none" && !pdfModal.classList.contains("oculto")) {
        if (typeof window.cerrarModal === "function") {
            window.cerrarModal();
        } else {
            pdfModal.style.display = "none";
        }
        return true;
    }

    // 3. Popovers flotantes individuales (Programado y Soportes)
    const progPopover = document.getElementById("programadoPopoverActivo");
    if (progPopover) {
        progPopover.remove();
        return true;
    }

    const archPopover = document.getElementById("archivosPopoverActivo");
    if (archPopover) {
        archPopover.remove();
        return true;
    }

    // 4. Modal Wiki / Ayuda
    const wikiContainer = document.getElementById("wikiContainer");
    if (wikiContainer && !wikiContainer.classList.contains("oculto")) {
        wikiContainer.classList.add("oculto");
        return true;
    }

    // 5. Cualquier otro popup genérico
    const otro = document.querySelector(".floating-popover-movable, .modal-rules-backdrop, .modal-aviso-firmas-backdrop");
    if (otro) {
        otro.remove();
        return true;
    }

    return false;
}

// Alias para compatibilidad
export const cerrarTodosLosPopupsYModales = cerrarUnPopupActivoConEscape;

/**
 * Inicializa el listener global para cerrar de a una ventana con la tecla Escape
 */
export function inicializarCierrePorEscape() {
    if (window._escapeListenerInit) return;
    window._escapeListenerInit = true;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.keyCode === 27) {
            cerrarUnPopupActivoConEscape();
        }
    });
}

// Auto-inicializar el listener al importar
inicializarCierrePorEscape();



