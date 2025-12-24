import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasPaquete } from "../reglas.js";
import { DEBUG, SERVICIOS_TERAPIA } from "../config/constants.js";
import {
    normalizeForSearch,
    escapeRegExp,
    extraerNumeroDelTexto,
} from "../utils/textUtils.js";
import { extraerTextoPDF, extraerFechas } from "../utils/pdfUtils.js";

// Variable para controlar debug solo en primer servicio
let primerServicioDebug = null;

/**
 * Valida carpeta en modo paquete (crónico o crónico con terapias)
 */
export async function validarPorPaquete(
    carpeta,
    archivos,
    tipoPaquete,
    nroDocumento,
    resultados,
    estado,
    updateRow,
    convenio = "capital-salud",
    onProgresoArchivo = null
) {
    const nombres = archivos.map((a) => a.name);

    // Detectar servicios presentes
    const serviciosEncontrados = detectarServicios(nombres);
    resultados[carpeta].servicios = serviciosEncontrados;

    // Inicializar contenedores de fechas, errores, éxitos y alertas por servicio
    for (const s of serviciosEncontrados) {
        resultados[carpeta].fechasPorServicio[s] ||= [];
        resultados[carpeta].erroresPorServicio[s] ||= [];
        resultados[carpeta].exitosPorServicio[s] ||= [];
        resultados[carpeta].alertasPorServicio[s] ||= [];
    }

    // Crear URLs para archivos PDF
    for (const f of archivos) {
        if (f.type === "application/pdf") {
            resultados[carpeta].fileUrls[f.name] = URL.createObjectURL(f);
        }
    }

    if (tipoPaquete === "cronico") {
        validarPaqueteCronico(
            carpeta,
            nombres,
            serviciosEncontrados,
            resultados,
            archivos,
            convenio
        );
    } else if (tipoPaquete === "cronico-terapias") {
        validarPaqueteCronicoConTerapias(
            carpeta,
            nombres,
            serviciosEncontrados,
            resultados,
            archivos,
            convenio
        );
    }

    // Procesar cada servicio encontrado para validar PDFs
    for (const servicio of serviciosEncontrados) {
        const servicioLower = servicio.toLowerCase();

        // IMPORTANTE: Procesar primero el 2.pdf para extraer número, luego 5 para comparar, luego 4
        for (const numArchivo of ["2", "5", "4"]) {
            let archivoParaProcesar = null;

            // 1. SIEMPRE buscar primero el archivo específico del servicio (ej: "2 vm.pdf")
            const nombreEspecifico = `${numArchivo} ${servicioLower}.pdf`;
            archivoParaProcesar = archivos.find(
                (f) =>
                    f.name.toLowerCase() === nombreEspecifico &&
                    f.type === "application/pdf"
            );

            // 2. SOLO si no existe el individual, para archivo 2 en FOMAG, buscar en "2 paq.pdf"
            // Si existe individual, ignorar paq.pdf completamente
            if (
                !archivoParaProcesar &&
                numArchivo === "2" &&
                convenio === "fomag"
            ) {
                const archivoPaquete = archivos.find(
                    (f) =>
                        f.name.toLowerCase() === "2 paq.pdf" &&
                        f.type === "application/pdf"
                );
                if (archivoPaquete) {
                    archivoParaProcesar = archivoPaquete;
                    // Guardar URL para permitir abrir desde el click en "2 servicio.pdf"
                    const nombreEspecificoParaUrl = `2 ${servicioLower}.pdf`;
                    // Copiar la URL del 2 paq.pdf para este servicio específico
                    const urlPaq =
                        resultados[carpeta].fileUrls["2 paq.pdf"] ||
                        resultados[carpeta].fileUrls["2 PAQ.pdf"];
                    if (urlPaq) {
                        resultados[carpeta].fileUrls[nombreEspecificoParaUrl] =
                            urlPaq;
                    }
                }
            }

            // 3. Procesar el archivo si se encontró
            if (archivoParaProcesar) {
                // Solo procesar si no está marcado como faltante
                if (
                    resultados[carpeta].pdfsPorServicio[servicio] &&
                    resultados[carpeta].pdfsPorServicio[servicio][
                        numArchivo
                    ] !== "—"
                ) {
                    estado.textContent = `Procesando: ${carpeta} / ${archivoParaProcesar.name} (${servicio})`;
                    
                    // Actualizar barra de progreso si el callback está disponible
                    if (onProgresoArchivo) {
                        onProgresoArchivo(archivoParaProcesar.name);
                    }

                    await validarPDFPaquete(
                        archivoParaProcesar,
                        carpeta,
                        nroDocumento,
                        servicio,
                        resultados,
                        convenio
                    );
                }
            }
        }

        updateRow(carpeta, resultados[carpeta]);
    }
}

/**
 * Detecta los servicios presentes en los nombres de archivos
 */
function detectarServicios(nombres) {
    const serviciosEncontrados = new Set();
    for (const nombre of nombres) {
        const nombreUpper = nombre.toUpperCase();
        const match = nombreUpper.match(
            /\d+ (VM|ENF|TF|TR|SUCCION|SUC|TS|PSI)/
        );
        if (match) {
            let servicio = match[1];
            if (servicio === "SUC") servicio = "SUCCION";
            serviciosEncontrados.add(servicio);
        }
    }
    return serviciosEncontrados;
}

/**
 * Valida paquete crónico (solo VM y ENF)
 */
function validarPaqueteCronico(
    carpeta,
    nombres,
    serviciosEncontrados,
    resultados,
    archivos,
    convenio
) {
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
        resultados[carpeta].erroresPorServicio[servicio] ||= [];
        resultados[carpeta].exitosPorServicio[servicio] ||= [];

        for (const num of ["2", "4", "5"]) {
            // Para FOMAG archivo 2: buscar primero archivo individual, luego en paq.pdf
            let existe = false;
            const nombreIndividual = `${num} ${servicio.toLowerCase()}.pdf`;

            // Siempre buscar primero el archivo individual
            existe = nombres.some((n) => n.toLowerCase() === nombreIndividual);

            // Solo para FOMAG y solo para archivo 2: si no existe individual, buscar en paq.pdf
            if (!existe && convenio === "fomag" && num === "2") {
                const tiene2Paq = nombres.some(
                    (n) => n.toLowerCase() === "2 paq.pdf"
                );
                if (tiene2Paq) {
                    existe = true; // Se buscará en el procesamiento del PDF
                    resultados[carpeta].buscarEn2Paq =
                        resultados[carpeta].buscarEn2Paq || new Set();
                    resultados[carpeta].buscarEn2Paq.add(servicio);
                }
            }

            resultados[carpeta].pdfsPorServicio[servicio][num] = existe
                ? "✔"
                : "—";

            if (!existe) {
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `Falta ${num}.pdf`
                );
            } else {
                resultados[carpeta].exitosPorServicio[servicio].push(
                    `${num}.pdf encontrado`
                );
            }
        }
    }
}

/**
 * Valida paquete crónico con terapias
 */
function validarPaqueteCronicoConTerapias(
    carpeta,
    nombres,
    serviciosEncontrados,
    resultados,
    archivos,
    convenio
) {
    if (!serviciosEncontrados.has("VM")) {
        resultados[carpeta].errores.push("Paquete debe incluir servicio VM");
    }
    if (!serviciosEncontrados.has("ENF")) {
        resultados[carpeta].errores.push("Paquete debe incluir servicio ENF");
    }

    // Verificar al menos una terapia
    const terapiasEncontradas = [...serviciosEncontrados].filter((s) =>
        SERVICIOS_TERAPIA.includes(s)
    );

    if (terapiasEncontradas.length === 0) {
        resultados[carpeta].errores.push(
            "Paquete debe incluir al menos un servicio de terapia (TF, TR o SUCCION)"
        );
    }

    // Verificar archivos 2, 4, 5 para cada servicio
    for (const servicio of serviciosEncontrados) {
        const servicioLower = servicio.toLowerCase();
        resultados[carpeta].pdfsPorServicio[servicio] = {};
        resultados[carpeta].erroresPorServicio[servicio] ||= [];
        resultados[carpeta].exitosPorServicio[servicio] ||= [];

        for (const num of ["2", "4", "5"]) {
            let existe = false;
            const nombreIndividual = `${num} ${servicioLower}.pdf`;

            // Siempre buscar primero el archivo individual
            existe = nombres.some((n) => n.toLowerCase() === nombreIndividual);

            // Solo para FOMAG y solo para archivo 2: si no existe individual, buscar en paq.pdf
            if (!existe && convenio === "fomag" && num === "2") {
                const tiene2Paq = nombres.some(
                    (n) => n.toLowerCase() === "2 paq.pdf"
                );
                if (tiene2Paq) {
                    existe = true; // Se buscará en el procesamiento del PDF
                    resultados[carpeta].buscarEn2Paq =
                        resultados[carpeta].buscarEn2Paq || new Set();
                    resultados[carpeta].buscarEn2Paq.add(servicio);
                }
            }

            resultados[carpeta].pdfsPorServicio[servicio][num] = existe
                ? "✔"
                : "—";
        }

        // Verificar si está incompleto
        const faltantes = ["2", "4", "5"].filter((num) => {
            const tieneIndividual = nombres.some(
                (n) => n.toLowerCase() === `${num} ${servicioLower}.pdf`
            );
            const tienePaq =
                convenio === "fomag" &&
                num === "2" &&
                nombres.some((n) => n.toLowerCase() === "2 paq.pdf");
            return !tieneIndividual && !tienePaq;
        });

        const encontrados = ["2", "4", "5"].filter((num) => {
            const tieneIndividual = nombres.some(
                (n) => n.toLowerCase() === `${num} ${servicioLower}.pdf`
            );
            const tienePaq =
                convenio === "fomag" &&
                num === "2" &&
                nombres.some((n) => n.toLowerCase() === "2 paq.pdf");
            return tieneIndividual || tienePaq;
        });

        if (faltantes.length > 0) {
            faltantes.forEach((num) => {
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `Falta ${num}.pdf`
                );
            });
        }

        if (encontrados.length > 0) {
            encontrados.forEach((num) => {
                resultados[carpeta].exitosPorServicio[servicio].push(
                    `${num}.pdf encontrado`
                );
            });
        }
    }
}

/**
 * Valida contenido de un PDF en modo paquete
 */
async function validarPDFPaquete(
    file,
    carpeta,
    nroDocumento,
    servicio,
    resultados,
    convenio = "capital-salud"
) {
    try {
        const pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        const texto = await extraerTextoPDF(pdf);
        const textoPlanoNorm = normalizeForSearch(texto);

        // Extraer fechas
        const fechas = extraerFechas(texto);

        // Determinar si es archivo "2 paq.pdf"
        const esPaquete = file.name.toLowerCase().includes("paq.pdf");
        const numArchivo = file.name.match(/^(\d+) /)?.[1];

        // Validar número de documento en archivos 2 y 5 para FOMAG
        if (
            convenio === "fomag" &&
            (numArchivo === "2" || numArchivo === "5") &&
            servicio !== "PAQ"
        ) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].erroresPorServicio[servicio] =
                    resultados[carpeta].erroresPorServicio[servicio] || [];
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
            } else {
                // Agregar mensaje de éxito cuando se encuentra el documento
                resultados[carpeta].exitosPorServicio[servicio] =
                    resultados[carpeta].exitosPorServicio[servicio] || [];
                resultados[carpeta].exitosPorServicio[servicio].push(
                    `${file.name}: contiene número ${nroDocumento}`
                );
            }
        }

        // Si es "2 paq.pdf" de FOMAG, procesar múltiples servicios
        if (esPaquete && numArchivo === "2" && convenio === "fomag") {
            await procesarArchivoPaqueteFomag(
                file,
                carpeta,
                texto,
                textoPlanoNorm,
                resultados,
                nroDocumento
            );
        } else {
            // Procesamiento normal
            resultados[carpeta].fechas.push(...fechas);

            // Guardar fechas por servicio para archivo 5
            if (numArchivo === "5" && servicio !== "PAQ") {
                resultados[carpeta].fechasPorServicio[servicio] = fechas;
            }

            // Extraer número del texto para archivo 2 (paquetes)
            if (numArchivo === "2" && servicio !== "PAQ") {
                const REGLAS_PAQUETE = obtenerReglasPaquete(convenio);
                const textoBuscar =
                    REGLAS_PAQUETE[servicio]?.["2.pdf"]?.debeContener || "";
                const numeroExtraido = extraerNumeroDelTexto(
                    texto,
                    textoBuscar
                );

                // Log limpio con información relevante del 2.pdf - SIEMPRE mostrar
                console.log(
                    `\n📄 VALIDACIÓN ARCHIVO 2.pdf\n` +
                        `   Carpeta: ${carpeta}\n` +
                        `   Servicio: ${servicio}\n` +
                        `   Archivo: ${file.name}\n` +
                        `   Convenio: ${convenio}\n` +
                        `   Reglas obtenidas: ${JSON.stringify(
                            REGLAS_PAQUETE[servicio],
                            null,
                            2
                        )}\n` +
                        `   Texto buscado: "${textoBuscar || "N/A"}"\n` +
                        `   Cant. Auto encontrada: ${
                            numeroExtraido !== null
                                ? numeroExtraido
                                : "NO ENCONTRADO"
                        }\n` +
                        `   Documento (${nroDocumento}): ${
                            textoPlanoNorm.includes(nroDocumento)
                                ? "✓ Encontrado"
                                : "✗ NO encontrado"
                        }\n` +
                        `\n--- TEXTO COMPLETO DEL PDF ---\n${texto}\n--- FIN TEXTO ---\n`
                );

                if (numeroExtraido !== null) {
                    resultados[carpeta].numerosPorServicio =
                        resultados[carpeta].numerosPorServicio || {};
                    resultados[carpeta].numerosPorServicio[servicio] =
                        numeroExtraido;
                }
            }

            // Validaciones especiales para el 4.pdf
            if (numArchivo === "4" && servicio !== "PAQ") {
                resultados[carpeta].alertasPorServicio[servicio] =
                    resultados[carpeta].alertasPorServicio[servicio] || [];
                resultados[carpeta].exitosPorServicio[servicio] =
                    resultados[carpeta].exitosPorServicio[servicio] || [];

                // Validar número de páginas
                if (pdf.numPages > 1) {
                    resultados[carpeta].alertasPorServicio[servicio].push(
                        `4.pdf: Tiene ${pdf.numPages} páginas (se espera 1 sola página)`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio[servicio].push(
                        `4.pdf: Tiene 1 página correctamente`
                    );
                }

                // Buscar palabra "dentificaci" para detectar si no es archivo de firmas
                if (textoPlanoNorm.includes("dentificaci")) {
                    resultados[carpeta].alertasPorServicio[servicio].push(
                        `4.pdf: Al parecer no es el archivo de firmas (contiene "identificación")`
                    );
                }
            }

            // Validar archivo 2 individual de FOMAG
            if (
                numArchivo === "2" &&
                servicio !== "PAQ" &&
                convenio === "fomag"
            ) {
                await validarArchivo2Fomag(
                    file,
                    carpeta,
                    servicio,
                    texto,
                    textoPlanoNorm,
                    fechas,
                    resultados
                );
            }
        }

        // Validar reglas (para archivos 2, 4 y 5)
        const REGLAS_PAQUETE = obtenerReglasPaquete(convenio);
        if (REGLAS_PAQUETE[servicio] && servicio !== "PAQ") {
            const claveArchivo = numArchivo ? `${numArchivo}.pdf` : null;

            // Aplicar reglas:
            // - Para archivo 2: solo si NO es "2 paq.pdf" de FOMAG
            // - Para archivos 4 y 5: siempre
            const es2Paquete = esPaquete && numArchivo === "2";
            const debeAplicarRegla = claveArchivo && !es2Paquete;

            if (debeAplicarRegla && REGLAS_PAQUETE[servicio][claveArchivo]) {
                const regla = REGLAS_PAQUETE[servicio][claveArchivo];

                // Convertir debeContener a array si no lo es (compatibilidad)
                const textosABuscar = Array.isArray(regla.debeContener)
                    ? regla.debeContener
                    : [regla.debeContener];

                let textoEncontrado = null;

                // Buscar cualquiera de los textos
                for (const buscar of textosABuscar) {
                    const buscarNorm = normalizeForSearch(buscar);
                    if (textoPlanoNorm.includes(buscarNorm)) {
                        textoEncontrado = buscar;
                        break;
                    }
                }

                if (!textoEncontrado) {
                    resultados[carpeta].erroresPorServicio[servicio] =
                        resultados[carpeta].erroresPorServicio[servicio] || [];

                    resultados[carpeta].erroresPorServicio[servicio].push(
                        `${numArchivo}.pdf: falta alguno de: ${textosABuscar.join(
                            " o "
                        )}`
                    );
                    // Marcar el archivo con error
                    if (resultados[carpeta].pdfsPorServicio[servicio]) {
                        resultados[carpeta].pdfsPorServicio[servicio][
                            numArchivo
                        ] = "✗";
                    }
                } else {
                    resultados[carpeta].exitosPorServicio[servicio] =
                        resultados[carpeta].exitosPorServicio[servicio] || [];
                    resultados[carpeta].exitosPorServicio[servicio].push(
                        `${numArchivo}.pdf: se encontró "${textoEncontrado}"`
                    );
                }

                // COMPARACIÓN: Solo para archivo 5.pdf
                if (regla.igualarConFechas && numArchivo === "5") {
                    // Obtener Cant Auto (del 2.pdf ya procesado)
                    const cantAuto =
                        resultados[carpeta].numerosPorServicio?.[servicio] || 0;

                    // Obtener Cant HC (fechas del 5.pdf actual)
                    const cantHC = fechas.length;

                    if (cantAuto !== cantHC) {
                        resultados[carpeta].erroresPorServicio[servicio] =
                            resultados[carpeta].erroresPorServicio[servicio] ||
                            [];
                        resultados[carpeta].erroresPorServicio[servicio].push(
                            `5.pdf: Cant autorizaciones ${cantAuto} ≠ cant evoluciones ${cantHC}`
                        );
                        // Marcar el archivo con error
                        if (resultados[carpeta].pdfsPorServicio[servicio]) {
                            resultados[carpeta].pdfsPorServicio[servicio]["5"] =
                                "✗";
                        }
                    } else {
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Cant autorizaciones ${cantAuto} = cant evoluciones ${cantHC}`
                        );
                    }
                }
            }
        }
    } catch {
        if (servicio && servicio !== "PAQ") {
            resultados[carpeta].erroresPorServicio[servicio] =
                resultados[carpeta].erroresPorServicio[servicio] || [];
            resultados[carpeta].erroresPorServicio[servicio].push(
                `${file.name}: error leyendo PDF`
            );
            // Marcar el archivo con error
            const numArchivo = file.name.match(/^(\d+) /)?.[1];
            if (numArchivo && resultados[carpeta].pdfsPorServicio[servicio]) {
                resultados[carpeta].pdfsPorServicio[servicio][numArchivo] = "✗";
            }
        }
    }
}

/**
 * Procesa archivo "2 paq.pdf" de FOMAG buscando múltiples servicios
 */
async function procesarArchivoPaqueteFomag(
    file,
    carpeta,
    texto,
    textoPlanoNorm,
    resultados,
    nroDocumento
) {
    // Servicios a buscar (los que se encontraron en archivos 4 y 5)
    const serviciosABuscar = resultados[carpeta].buscarEn2Paq || new Set();

    for (const servicio of serviciosABuscar) {
        // Buscar texto del servicio según las reglas
        const textoABuscar = obtenerTextoServicioFomag(servicio);
        if (!textoABuscar) continue;

        const textoNorm = normalizeForSearch(textoABuscar);
        const encontrado = textoPlanoNorm.includes(textoNorm);

        // Extraer el número
        const numero = encontrado
            ? extraerNumeroDelTexto(texto, textoABuscar)
            : null;

        // Log limpio con información relevante del 2.pdf - SIEMPRE mostrar
        console.log(
            `\n📄 VALIDACIÓN ARCHIVO 2.pdf (PAQ)\n` +
                `   Carpeta: ${carpeta}\n` +
                `   Servicio: ${servicio}\n` +
                `   Archivo: ${file.name}\n` +
                `   Convenio: fomag\n` +
                `   Texto buscado: "${textoABuscar}"\n` +
                `   Cant. Auto encontrada: ${
                    numero !== null ? numero : "NO ENCONTRADO"
                }\n` +
                `   Documento (${nroDocumento}): ${
                    textoPlanoNorm.includes(nroDocumento)
                        ? "✓ Encontrado"
                        : "✗ NO encontrado"
                }\n` +
                `\n--- TEXTO COMPLETO DEL PDF ---\n${texto}\n--- FIN TEXTO ---\n`
        );

        if (encontrado) {
            if (numero !== null) {
                // Guardar el número para validar después
                resultados[carpeta].numerosPorServicio =
                    resultados[carpeta].numerosPorServicio || {};
                resultados[carpeta].numerosPorServicio[servicio] = numero;

                // Marcar como encontrado
                resultados[carpeta].pdfsPorServicio[servicio]["2"] = "✔";
            }
        } else {
            resultados[carpeta].errores.push(
                `2 paq.pdf: no contiene texto para ${servicio}`
            );
        }
    }
}

/**
 * Valida archivo "2 [servicio].pdf" individual de FOMAG
 */
async function validarArchivo2Fomag(
    file,
    carpeta,
    servicio,
    texto,
    textoPlanoNorm,
    fechas,
    resultados
) {
    const textoABuscar = obtenerTextoServicioFomag(servicio);
    if (!textoABuscar) return;

    const textoNorm = normalizeForSearch(textoABuscar);

    if (!textoPlanoNorm.includes(textoNorm)) {
        resultados[carpeta].errores.push(
            `${file.name}: falta "${textoABuscar}"`
        );
        return;
    }

    // Extraer el número
    const numero = extraerNumeroDelTexto(texto, textoABuscar);

    if (numero !== null) {
        // Guardar el número
        resultados[carpeta].numerosPorServicio =
            resultados[carpeta].numerosPorServicio || {};
        resultados[carpeta].numerosPorServicio[servicio] = numero;

        // Validar contra fechas del archivo 5 correspondiente
        const fechas5 = resultados[carpeta].fechasPorServicio[servicio] || [];
        if (numero !== fechas5.length) {
            resultados[carpeta].errores.push(
                `${file.name}: Número declarado ${numero} ≠ Fechas archivo 5: ${fechas5.length}`
            );
        }
    } else {
        resultados[carpeta].errores.push(
            `${file.name}: no se pudo extraer el número después del texto`
        );
    }
}

/**
 * Obtiene el texto a buscar para un servicio en FOMAG
 */
function obtenerTextoServicioFomag(servicio) {
    const textos = {
        TF: "ATENCION (VISITA) DOMICILIARIA, POR FISIOTERAPIA",
        TR: "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA RESPIRATORIA",
        SUCCION: "TERAPIA SUCCION",
        VM: "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL",
        ENF: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        PSI: "ATENCION (VISITA) DOMICILIARIA, POR PSICOLOGIA",
        TS: "ATENCION (VISITA) DOMICILIARIA, POR TRABAJO SOCIAL",
    };
    return textos[servicio] || null;
}
