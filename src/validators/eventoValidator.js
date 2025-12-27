import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
import { obtenerReglasEvento } from "../reglas.js";
import { DEBUG } from "../config/constants.js";
import {
    normalizeForSearch,
    escapeRegExp,
    extraerNumeroDelTexto,
} from "../utils/textUtils.js";
import { extraerTextoPDF, extraerFechas } from "../utils/pdfUtils.js";

/**
 * Valida que solo existan archivos permitidos en la carpeta de evento
 * @param {File[]} archivos - Array de archivos en la carpeta
 * @param {Object} resultados - Objeto con los resultados de validación
 * @param {string} carpeta - Nombre de la carpeta
 */
export function validarArchivosPermitidosEvento(archivos, resultados, carpeta) {
    const archivosPermitidos = ["1.pdf", "2.pdf", "3.pdf", "4.pdf", "5.pdf"];
    const archivosNoPermitidos = [];

    for (const archivo of archivos) {
        const nombreLower = archivo.name.toLowerCase();
        if (!archivosPermitidos.includes(nombreLower)) {
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

        console.log(
            `❌ ${carpeta} - Archivos no permitidos encontrados: ${archivosNoPermitidos.join(
                ", "
            )}`
        );
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
    console.log(`\n🔍 Validando evento`);
    console.log(`   Carpeta: ${carpeta}`);
    console.log(`   Archivo: ${file.name}`);
    console.log(`   Ruta: ${file.webkitRelativePath || file.name}`);
    console.log(`   Convenio: ${convenio}`);

    try {
        const pdf = await pdfjsLib.getDocument({
            data: await file.arrayBuffer(),
        }).promise;

        const texto = await extraerTextoPDF(pdf);
        const textoPlano = texto.toUpperCase().replace(/\s+/g, " ").trim();
        const textoPlanoNorm = normalizeForSearch(texto);

        // Extraer fechas
        const fechas = extraerFechas(texto);
        resultados[carpeta].fechas.push(...fechas);

        // Validar número de documento
        // Para FOMAG: validar en 2.pdf y 5.pdf
        // Para otros convenios: validar en 2.pdf, 3.pdf y 5.pdf
        const archivosAValidar =
            convenio === "fomag"
                ? ["2.pdf", "5.pdf"]
                : ["2.pdf", "3.pdf", "5.pdf"];

        if (archivosAValidar.includes(file.name)) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].errores.push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
                resultados[carpeta].pdfs[file.name] = "❌";
                console.log(
                    `❌ ${carpeta} - ${file.name}: Documento ${nroDocumento} NO encontrado`
                );
            } else {
                // Agregar mensaje de éxito cuando se encuentra el documento
                resultados[carpeta].errores.push(
                    `✓ ${file.name}: contiene número ${nroDocumento}`
                );
                console.log(
                    `✓ ${carpeta} - ${file.name}: Documento ${nroDocumento} encontrado`
                );
            }
        }

        // Aplicar reglas por tipo de carpeta
        const tipo = resultados[carpeta].tipo;
        const REGLAS_EVENTO = obtenerReglasEvento(convenio);

        if (tipo && REGLAS_EVENTO[tipo]) {
            const regla = REGLAS_EVENTO[tipo][file.name];
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

                if (!textoEncontrado) {
                    // Para debug: mostrar todo el texto del PDF
                    console.log(`❌ ERROR en ${file.name} (${tipo}):`);
                    console.log(
                        `   Buscando alguno de: ${textosABuscar
                            .map((t) => `"${t}"`)
                            .join(" o ")}`
                    );
                    console.log(`   Texto completo del PDF normalizado:`);
                    console.log(textoPlanoNorm);

                    resultados[carpeta].errores.push(
                        `${file.name}: falta alguno de: ${textosABuscar.join(
                            " o "
                        )}`
                    );
                    resultados[carpeta].pdfs[file.name] = "❌";
                } else {
                    console.log(
                        `✓ Éxito en ${file.name} (${tipo}): encontrado "${textoEncontrado}"`
                    );
                }

                // Para FOMAG: extraer el número que aparece después del texto
                let numeroExtraido = null;
                if (regla.extraerNumero && textoEncontrado) {
                    numeroExtraido = extraerNumeroDelTexto(
                        texto,
                        textoEncontrado
                    );
                    if (numeroExtraido !== null) {
                        // Guardar el número extraído en resultados para mostrarlo
                        resultados[carpeta].numeroFomag = numeroExtraido;
                    }
                }

                // Regla de igualar con fechas
                if (regla.igualarConFechas) {
                    // Para archivo 2.pdf de FOMAG (evento): el número extraído
                    // de autorizaciones debe ser >= a la cantidad de evoluciones
                    if (
                        file.name === "2.pdf" &&
                        regla.extraerNumero &&
                        numeroExtraido !== null
                    ) {
                        if (numeroExtraido < fechas.length) {
                            resultados[carpeta].errores.push(
                                `${file.name}: Autorizaciones ${numeroExtraido} < evoluciones ${fechas.length}`
                            );
                            resultados[carpeta].pdfs[file.name] = "❌";
                        } else {
                            // Mensaje de validación exitosa (se muestra si el usuario activa "Mostrar validaciones exitosas")
                            resultados[carpeta].errores.push(
                                `✓ ${file.name}: autorizaciones ${numeroExtraido} mayor o igual que evoluciones ${fechas.length}`
                            );
                        }
                    } else {
                        // Para archivo 5.pdf o Capital Salud: validar veces que aparece el texto (debe ser igual)
                        if (vecesTexto !== fechas.length) {
                            resultados[carpeta].errores.push(
                                `${file.name}: Registros ${vecesTexto} ≠ cant evoluciones ${fechas.length}`
                            );
                            resultados[carpeta].pdfs[file.name] = "❌";
                        }
                    }
                }

                if (DEBUG) {
                    console.log({
                        carpeta,
                        file: file.name,
                        buscar,
                        vecesTexto,
                        fechasFound: fechas.length,
                        numeroExtraido,
                    });
                }
            }
        }
    } catch {
        resultados[carpeta].errores.push(`${file.name}: error leyendo PDF`);
        resultados[carpeta].pdfs[file.name] = "❌";
    }
}
