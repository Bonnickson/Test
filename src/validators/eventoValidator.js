import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasEvento } from "../reglas.js";
import {
    DEBUG,
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
} from "../utils/pdfUtils.js";

/**
 * Valida que solo existan archivos permitidos en la carpeta de evento
 * @param {File[]} archivos - Array de archivos en la carpeta
 * @param {Object} resultados - Objeto con los resultados de validación
 * @param {string} carpeta - Nombre de la carpeta
 */
export function validarArchivosPermitidosEvento(
    archivos,
    resultados,
    carpeta,
    convenio = "capital-salud"
) {
    // Por defecto, solo 1.pdf..5.pdf
    const permitidosGenericos = new Set([
        "1.pdf",
        "2.pdf",
        "3.pdf",
        "4.pdf",
        "5.pdf",
    ]);
    const archivosNoPermitidos = [];

    // En FOMAG por evento, también se aceptan archivos por servicio:
    // Ej: "2 tf.pdf", "4 tr.pdf", "5 enf.pdf", "2 paq.pdf" (insensible a mayúsculas)
    const patronServicio = REGEX_SERVICIO_ARCHIVO;
    const es2Paq = (nombre) => nombre.toLowerCase() === "2 paq.pdf";

    for (const archivo of archivos) {
        const nombreLower = archivo.name.toLowerCase();
        const esGenerico = permitidosGenericos.has(nombreLower);
        const esServicio =
            convenio === "fomag" && patronServicio.test(nombreLower);
        const esPaq = convenio === "fomag" && es2Paq(archivo.name);
        if (!esGenerico && !esServicio && !esPaq) {
            archivosNoPermitidos.push(archivo.name);
        }
    }

    if (archivosNoPermitidos.length > 0) {
        // Agregar "General" como servicio
        if (!resultados[carpeta].servicios) {
            resultados[carpeta].servicios = new Set();
        }
        resultados[carpeta].servicios.add("General");

        // Inicializar arrays para el servicio General
        resultados[carpeta].erroresPorServicio["General"] =
            resultados[carpeta].erroresPorServicio["General"] || [];
        resultados[carpeta].exitosPorServicio["General"] =
            resultados[carpeta].exitosPorServicio["General"] || [];
        resultados[carpeta].alertasPorServicio["General"] =
            resultados[carpeta].alertasPorServicio["General"] || [];

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
 * Valida un PDF en modo evento
 * @param {File} file - Archivo PDF a validar
 * @param {string} carpeta - Nombre de la carpeta
 * @param {string} nroDocumento - Número de documento a verificar
 * @param {Object} resultados - Objeto con los resultados de validación
 * @param {string} convenio - Convenio seleccionado ('capital-salud' o 'fomag')
 */
export async function validarPDF(
    file,
    carpeta,
    nroDocumento,
    resultados,
    convenio = "capital-salud"
) {
    // console.log(`\n🔍 Validando evento`);
    // console.log(`   Carpeta: ${carpeta}`);
    // console.log(`   Archivo: ${file.name}`);
    // console.log(`   Ruta: ${file.webkitRelativePath || file.name}`);
    // console.log(`   Convenio: ${convenio}`);

    let pdf = null;
    try {
        pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        let texto = await extraerTextoPDF(pdf);
        let textoPlano = texto.toUpperCase().replace(/\s+/g, " ").trim();
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
        const fechas = extraerFechas(texto);
        resultados[carpeta].fechas.push(...fechas);

        // Detectar si el archivo es por servicio (FOMAG) ej: "2 tf.pdf"
        const nombreLower = file.name.toLowerCase();
        const matchServicio = nombreLower.match(
            /^([2-5])\s+(vm|enf12|enf|venf|tf|tr|succion|suc|trs|ts|psi|to|fon|nut)\.pdf$/
        );
        let servicioUpper = null;
        let numeroArchivo = null;
        if (matchServicio) {
            numeroArchivo = matchServicio[1];
            let serv = matchServicio[2];
            if (serv === "suc") serv = "succion";
            servicioUpper = serv.toUpperCase();

            // Inicializar arrays por servicio si no existen
            resultados[carpeta].erroresPorServicio[servicioUpper] =
                resultados[carpeta].erroresPorServicio[servicioUpper] || [];
            resultados[carpeta].exitosPorServicio[servicioUpper] =
                resultados[carpeta].exitosPorServicio[servicioUpper] || [];
            resultados[carpeta].fechasPorServicio[servicioUpper] =
                resultados[carpeta].fechasPorServicio[servicioUpper] || [];

            // Para FOMAG evento: guardar fechas por servicio (del archivo 5 que tiene las evoluciones)
            if (convenio === "fomag" && numeroArchivo === "5") {
                const fechasServicio = servicioUpper === "PSI" ? fechas.slice(0, 1) : fechas;
                resultados[carpeta].fechasPorServicio[servicioUpper].push(
                    ...fechasServicio
                );
            }
        }

        // Validar número de documento
        // - FOMAG: en archivos 2 y 5 (genéricos o por servicio)
        // - Otros convenios: en 2, 3 y 5 genéricos
        const debeValidarNumero = (() => {
            if (servicioUpper) {
                return (
                    convenio === "fomag" &&
                    (numeroArchivo === "2" || numeroArchivo === "5")
                );
            }
            if (convenio === "fomag") {
                return file.name === "2.pdf" || file.name === "5.pdf";
            }
            return (
                file.name === "2.pdf" ||
                file.name === "3.pdf" ||
                file.name === "5.pdf"
            );
        })();

        if (debeValidarNumero) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                await asegurarOCR();
            }

            if (!textoPlanoNorm.includes(nroDocumento)) {
                // Error: va a erroresPorServicio si es FOMAG con servicio, sino a errores generales
                if (servicioUpper && convenio === "fomag") {
                    resultados[carpeta].erroresPorServicio[servicioUpper].push(
                        `${file.name}: no contiene número ${nroDocumento}`
                    );
                } else {
                    resultados[carpeta].errores.push(
                        `${file.name}: no contiene número ${nroDocumento}`
                    );
                }
                if (resultados[carpeta].pdfs?.[file.name] !== undefined) {
                    resultados[carpeta].pdfs[file.name] = "❌";
                }
            } else {
                // Éxito: va a exitosPorServicio si es FOMAG con servicio
                if (servicioUpper && convenio === "fomag") {
                    resultados[carpeta].exitosPorServicio[servicioUpper].push(
                        `${file.name}: contiene número ${nroDocumento}`
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"] =
                        resultados[carpeta].exitosPorServicio["General"] || [];
                    resultados[carpeta].exitosPorServicio["General"].push(
                        `${file.name}: contiene número ${nroDocumento}`
                    );
                }
            }
        }

        // Aplicar reglas por tipo de carpeta
        const tipo = resultados[carpeta].tipo;
        const REGLAS_EVENTO = obtenerReglasEvento(convenio);

        // Seleccionar regla: si es archivo por servicio, usar ese servicio; si no, usar tipo de carpeta
        let regla = null;
        if (servicioUpper && REGLAS_EVENTO[servicioUpper]) {
            regla = REGLAS_EVENTO[servicioUpper][`${numeroArchivo}.pdf`];
        } else if (tipo && REGLAS_EVENTO[tipo]) {
            regla = REGLAS_EVENTO[tipo][file.name];
        }

        if (regla) {
            // Convertir debeContener a array si no lo es (compatibilidad)
            const textosABuscar = Array.isArray(regla.debeContener)
                ? regla.debeContener
                : [regla.debeContener];

            let textoEncontrado = null;
            let vecesTexto = 0;

            // Buscar cualquiera de los textos
            for (const buscar of textosABuscar) {
                const buscarNorm = normalizeForSearch(buscar);
                const safe = escapeRegExp(buscarNorm);
                const veces = (
                    textoPlanoNorm.match(new RegExp(safe, "g")) || []
                ).length;

                if (veces > 0) {
                    textoEncontrado = buscar;
                    vecesTexto = veces;
                    break;
                }
            }

            // Si no se encontró el texto, intentar con OCR
            if (!textoEncontrado) {
                await asegurarOCR();
                for (const buscar of textosABuscar) {
                    const buscarNorm = normalizeForSearch(buscar);
                    const safe = escapeRegExp(buscarNorm);
                    const veces = (
                        textoPlanoNorm.match(new RegExp(safe, "g")) || []
                    ).length;

                    if (veces > 0) {
                        textoEncontrado = buscar;
                        vecesTexto = veces;
                        break;
                    }
                }
            }

            if (!textoEncontrado) {
                const mensajeFalta =
                    textosABuscar.length === 1
                        ? `${file.name}: no contiene el texto requerido "${textosABuscar[0]}"`
                        : `${file.name}: no contiene ninguno de los textos requeridos (${textosABuscar
                              .map((t) => `"${t}"`)
                              .join(" o ")})`;

                // Error: va a erroresPorServicio si es FOMAG con servicio
                if (servicioUpper && convenio === "fomag") {
                    resultados[carpeta].erroresPorServicio[servicioUpper].push(
                        mensajeFalta
                    );
                } else {
                    resultados[carpeta].errores.push(mensajeFalta);
                }
                if (resultados[carpeta].pdfs?.[file.name] !== undefined) {
                    resultados[carpeta].pdfs[file.name] = "❌";
                }
            } else {
                // Éxito: texto encontrado
                const msg = `${file.name}: contiene "${textoEncontrado}"`;
                if (servicioUpper && convenio === "fomag") {
                    resultados[carpeta].exitosPorServicio[servicioUpper].push(
                        msg
                    );
                } else {
                    resultados[carpeta].exitosPorServicio["General"] =
                        resultados[carpeta].exitosPorServicio["General"] || [];
                    resultados[carpeta].exitosPorServicio["General"].push(msg);
                }
            }

            // Validar páginas para archivo 4.pdf (Firmas) o archivos por servicio número 4
            const esArchivo4 =
                file.name === "4.pdf" ||
                (servicioUpper && numeroArchivo === "4");

            if (esArchivo4) {
                if (pdf.numPages > 1) {
                    const msg = `${file.name}: Tiene ${pdf.numPages} páginas (se espera 1)`;
                    if (servicioUpper && convenio === "fomag") {
                        resultados[carpeta].alertasPorServicio[
                            servicioUpper
                        ].push(msg);
                    } else {
                        resultados[carpeta].alertasPorServicio["General"] =
                            resultados[carpeta].alertasPorServicio[
                            "General"
                            ] || [];
                        resultados[carpeta].alertasPorServicio["General"].push(
                            msg
                        );
                    }
                } else {
                    const msg = `${file.name}: 1 página (correcto)`;
                    if (servicioUpper && convenio === "fomag") {
                        resultados[carpeta].exitosPorServicio[
                            servicioUpper
                        ].push(msg);
                    } else {
                        resultados[carpeta].exitosPorServicio["General"] =
                            resultados[carpeta].exitosPorServicio[
                            "General"
                            ] || [];
                        resultados[carpeta].exitosPorServicio["General"].push(
                            msg
                        );
                    }
                }
            }

            // Para FOMAG: extraer el número que aparece después del texto
            let numeroExtraido = null;
            if (regla.extraerNumero && textoEncontrado) {
                numeroExtraido = extraerNumeroDelTexto(texto, textoEncontrado);
                if (numeroExtraido !== null) {
                    resultados[carpeta].numeroFomag = numeroExtraido;

                    // Para archivos por servicio (2 tf.pdf, 4 tf.pdf), guardar en numerosPorServicio
                    if (
                        servicioUpper &&
                        convenio === "fomag" &&
                        (numeroArchivo === "2" || numeroArchivo === "4")
                    ) {
                        resultados[carpeta].numerosPorServicio =
                            resultados[carpeta].numerosPorServicio || {};
                        resultados[carpeta].numerosPorServicio[servicioUpper] =
                            numeroExtraido;
                    }
                }
            }

            // COMPARACIÓN AUTORIZACIONES VS EVOLUCIONES
            // Solo para archivo 5.pdf (donde están las evoluciones)
            // Similar a como se hace en paquetes
            if (
                regla.igualarConFechas &&
                servicioUpper &&
                convenio === "fomag" &&
                numeroArchivo === "5"
            ) {
                // Obtener cantidad de autorizaciones (del 2.pdf o 4.pdf ya procesado)
                const cantAuto =
                    resultados[carpeta].numerosPorServicio?.[servicioUpper] ||
                    0;
                // Obtener cantidad de evoluciones (fechas del 5.pdf actual)
                const fechasComparar = servicioUpper === "PSI" ? fechas.slice(0, 1) : fechas;
                const cantHC = fechasComparar.length;

                if (cantAuto !== cantHC) {
                    if (cantAuto < cantHC) {
                        // ERROR: autorizaciones < evoluciones
                        resultados[carpeta].erroresPorServicio[
                            servicioUpper
                        ].push(
                            `Cant autorizaciones ${cantAuto} < cant evoluciones ${cantHC}`
                        );
                    } else {
                        // ALERTA: autorizaciones > evoluciones
                        resultados[carpeta].alertasPorServicio =
                            resultados[carpeta].alertasPorServicio || {};
                        resultados[carpeta].alertasPorServicio[servicioUpper] =
                            resultados[carpeta].alertasPorServicio[
                            servicioUpper
                            ] || [];
                        resultados[carpeta].alertasPorServicio[
                            servicioUpper
                        ].push(
                            `Cant autorizaciones ${cantAuto} > cant evoluciones ${cantHC}`
                        );
                    }
                } else if (cantAuto > 0) {
                    // ÉXITO: coinciden
                    resultados[carpeta].exitosPorServicio[servicioUpper].push(
                        `Cant autorizaciones ${cantAuto} = cant evoluciones ${cantHC}`
                    );
                }
            }
        }
    } catch {
        resultados[carpeta].errores.push(`${file.name}: error leyendo PDF`);
        if (resultados[carpeta].pdfs?.[file.name] !== undefined) {
            resultados[carpeta].pdfs[file.name] = "❌";
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
 * Procesa archivo "2 paq.pdf" de FOMAG en modo evento
 * Busca autorizaciones para cada servicio detectado en archivos 5
 */
export async function procesarArchivo2PaqEvento(
    file,
    carpeta,
    resultados,
    serviciosDetectados
) {
    let pdf = null;
    try {
        pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        const texto = await extraerTextoPDF(pdf);
        const textoPlanoNorm = normalizeForSearch(texto);

        for (const servicio of serviciosDetectados) {
            // Verificar si ya tiene número de autorizaciones (de un 2 individual)
            if (resultados[carpeta].numerosPorServicio?.[servicio]) {
                continue; // Ya tiene datos del archivo individual
            }

            const textoABuscar = obtenerTextoServicioFomag(servicio);
            if (!textoABuscar) continue;

            const textoNorm = normalizeForSearch(textoABuscar);
            const encontrado = textoPlanoNorm.includes(textoNorm);

            if (encontrado) {
                const numero = extraerNumeroDelTexto(texto, textoABuscar);
                if (numero !== null) {
                    resultados[carpeta].numerosPorServicio =
                        resultados[carpeta].numerosPorServicio || {};
                    resultados[carpeta].numerosPorServicio[servicio] = numero;
                }
            }
        }
    } catch {
        resultados[carpeta].errores.push(`2 paq.pdf: error leyendo PDF`);
    } finally {
        if (pdf && pdf.destroy) {
            try {
                await pdf.destroy();
            } catch (_) {}
        }
    }
}
