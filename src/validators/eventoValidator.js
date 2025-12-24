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
        if (["2.pdf", "3.pdf", "5.pdf"].includes(file.name)) {
            if (!textoPlanoNorm.includes(nroDocumento)) {
                resultados[carpeta].errores.push(
                    `${file.name}: no contiene número ${nroDocumento}`
                );
                resultados[carpeta].pdfs[file.name] = "❌";
            }
        }

        // Aplicar reglas por tipo de carpeta
        const tipo = resultados[carpeta].tipo;
        const REGLAS_EVENTO = obtenerReglasEvento(convenio);

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
                    // Para debug: mostrar todo el texto del PDF
                    console.log(`❌ ERROR en ${file.name} (${tipo}):`);
                    console.log(`   Buscando: "${buscarNorm}"`);
                    console.log(`   Texto completo del PDF normalizado:`);
                    console.log(textoPlanoNorm);

                    resultados[carpeta].errores.push(
                        `${file.name}: falta "${regla.debeContener}"`
                    );
                    resultados[carpeta].pdfs[file.name] = "❌";
                } else {
                    console.log(
                        `✓ Éxito en ${file.name} (${tipo}): encontrado "${buscarNorm}"`
                    );
                }

                // Para FOMAG: extraer el número que aparece después del texto
                let numeroExtraido = null;
                if (regla.extraerNumero) {
                    numeroExtraido = extraerNumeroDelTexto(
                        texto,
                        regla.debeContener
                    );
                    if (numeroExtraido !== null) {
                        // Guardar el número extraído en resultados para mostrarlo
                        resultados[carpeta].numeroFomag = numeroExtraido;
                    }
                }

                // Regla de igualar con fechas
                if (regla.igualarConFechas) {
                    // Para archivo 2.pdf de FOMAG: validar contra el número extraído
                    if (
                        file.name === "2.pdf" &&
                        regla.extraerNumero &&
                        numeroExtraido !== null
                    ) {
                        if (numeroExtraido !== fechas.length) {
                            resultados[carpeta].errores.push(
                                `${file.name}: Número declarado ${numeroExtraido} ≠ Fechas ${fechas.length}`
                            );
                            resultados[carpeta].pdfs[file.name] = "❌";
                        }
                    } else {
                        // Para archivo 5.pdf o Capital Salud: validar veces que aparece el texto
                        if (vecesTexto !== fechas.length) {
                            resultados[carpeta].errores.push(
                                `${file.name}: Registros ${vecesTexto} ≠ Fechas ${fechas.length}`
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
