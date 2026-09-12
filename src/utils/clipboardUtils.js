import { SERVICIOS_NOMBRES } from "../config/constants.js";

/**
 * Función robusta universal de copia al portapapeles con fallback de textarea
 */
export async function copiarTextoAlPortapapeles(texto) {
    if (!texto) return false;
    let copiado = false;

    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(texto);
            copiado = true;
        } catch (err) {
            console.warn("navigator.clipboard falló, intentando fallback:", err);
        }
    }

    if (!copiado) {
        try {
            const textarea = document.createElement("textarea");
            textarea.value = texto;
            textarea.style.position = "fixed";
            textarea.style.top = "0";
            textarea.style.left = "0";
            textarea.style.width = "2em";
            textarea.style.height = "2em";
            textarea.style.padding = "0";
            textarea.style.border = "none";
            textarea.style.outline = "none";
            textarea.style.boxShadow = "none";
            textarea.style.background = "transparent";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            copiado = document.execCommand("copy");
            document.body.removeChild(textarea);
        } catch (e) {
            console.error("Error al copiar texto:", e);
        }
    }

    return copiado;
}

/**
 * Toast flotante de confirmación de copia
 */
export function mostrarToastCopia(texto) {
    const prev = document.getElementById("toastCopiaActivo");
    if (prev) prev.remove();

    const toast = document.createElement("div");
    toast.id = "toastCopiaActivo";
    toast.className = "tooltip-copy";
    toast.textContent = "Copiado: " + texto;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = "0";
            toast.style.transform = "translate(-50%, 10px)";
            toast.style.transition = "opacity 0.2s ease, transform 0.2s ease";
            setTimeout(() => toast.remove(), 200);
        }
    }, 1400);
}

/**
 * Copia solo el número de documento/carpeta
 */
export async function copiarNumero(event, carpeta, seleccionarCarpetaCallback) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const texto = carpeta || "";
    if (!texto) return;
    await copiarTextoAlPortapapeles(texto);
    mostrarToastCopia(texto);
}

/**
 * Copia el formato "${paquete} - ${documento} - "
 */
export async function copiarFormatoCompleto(event, paquete, carpeta, seleccionarCarpetaCallback) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    const pkg = paquete || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
    const doc = carpeta || "";
    const texto = `${pkg} - ${doc} - `;
    await copiarTextoAlPortapapeles(texto);
    mostrarToastCopia(texto);
}

/**
 * Copia el texto directo recibido
 */
export async function copiarTextoSimple(event, texto) {
    if (event) event.stopPropagation();
    if (!texto) return;
    await copiarTextoAlPortapapeles(texto);
    mostrarToastCopia(texto);
}

/**
 * Copia el formato error de matriz: "${paquete} - ${documento} - ${errores}"
 */
export async function copiarErrorMatriz(event, paquete, documento, erroresTexto) {
    if (event) event.stopPropagation();
    const pkg = paquete || "CPF";
    const doc = documento || "";
    const err = erroresTexto ? erroresTexto.trim() : "Sin novedades";
    const texto = `${pkg} - ${doc} - ${err}`;
    await copiarTextoAlPortapapeles(texto);
    mostrarToastCopia(texto);
}

/**
 * Copia los hallazgos completos estructurados por línea:
 * "${paquete} - ${documento} - ${servicio} - ${archivo} - ${error}"
 */
export async function copiarHallazgosCompletos(event, carpeta, resultadosGlobales, seleccionarCarpetaCallback) {
    if (typeof seleccionarCarpetaCallback === "function") {
        seleccionarCarpetaCallback(carpeta);
    }
    try {
        const r = (resultadosGlobales && resultadosGlobales[carpeta])
            ? resultadosGlobales[carpeta]
            : (resultadosGlobales
                ? Object.values(resultadosGlobales).find(item => item.carpetaNombre === carpeta || item.nroDocumento === carpeta)
                : null);

        const pkg = r?.tipoPaquete || r?.tipo || (document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108");
        const doc = carpeta || "";
        const prefijo = `${pkg} - ${doc}`;
        
        const lineas = [];

        if (!r) {
            lineas.push(`${prefijo} - 📦 Paquete - N/A - Sin datos procesados`);
        } else {
            // 1. Errores y alertas generales / de paquete
            const errsGen = [...(r.errores || []), ...(r.erroresPorServicio?.["General"] || [])];
            const alertsGen = [...(r.alertas || []), ...(r.alertasPorServicio?.["General"] || [])];
            const todosGen = [...new Set([...errsGen, ...alertsGen])];

            todosGen.forEach((err) => {
                const fileMatch = err.match(/\b([0-9A-Za-z_-]+(?:\s+[0-9A-Za-z_-]+)?\.pdf)\b/i);
                const archivo = fileMatch ? fileMatch[1] : (r.pdfsPorServicio?.["General"] ? Object.keys(r.pdfsPorServicio["General"]).join(", ") : "2 PAQ.pdf");
                lineas.push(`${prefijo} - 📦 Paquete - ${archivo} - ${err.trim()}`);
            });

            // 2. Errores y alertas por servicio
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

            if (lineas.length === 0) {
                lineas.push(`${prefijo} - 📦 Paquete - N/A - Sin novedades`);
            }
        }

        const textoFinal = lineas.join("\n");
        await copiarTextoAlPortapapeles(textoFinal);
        mostrarToastCopia(lineas.length > 1 ? `${lineas.length} hallazgos copiados` : textoFinal);
    } catch (error) {
        console.error("Error en copiarHallazgosCompletos:", error);
        const pkg = document.getElementById("tipoPaquete") ? document.getElementById("tipoPaquete").value : "CPF1108";
        const fallback = `${pkg} - ${carpeta || ""} - 📦 Paquete - N/A - Error al procesar hallazgos`;
        await copiarTextoAlPortapapeles(fallback);
        mostrarToastCopia(fallback);
    }
}
