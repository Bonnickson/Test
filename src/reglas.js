// ========================================
// CONFIGURACIÓN DE REGLAS DE VALIDACIÓN
// ========================================
// Este archivo define las reglas para validar PDFs según:
// - Tipo de servicio (TF, TR, VM, ENF, PSI, TS, TO, SUCCION)
// - Convenio (Capital Salud o FOMAG)
// - Tipo de validación (Evento individual o Paquete mensual)

// ========================================
// 1. REGLAS PARA ARCHIVO 5.PDF
// ========================================
// Archivo 5: Registros clínicos individuales
// Todos los servicios usan las mismas reglas independiente del convenio

const REGLAS_ARCHIVO_5 = {
    TF: {
        debeContener: ["Registro De Terapia Física"],
        igualarConFechas: true,
    },
    TR: {
        debeContener: ["Registro De: Terapia Respiratoria"],
        igualarConFechas: true,
    },
    SUCCION: {
        debeContener: ["REGISTRO DE TERAPIA SUCCION"],
        igualarConFechas: true,
    },
    FON: {
        debeContener: ["Registro De Fonoaudiología"],
        igualarConFechas: true,
    },
    VM: {
        debeContener: [
            "Registro De Historia Clínica",
            "Registro De Evolución Médica",
        ],
        igualarConFechas: true,
    },
    ENF: {
        debeContener: ["Registro De Enfermería - Actividades"],
        igualarConFechas: true,
    },
    PSI: {
        debeContener: ["Registro De Psicología"],
        igualarConFechas: true,
    },
    TS: {
        debeContener: ["Registro De Trabajo Social"],
        igualarConFechas: true,
    },
    TO: {
        debeContener: ["Registro De Terapia Ocupacional"],
        igualarConFechas: true,
    },
};

// ========================================
// 2. REGLAS PARA ARCHIVO 2.PDF
// ========================================
// Archivo 2: Facturas o documentos de autorización
// Las reglas cambian según el convenio

// --- CAPITAL SALUD ---
// Solo valida que contenga el texto, NO compara número con fechas
const REGLAS_ARCHIVO_2_CAPITAL = {
    TF: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA POR",
        igualarConFechas: false,
    },
    TR: { debeContener: "TERAPIA RESPIRATORIA", igualarConFechas: false },
    SUCCION: { debeContener: "TERAPIA SUCCION", igualarConFechas: false },
    FON: {
        debeContener:
            "ATENCION (VISITA) DOMICILIARIA, POR FONIATRIA Y FONOAUDIOLOGIA",
        igualarConFechas: false,
    },
    VM: { debeContener: "VALORACION MEDICA", igualarConFechas: false },
    ENF: { debeContener: "ENFERMERIA", igualarConFechas: false },
    PSI: { debeContener: "PSICOLOGIA", igualarConFechas: false },
    TS: { debeContener: "TRABAJO SOCIAL", igualarConFechas: false },
    TO: { debeContener: "TERAPIA OCUPACIONAL", igualarConFechas: false },
};

// --- FOMAG ---
// Valida texto específico Y compara número con fechas del 5.pdf
const REGLAS_ARCHIVO_2_FOMAG = {
    TF: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR FISIOTERAPIA",
        igualarConFechas: true,
        extraerNumero: true,
    },
    TR: {
        debeContener:
            "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA RESPIRATORIA",
        igualarConFechas: true,
        extraerNumero: true,
    },
    SUCCION: {
        debeContener: "TERAPIA SUCCION",
        igualarConFechas: true,
        extraerNumero: true,
    },
    FON: {
        debeContener:
            "ATENCION (VISITA) DOMICILIARIA, POR FONIATRIA Y FONOAUDIOLOGIA",
        igualarConFechas: true,
        extraerNumero: true,
    },
    VM: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR MEDICINA GENERAL",
        igualarConFechas: true,
        extraerNumero: true,
    },
    ENF: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR ENFERMERIA",
        igualarConFechas: true,
        extraerNumero: true,
    },
    PSI: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR PSICOLOGIA",
        igualarConFechas: true,
        extraerNumero: true,
    },
    TS: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR TRABAJO SOCIAL",
        igualarConFechas: true,
        extraerNumero: true,
    },
    TO: {
        debeContener: "ATENCION (VISITA) DOMICILIARIA, POR TERAPIA OCUPACIONAL",
        igualarConFechas: true,
        extraerNumero: true,
    },
};

// ========================================
// 3. FUNCIONES PARA OBTENER REGLAS SEGÚN MODO
// ========================================

/**
 * Obtiene reglas para validación por EVENTO (individual)
 * Estructura: Cada servicio tiene archivo 2.pdf + 5.pdf
 *
 * @param {string} convenio - "capital-salud" o "fomag"
 * @returns {Object} Reglas por servicio con archivos 2.pdf y 5.pdf
 */
export function obtenerReglasEvento(convenio) {
    const reglas2 =
        convenio === "fomag"
            ? REGLAS_ARCHIVO_2_FOMAG
            : REGLAS_ARCHIVO_2_CAPITAL;

    return {
        TF: { "2.pdf": reglas2.TF, "5.pdf": REGLAS_ARCHIVO_5.TF },
        TR: { "2.pdf": reglas2.TR, "5.pdf": REGLAS_ARCHIVO_5.TR },
        SUCCION: {
            "2.pdf": reglas2.SUCCION,
            "5.pdf": REGLAS_ARCHIVO_5.SUCCION,
        },
        FON: { "2.pdf": reglas2.FON, "5.pdf": REGLAS_ARCHIVO_5.FON },
        VM: { "2.pdf": reglas2.VM, "5.pdf": REGLAS_ARCHIVO_5.VM },
        ENF: { "2.pdf": reglas2.ENF, "5.pdf": REGLAS_ARCHIVO_5.ENF },
        PSI: { "2.pdf": reglas2.PSI, "5.pdf": REGLAS_ARCHIVO_5.PSI },
        TS: { "2.pdf": reglas2.TS, "5.pdf": REGLAS_ARCHIVO_5.TS },
        TO: { "2.pdf": reglas2.TO, "5.pdf": REGLAS_ARCHIVO_5.TO },
    };
}

/**
 * Obtiene reglas para validación por PAQUETE (mensual)
 * Estructura: Cada servicio tiene archivo 2.pdf + 5.pdf
 * Diferencia: El 2.pdf SIEMPRE compara número con fechas (incluso en Capital Salud)
 *
 * @param {string} convenio - "capital-salud" o "fomag"
 * @returns {Object} Reglas por servicio con archivos 2.pdf y 5.pdf
 */
export function obtenerReglasPaquete(convenio) {
    const reglas2Base =
        convenio === "fomag"
            ? REGLAS_ARCHIVO_2_FOMAG
            : REGLAS_ARCHIVO_2_CAPITAL;

    const comparar = convenio === "fomag"; // Solo FOMAG compara autorizaciones vs evoluciones

    // Preparar reglas para 2.pdf según convenio
    const reglas2Paquete = {};
    for (const servicio in reglas2Base) {
        reglas2Paquete[servicio] = {
            ...reglas2Base[servicio],
            igualarConFechas: comparar,
        };
    }

    // Preparar reglas para 5.pdf: clonar y ajustar igualarConFechas según convenio
    const reglas5Paquete = {};
    for (const servicio in REGLAS_ARCHIVO_5) {
        const r5 = REGLAS_ARCHIVO_5[servicio];
        reglas5Paquete[servicio] = { ...r5, igualarConFechas: comparar };
    }

    return {
        TF: { "2.pdf": reglas2Paquete.TF, "5.pdf": reglas5Paquete.TF },
        TR: { "2.pdf": reglas2Paquete.TR, "5.pdf": reglas5Paquete.TR },
        SUCCION: {
            "2.pdf": reglas2Paquete.SUCCION,
            "5.pdf": reglas5Paquete.SUCCION,
        },
        FON: { "2.pdf": reglas2Paquete.FON, "5.pdf": reglas5Paquete.FON },
        VM: { "2.pdf": reglas2Paquete.VM, "5.pdf": reglas5Paquete.VM },
        ENF: { "2.pdf": reglas2Paquete.ENF, "5.pdf": reglas5Paquete.ENF },
        PSI: { "2.pdf": reglas2Paquete.PSI, "5.pdf": reglas5Paquete.PSI },
        TS: { "2.pdf": reglas2Paquete.TS, "5.pdf": reglas5Paquete.TS },
        TO: { "2.pdf": reglas2Paquete.TO, "5.pdf": reglas5Paquete.TO },
    };
}

// ========================================
// 4. EXPORTACIONES POR DEFECTO
// ========================================

// Exportar versión por defecto usando Capital Salud
export const REGLAS_EVENTO = obtenerReglasEvento("capital-salud");
export const REGLAS_POR_CARPETA = obtenerReglasPaquete("capital-salud");

// ========================================
// 5. REGEX PARA EXTRACCIÓN DE FECHAS
// ========================================

// Formato: YYYY-MM-DD HH:MM o YYYY-MM-DD H:MM o YYYY-MM-DD HH MM:MM
export const REGEX_FECHA =
    /(?<!\[)\b(\d\s*\d\s*\d\s*\d\s*-\s*\d\s*\d\s*-\s*\d\s*\d)\b\s+(?:\d(?:\s*\d)?(?:(?:\s*:\s*\d\s*\d)|(?:\s+\d\s*\d\s*:\s*\d\s*\d)))\b/g;
