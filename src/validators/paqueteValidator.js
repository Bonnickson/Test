import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasPaquete } from "../reglas.js";
import { DEBUG, SERVICIOS_TERAPIA } from "../config/constants.js";
import {
    normalizeForSearch,
    escapeRegExp,
    extraerNumeroDelTexto,
} from "../utils/textUtils.js";
import {
    extraerTextoPDF,
    extraerFechas,
    validarOrdenFechas,
} from "../utils/pdfUtils.js";

// Variable para controlar debug solo en primer servicio
let primerServicioDebug = null;

/**
 * Valida que solo existan archivos permitidos en la carpeta de paquete
 * @param {File[]} archivos - Array de archivos en la carpeta
 * @param {Object} resultados - Objeto con los resultados de validación
 * @param {string} carpeta - Nombre de la carpeta
 * @param {string} convenio - Convenio seleccionado ('capital-salud' o 'fomag')
 */
export function validarArchivosPermitidosPaquete(
    archivos,
    resultados,
    carpeta,
    convenio
) {
    const archivosNoPermitidos = [];
    const serviciosValidos = [
        "vm",
        "enf",
        "tf",
        "tr",
        "succion",
        "suc",
        "ts",
        "psi",
        "to",
        "fon",
    ];

    for (const archivo of archivos) {
        const nombreLower = archivo.name.toLowerCase();

        // Patrón válido: "2 vm.pdf", "4 enf.pdf", etc.
        const patronServicio =
            /^[2-5]\s+(vm|enf12|enf|tf|tr|succion|suc|ts|psi|to|fon)\.pdf$/;

        // Patrón válido solo para FOMAG: "2 paq.pdf"
        const patron2Paq = /^2\s+paq\.pdf$/;

        const esArchivoValido =
            patronServicio.test(nombreLower) ||
            (convenio === "fomag" && patron2Paq.test(nombreLower));

        if (!esArchivoValido) {
            archivosNoPermitidos.push(archivo.name);
        }
    }

    if (archivosNoPermitidos.length > 0) {
        // Agregar "General" como servicio
        resultados[carpeta].servicios.add("General");

        // Inicializar arrays para el servicio General
        resultados[carpeta].erroresPorServicio["General"] =
            resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].exitosPorServicio["General"] =
            resultados[carpeta].exitosPorServicio["General"] || [];
        resultados[carpeta].alertasPorServicio["General"] =
            resultados[carpeta].alertasPorServicio["General"] || [];
        resultados[carpeta].fechasPorServicio["General"] =
            resultados[carpeta].fechasPorServicio["General"] || [];

        // Agregar los archivos no permitidos como errores del servicio General
        archivosNoPermitidos.forEach((archivo) => {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Archivo no permitido: ${archivo}`
            );
        });

        // console.log(
        //     `❌ ${carpeta} - Archivos no permitidos encontrados: ${archivosNoPermitidos.join(
        //         ", "
        //     )}`
        // );
    }
}

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

    // Validar archivos permitidos primero
    validarArchivosPermitidosPaquete(archivos, resultados, carpeta, convenio);

    // Detectar servicios presentes
    const serviciosEncontrados = detectarServicios(nombres);

    // Si ya existe el servicio "General", preservarlo
    if (resultados[carpeta].servicios?.has("General")) {
        serviciosEncontrados.add("General");
    }

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

    // Procesar cada servicio encontrado para validar PDFs (excepto "General")
    for (const servicio of serviciosEncontrados) {
        // Saltar "General" ya que no tiene PDFs específicos para procesar
        if (servicio === "General") continue;

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

    // Validaciones finales por tipo de paquete (post-procesamiento)
    // Asegurar que existe "General" en servicios y erroresPorServicio
    if (tipoPaquete === "cronico" || tipoPaquete === "cronico-terapias") {
        resultados[carpeta].servicios.add("General");
        resultados[carpeta].erroresPorServicio["General"] =
            resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].exitosPorServicio["General"] =
            resultados[carpeta].exitosPorServicio["General"] || [];
        resultados[carpeta].alertasPorServicio["General"] =
            resultados[carpeta].alertasPorServicio["General"] || [];
    }

    if (tipoPaquete === "cronico") {
        // En paquete crónico: exactamente 1 VM y 1 ENF
        const cantVM =
            resultados[carpeta].fechasPorServicio?.["VM"]?.length || 0;
        const cantENF =
            resultados[carpeta].fechasPorServicio?.["ENF"]?.length || 0;

        if (cantVM !== 1) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete Crónico debe tener exactamente 1 evolución de VM (tiene ${cantVM})`
            );
        } else {
            resultados[carpeta].exitosPorServicio["General"].push(
                `VM: 1 evolución ✓`
            );
        }

        if (cantENF !== 1) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete Crónico debe tener exactamente 1 evolución de ENF (tiene ${cantENF})`
            );
        } else {
            resultados[carpeta].exitosPorServicio["General"].push(
                `ENF: 1 evolución ✓`
            );
        }
    } else if (tipoPaquete === "cronico-terapias") {
        // En crónico con terapias: suma de evoluciones de TF, TR, FON, TO debe estar entre 6-10
        const TERAPIAS_CONTABLES = new Set(["TF", "TR", "FON", "TO"]);

        // Sumar evoluciones SOLO de las 4 terapias permitidas
        let totalTerapias = 0;
        for (const s of TERAPIAS_CONTABLES) {
            totalTerapias +=
                resultados[carpeta].fechasPorServicio?.[s]?.length || 0;
        }

        if (totalTerapias < 6) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete Crónico con Terapias debe tener mínimo 6 terapias (tiene ${totalTerapias})`
            );
        } else if (totalTerapias > 10) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete Crónico con Terapias debe tener máximo 10 terapias (tiene ${totalTerapias})`
            );
        } else {
            resultados[carpeta].exitosPorServicio["General"].push(
                `Terapias (TF+TR+FON+TO): ${totalTerapias} (6-10) ✓`
            );
        }
    }

    // Refrescar fila después de validaciones finales
    updateRow(carpeta, resultados[carpeta]);
}

/**
 * Detecta los servicios presentes en los nombres de archivos
 */
function detectarServicios(nombres) {
    const serviciosEncontrados = new Set();
    for (const nombre of nombres) {
        const nombreUpper = nombre.toUpperCase();
        const match = nombreUpper.match(
            /\d+ (VM|ENF|TF|TR|SUCCION|SUC|TS|PSI|FON|TO)/
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
    // Filtrar "General" para las validaciones de servicios
    const serviciosReales = new Set(
        [...serviciosEncontrados].filter((s) => s !== "General")
    );

    const serviciosPermitidos = new Set(["VM", "ENF"]);
    const serviciosNoPermitidos = [...serviciosReales].filter(
        (s) => !serviciosPermitidos.has(s)
    );

    if (serviciosNoPermitidos.length > 0) {
        resultados[carpeta].errores.push(
            `Paquete Crónico solo debe contener VM y ENF. Se encontró: ${serviciosNoPermitidos.join(
                ", "
            )}`
        );
    }

    if (!serviciosReales.has("VM")) {
        resultados[carpeta].errores.push(
            "Paquete Crónico debe incluir servicio VM"
        );
    }
    if (!serviciosReales.has("ENF")) {
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
    // Filtrar "General" para las validaciones de servicios
    const serviciosReales = new Set(
        [...serviciosEncontrados].filter((s) => s !== "General")
    );

    if (!serviciosReales.has("VM")) {
        resultados[carpeta].errores.push("Paquete debe incluir servicio VM");
    }
    if (!serviciosReales.has("ENF")) {
        resultados[carpeta].errores.push("Paquete debe incluir servicio ENF");
    }

    // Verificar al menos una terapia
    const terapiasEncontradas = [...serviciosReales].filter((s) =>
        SERVICIOS_TERAPIA.includes(s)
    );

    if (terapiasEncontradas.length === 0) {
        resultados[carpeta].errores.push(
            "Paquete debe incluir al menos un servicio de terapia (TF, TR, SUCCION, TO o FON)"
        );
    }

    // Verificar archivos 2, 4, 5 para cada servicio (excluyendo "General")
    for (const servicio of serviciosReales) {
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

                // Validar fechas duplicadas y orden
                if (fechas.length > 0) {
                    const { duplicadas, desordenadas } =
                        validarOrdenFechas(fechas);

                    if (duplicadas.length > 0) {
                        resultados[carpeta].alertasPorServicio[servicio] =
                            resultados[carpeta].alertasPorServicio[servicio] ||
                            [];
                        resultados[carpeta].alertasPorServicio[servicio].push(
                            `5.pdf: Fechas duplicadas: ${duplicadas.join(", ")}`
                        );
                    } else {
                        // Agregar validación exitosa cuando no hay duplicadas
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Sin fechas duplicadas`
                        );
                    }

                    if (desordenadas) {
                        resultados[carpeta].alertasPorServicio[servicio] =
                            resultados[carpeta].alertasPorServicio[servicio] ||
                            [];
                        resultados[carpeta].alertasPorServicio[servicio].push(
                            `5.pdf: Fechas no están en orden cronológico`
                        );
                    } else {
                        // Agregar validación exitosa cuando están en orden
                        resultados[carpeta].exitosPorServicio[servicio] =
                            resultados[carpeta].exitosPorServicio[servicio] ||
                            [];
                        resultados[carpeta].exitosPorServicio[servicio].push(
                            `5.pdf: Fechas en orden cronológico correcto`
                        );
                    }
                }
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
                // console.log(
                //     `\n📄 VALIDACIÓN ARCHIVO 2.pdf\n` +
                //         `   Carpeta: ${carpeta}\n` +
                //         `   Servicio: ${servicio}\n` +
                //         `   Archivo: ${file.name}\n` +
                //         `   Convenio: ${convenio}\n` +
                //         `   Reglas obtenidas: ${JSON.stringify(
                //             REGLAS_PAQUETE[servicio],
                //             null,
                //             2
                //         )}\n` +
                //         `   Texto buscado: "${textoBuscar || "N/A"}"\n` +
                //         `   Cant. Auto encontrada: ${
                //             numeroExtraido !== null
                //                 ? numeroExtraido
                //                 : "NO ENCONTRADO"
                //         }\n` +
                //         `   Documento (${nroDocumento}): ${
                //             textoPlanoNorm.includes(nroDocumento)
                //                 ? "✓ Encontrado"
                //                 : "✗ NO encontrado"
                //         }\n` +
                //         `\n--- TEXTO COMPLETO DEL PDF ---\n${texto}\n--- FIN TEXTO ---\n`
                // );

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
                        // Si autorizaciones < evoluciones: ERROR
                        if (cantAuto < cantHC) {
                            resultados[carpeta].erroresPorServicio[servicio] =
                                resultados[carpeta].erroresPorServicio[
                                    servicio
                                ] || [];
                            resultados[carpeta].erroresPorServicio[
                                servicio
                            ].push(
                                `5.pdf: Cant autorizaciones ${cantAuto} < cant evoluciones ${cantHC}`
                            );
                            // Marcar el archivo con error
                            if (resultados[carpeta].pdfsPorServicio[servicio]) {
                                resultados[carpeta].pdfsPorServicio[servicio][
                                    "5"
                                ] = "✗";
                            }
                        }
                        // Si autorizaciones > evoluciones: ALERTA
                        else {
                            resultados[carpeta].alertasPorServicio[servicio] =
                                resultados[carpeta].alertasPorServicio[
                                    servicio
                                ] || [];
                            resultados[carpeta].alertasPorServicio[
                                servicio
                            ].push(
                                `5.pdf: Cant autorizaciones ${cantAuto} > cant evoluciones ${cantHC}`
                            );
                        }
                    } else {
                        // Cuando coinciden, agregar validación exitosa
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
        // console.log(
        //     `\n📄 VALIDACIÓN ARCHIVO 2.pdf (PAQ)\n` +
        //         `   Carpeta: ${carpeta}\n` +
        //         `   Servicio: ${servicio}\n` +
        //         `   Archivo: ${file.name}\n` +
        //         `   Convenio: fomag\n` +
        //         `   Texto buscado: "${textoABuscar}"\n` +
        //         `   Cant. Auto encontrada: ${
        //             numero !== null ? numero : "NO ENCONTRADO"
        //         }\n` +
        //         `   Documento (${nroDocumento}): ${
        //             textoPlanoNorm.includes(nroDocumento)
        //                 ? "✓ Encontrado"
        //                 : "✗ NO encontrado"
        //         }\n` +
        //         `\n--- TEXTO COMPLETO DEL PDF ---\n${texto}\n--- FIN TEXTO ---\n`
        // );

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

        // NO comparar aquí con fechas del archivo 5
        // La comparación se hace cuando se procesa el archivo 5.pdf (después de extraer sus fechas)
    } else {
        resultados[carpeta].erroresPorServicio[servicio] =
            resultados[carpeta].erroresPorServicio[servicio] || [];
        resultados[carpeta].erroresPorServicio[servicio].push(
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
        FON: "ATENCION (VISITA) DOMICILIARIA, POR FONIATRIA Y FONOAUDIOLOGIA",
        VM: "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL",
        ENF: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        PSI: "ATENCION (VISITA) DOMICILIARIA, POR PSICOLOGIA",
        TS: "ATENCION (VISITA) DOMICILIARIA, POR TRABAJO SOCIAL",
        TO: "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA OCUPACIONAL",
    };
    return textos[servicio] || null;
}
