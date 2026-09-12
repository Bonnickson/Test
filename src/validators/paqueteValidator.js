import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasPaquete } from "../reglas.js";
import {
    DEBUG,
    SERVICIOS_TERAPIA,
    TERAPIAS_CONTABLES,
    REGLAS_TERAPIAS_PAQUETES,
    obtenerTextoServicioFomag,
    REGEX_SERVICIO_ARCHIVO,
} from "../config/constants.js";
import {
    normalizeForSearch,
    escapeRegExp,
    extraerNumeroDelTexto,
} from "../utils/textUtils.js";
import {
    extraerTextoPDF,
    extraerTextoOCRDePDF,
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

    for (const archivo of archivos) {
        const nombreLower = archivo.name.toLowerCase();

        // Patrón válido: "2 vm.pdf", "4 enf.pdf", etc.
        const patronServicio = REGEX_SERVICIO_ARCHIVO;

        // Patrón válido solo para FOMAG: "2 paq.pdf"
        const patron2Paq = /^2\s+paq\.pdf$/i;

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
    
    // Asegurar también la clave "General" en caso de que sea necesario antes de los procesos finales
    if (!resultados[carpeta].servicios.has("General")) {
        resultados[carpeta].servicios.add("General");
    }
    resultados[carpeta].fechasPorServicio["General"] ||= [];
    resultados[carpeta].erroresPorServicio["General"] ||= [];
    resultados[carpeta].exitosPorServicio["General"] ||= [];
    resultados[carpeta].alertasPorServicio["General"] ||= [];

    // Asegurar URLs para archivos PDF solo si no existen
    for (const f of archivos) {
        if (f.type === "application/pdf" && !resultados[carpeta].fileUrls[f.name]) {
            resultados[carpeta].fileUrls[f.name] = URL.createObjectURL(f);
        }
    }

    // Solo validar paquetes con sus reglas (ignorar "cronico" y "cronico-terapias" antiguos)
    if (tipoPaquete.startsWith("CPF")) {
        validarNuevoPaquete(
            carpeta,
            nombres,
            serviciosEncontrados,
            resultados,
            archivos,
            tipoPaquete,
            convenio
        );
    }

    // Procesar cada servicio encontrado para validar PDFs (excepto "General")
    for (const servicio of serviciosEncontrados) {
        // Saltar "General" ya que no tiene PDFs específicos para procesar
        if (servicio === "General") continue;

        const servicioLower = servicio.toLowerCase();

        // IMPORTANTE: Procesar 5 para comparar, luego 4
        for (const numArchivo of ["5", "4"]) {
            let archivoParaProcesar = null;

            // 1. Buscar el archivo específico del servicio (ej: "5 vm.pdf")
            const nombreEspecifico = `${numArchivo} ${servicioLower}.pdf`;
            archivoParaProcesar = archivos.find(
                (f) =>
                    f.name.toLowerCase() === nombreEspecifico &&
                    f.type === "application/pdf"
            );

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
                        convenio,
                        tipoPaquete
                    );
                }
            }
        }

        updateRow(carpeta, resultados[carpeta]);
    }

    // Procesar "2 paq.pdf" de forma general si existe
    const archivo2Paq = archivos.find(
        (f) => f.name.toLowerCase() === "2 paq.pdf" && f.type === "application/pdf"
    );
    if (archivo2Paq) {
        estado.textContent = `Procesando: ${carpeta} / ${archivo2Paq.name} (General)`;
        if (onProgresoArchivo) onProgresoArchivo(archivo2Paq.name);
        await validarPDFPaquete(
            archivo2Paq,
            carpeta,
            nroDocumento,
            "General",
            resultados,
            convenio,
            tipoPaquete
        );
    }

    // Validaciones finales por tipo de paquete (post-procesamiento)
    // Asegurar que existe "General" en servicios y erroresPorServicio
    if (!resultados[carpeta].servicios.has("General")) {
        resultados[carpeta].servicios.add("General");
    }
    resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
    resultados[carpeta].exitosPorServicio["General"] = resultados[carpeta].exitosPorServicio["General"] || [];
    
    // Si existen datos de la matriz para este paciente, validar contra la matriz
    if (resultados[carpeta].datosMatriz) {
        const mat = resultados[carpeta].datosMatriz;
        const servMatriz = mat.servicios || {};

        // Validar todos los servicios conocidos
        const todosServicios = ["VM", "VENF", "ENF", "TF", "TR", "TRS", "FON", "TO", "NUT", "TS", "PSI"];

        for (const s of todosServicios) {
            const cantEsperada = servMatriz[s] || 0;
            // Para TRS o SUCCION, revisar ambas claves
            const cantEncontrada = s === "TRS" || s === "SUCCION"
                ? (resultados[carpeta].fechasPorServicio?.["TRS"]?.length || resultados[carpeta].fechasPorServicio?.["SUCCION"]?.length || 0)
                : (resultados[carpeta].fechasPorServicio?.[s]?.length || 0);

            const tieneArchivo = resultados[carpeta].servicios?.has(s) || 
                (s === "TRS" && resultados[carpeta].servicios?.has("SUCCION")) ||
                (s === "SUCCION" && resultados[carpeta].servicios?.has("TRS"));

            if (cantEsperada > 0) {
                if (!tieneArchivo) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: Falta soporte 5 ${s.toLowerCase()}.pdf (programadas: ${cantEsperada})`
                    );
                } else if (cantEncontrada !== cantEsperada) {
                    const nombreSoporte = `5 ${s.toLowerCase()}.pdf`;
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: Matriz espera ${cantEsperada}, pero hay ${cantEncontrada} en ${nombreSoporte}`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `${s}: ${cantEncontrada} evoluciones (coincide con matriz) ✓`
                    );
                }
            } else {
                // cantEsperada === 0
                if (tieneArchivo && cantEncontrada > 0) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `${s}: Soporte no programado (${cantEncontrada} evoluciones en 5 ${s.toLowerCase()}.pdf)`
                    );
                }
            }
        }
    } else if (tipoPaquete.startsWith("CPF")) {
        // En paquete nuevo sin matriz: validaciones por defecto
        const cantVM =
            resultados[carpeta].fechasPorServicio?.["VM"]?.length || 0;
        const cantENF =
            resultados[carpeta].fechasPorServicio?.["ENF"]?.length || 0;
        const cantVENF =
            resultados[carpeta].fechasPorServicio?.["VENF"]?.length || 0;

        if (cantVM !== 1) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de VM (tiene ${cantVM})`
            );
        } else {
            resultados[carpeta].exitosPorServicio["General"].push(
                `VM: 1 evolución ✓`
            );
        }

        const tieneEnf = resultados[carpeta].servicios?.has("ENF");
        const tieneVenf = resultados[carpeta].servicios?.has("VENF");

        if (!tieneEnf && !tieneVenf) {
            resultados[carpeta].erroresPorServicio["General"].push(
                `Paquete ${tipoPaquete} debe incluir al menos un servicio de enfermería (ENF o VENF)`
            );
        } else {
            if (tieneEnf) {
                if (cantENF !== 1) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de ENF (tiene ${cantENF})`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `ENF: 1 evolución ✓`
                    );
                }
            }

            if (tieneVenf) {
                if (cantVENF !== 1) {
                    resultados[carpeta].erroresPorServicio["General"].push(
                        `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de VENF (tiene ${cantVENF})`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `VENF: 1 evolución ✓`
                    );
                }
            }
        }

        // Validar que el opcional seleccionado tenga exactamente 1 evolución
        const opcionales = ["PSI", "NUT", "TS"];
        const opcionalEncontrado = opcionales.find(s => resultados[carpeta].servicios?.has(s));
        
        if (opcionalEncontrado) {
            const cantOpcional = resultados[carpeta].fechasPorServicio?.[opcionalEncontrado]?.length || 0;
            if (cantOpcional !== 1) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe tener exactamente 1 evolución de ${opcionalEncontrado} (tiene ${cantOpcional})`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `${opcionalEncontrado}: 1 evolución ✓`
                );
            }
        }

        // Sumar evoluciones de las 5 terapias
        let totalTerapias = 0;
        for (const s of TERAPIAS_CONTABLES) {
            totalTerapias +=
                resultados[carpeta].fechasPorServicio?.[s]?.length || 0;
        }

        const reglaTerapias = REGLAS_TERAPIAS_PAQUETES[tipoPaquete];
        const minTerapias = reglaTerapias?.min || 0;
        const maxTerapias = reglaTerapias?.max || 0;

        if (minTerapias > 0) {
            if (totalTerapias < minTerapias) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe tener mínimo ${minTerapias} terapias (tiene ${totalTerapias})`
                );
            } else if (totalTerapias > maxTerapias) {
                resultados[carpeta].erroresPorServicio["General"].push(
                    `Paquete ${tipoPaquete} debe tener máximo ${maxTerapias} terapias (tiene ${totalTerapias})`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"].push(
                    `Terapias sumadas: ${totalTerapias} (${minTerapias}-${maxTerapias}) ✓`
                );
            }
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
            /\d+\s+(VM|VENF|ENF12|ENF|TF|TRS|TR|TS|PSI|FON|TO|NUT)/
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
 * Valida un paquete nuevo
 */
function validarNuevoPaquete(
    carpeta,
    nombres,
    serviciosEncontrados,
    resultados,
    archivos,
    tipoPaquete,
    convenio
) {
    const serviciosReales = new Set(
        [...serviciosEncontrados].filter((s) => s !== "General" && s !== "PAQ")
    );

    // 1. Validar Obligatorios (VM y al menos una de ENF o VENF) solo si no hay matriz
    if (!resultados[carpeta].datosMatriz) {
        if (!serviciosReales.has("VM")) {
            resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir servicio obligatorio VM`);
        }
        if (!serviciosReales.has("ENF") && !serviciosReales.has("VENF")) {
            resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir al menos un servicio de enfermería (ENF o VENF)`);
        }

        // 2. Validar "Uno de los siguientes" (PSI, NUT, TS)
        const opcionales = ["PSI", "NUT", "TS"];
        const opcionalesEncontrados = opcionales.filter(s => serviciosReales.has(s));
        
        if (opcionalesEncontrados.length !== 1) {
            resultados[carpeta].errores.push(
                `Paquete ${tipoPaquete} debe incluir exactamente 1 servicio de (PSI, NUT, TS). Se encontraron: ${opcionalesEncontrados.length}`
            );
        } else {
            const opcionalSelec = opcionalesEncontrados[0];
            resultados[carpeta].alertasPorServicio[opcionalSelec] = resultados[carpeta].alertasPorServicio[opcionalSelec] || [];
        }
    }

    // Archivos requeridos por servicio para PAQUETE
    // Validar que NO haya "2 [servicio].pdf"
    for (const servicio of serviciosReales) {
        const servicioLower = servicio.toLowerCase();
        const num2Individual = `2 ${servicioLower}.pdf`;
        if (nombres.some(n => n.toLowerCase() === num2Individual)) {
            resultados[carpeta].errores.push(`Archivo no permitido: ${num2Individual} (Todo se valida desde el 2 PAQ)`);
        }
    }

    // Exigir que exista "2 PAQ.pdf"
    const tienePaq = nombres.some(n => n.toLowerCase() === "2 paq.pdf");
    if (!tienePaq) {
        resultados[carpeta].errores.push(`Paquete ${tipoPaquete} debe incluir archivo '2 PAQ.pdf'`);
    }

    // Preparar UI
    for (const servicio of serviciosReales) {
        resultados[carpeta].pdfsPorServicio[servicio] = {};
        resultados[carpeta].erroresPorServicio[servicio] ||= [];
        resultados[carpeta].exitosPorServicio[servicio] ||= [];

        for (const num of ["4", "5"]) {
            let existe = nombres.some(n => n.toLowerCase() === `${num} ${servicio.toLowerCase()}.pdf`);
            resultados[carpeta].pdfsPorServicio[servicio][num] = existe ? "✔" : "—";
            
            if (!existe) {
                resultados[carpeta].erroresPorServicio[servicio].push(`Falta ${num}.pdf`);
            } else {
                resultados[carpeta].exitosPorServicio[servicio].push(`${num}.pdf encontrado`);
            }
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
    convenio = "capital-salud",
    tipoPaquete = ""
) {
    let pdf = null;
    try {
        pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = await extraerTextoPDF(pdf);
        let textoPlanoNorm = normalizeForSearch(texto);

        // Helper para reintentar con OCR si aún no se ha ejecutado
        let ocrEjecutado = false;
        const asegurarOCR = async (terminoBuscado = "") => {
            if (!ocrEjecutado) {
                ocrEjecutado = true;
                const textoOCR = await extraerTextoOCRDePDF(pdf, 2, terminoBuscado);
                if (textoOCR && textoOCR.trim().length > 0) {
                    texto = (texto + " " + textoOCR).trim();
                    textoPlanoNorm = normalizeForSearch(texto);
                    fechas = extraerFechas(texto);
                }
            }
        };

        // Extraer fechas
        let fechas = extraerFechas(texto);

        // Determinar si es archivo "2 paq.pdf" (solo para fomag, o los nuevos)
        const esPaquete = file.name.toLowerCase().includes("paq.pdf") || file.name.toLowerCase().includes("paq");
        const numArchivo = file.name.match(/^(\d+) /)?.[1];

        // Validar número de documento en archivos 2 y 5 para FOMAG
        if (
            convenio === "fomag" &&
            (numArchivo === "2" || numArchivo === "5") &&
            servicio !== "PAQ"
        ) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                await asegurarOCR(nroDocumento);
            }

            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].erroresPorServicio[servicio] =
                    resultados[carpeta].erroresPorServicio[servicio] || [];
                resultados[carpeta].erroresPorServicio[servicio].push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
                // Marcar el badge del archivo con ✗
                if (resultados[carpeta].pdfsPorServicio[servicio] && numArchivo) {
                    resultados[carpeta].pdfsPorServicio[servicio][numArchivo] = "✗";
                }
            } else {
                // Agregar mensaje de éxito cuando se encuentra el documento
                resultados[carpeta].exitosPorServicio[servicio] =
                    resultados[carpeta].exitosPorServicio[servicio] || [];
                resultados[carpeta].exitosPorServicio[servicio].push(
                    `${file.name}: contiene número ${nroDocumento}`
                );
            }
        }

        // Si es paquete CPF nuevo y es el archivo "2 PAQ.pdf"
        if (esPaquete && numArchivo === "2" && tipoPaquete.startsWith("CPF")) {
            if (!textoPlanoNorm.includes(tipoPaquete.toUpperCase())) {
                await asegurarOCR();
            }

            // Validar que el código del paquete exista en el PDF
            if (!textoPlanoNorm.includes(tipoPaquete.toUpperCase())) {
                resultados[carpeta].erroresPorServicio["General"] = resultados[carpeta].erroresPorServicio["General"] || [];
                resultados[carpeta].erroresPorServicio["General"].push(
                    `2 PAQ.pdf: no contiene el código del paquete ${tipoPaquete}`
                );
            } else {
                resultados[carpeta].exitosPorServicio["General"] = resultados[carpeta].exitosPorServicio["General"] || [];
                resultados[carpeta].exitosPorServicio["General"].push(
                    `2 PAQ.pdf: contiene el código ${tipoPaquete}`
                );
            }
        } 
        // Si es "2 paq.pdf" de FOMAG (antiguo), procesar múltiples servicios
        else if (esPaquete && numArchivo === "2" && convenio === "fomag" && !tipoPaquete.startsWith("CPF")) {
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
                const fechasServicio = servicio === "PSI" ? fechas.slice(0, 1) : fechas;
                resultados[carpeta].fechasPorServicio[servicio] = fechasServicio;

                // Validar fechas duplicadas y orden
                if (fechasServicio.length > 0) {
                    const { duplicadas, desordenadas } =
                        validarOrdenFechas(fechasServicio);

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

            // Validar archivo 2 individual de FOMAG (solo para los paquetes antiguos o crónicos)
            if (
                numArchivo === "2" &&
                servicio !== "PAQ" &&
                convenio === "fomag" &&
                !tipoPaquete.startsWith("CPF")
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
            // - Para archivo 2: solo si NO es "2 paq.pdf" de FOMAG (antiguo) y NO es un paquete nuevo
            // - Para archivos 4 y 5: siempre
            const es2Paquete = esPaquete && numArchivo === "2";
            const debeAplicarRegla = claveArchivo && !es2Paquete && !(numArchivo === "2" && tipoPaquete.startsWith("CPF"));

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

                // Si no se encontró el texto, intentar OCR
                if (!textoEncontrado) {
                    await asegurarOCR();
                    for (const buscar of textosABuscar) {
                        const buscarNorm = normalizeForSearch(buscar);
                        if (textoPlanoNorm.includes(buscarNorm)) {
                            textoEncontrado = buscar;
                            break;
                        }
                    }
                }

                if (!textoEncontrado) {
                    resultados[carpeta].erroresPorServicio[servicio] =
                        resultados[carpeta].erroresPorServicio[servicio] || [];

                    const nombreMostrar = file?.name || `${numArchivo}.pdf`;
                    const mensajeFalta =
                        textosABuscar.length === 1
                            ? `${nombreMostrar}: no contiene el texto requerido "${textosABuscar[0]}"`
                            : `${nombreMostrar}: no contiene ninguno de los textos requeridos (${textosABuscar
                                  .map((t) => `"${t}"`)
                                  .join(" o ")})`;

                    resultados[carpeta].erroresPorServicio[servicio].push(
                        mensajeFalta
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
                    const nombreMostrar = file?.name || `${numArchivo}.pdf`;
                    resultados[carpeta].exitosPorServicio[servicio].push(
                        `${nombreMostrar}: contiene "${textoEncontrado}"`
                    );
                }

                // COMPARACIÓN: Solo para archivo 5.pdf y solo si NO es un nuevo paquete
                if (regla.igualarConFechas && numArchivo === "5" && !tipoPaquete.startsWith("CPF")) {
                    // Obtener Cant Auto (del 2.pdf ya procesado)
                    const cantAuto =
                        resultados[carpeta].numerosPorServicio?.[servicio] || 0;

                    // Obtener Cant HC (fechas del 5.pdf actual)
                    const fechasComparar = servicio === "PSI" ? fechas.slice(0, 1) : fechas;
                    const cantHC = fechasComparar.length;

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
    } finally {
        if (pdf && pdf.destroy) {
            try {
                await pdf.destroy();
            } catch (_) {}
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
