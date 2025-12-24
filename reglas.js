// Reglas base (archivo 5) compartidas por evento y paquete
const REGLAS_BASE_5 = {
    TF: {
        "5.pdf": {
            debeContener: "REGISTRO DE TERAPIA FISICA",
            igualarConFechas: true,
        },
    },
    TR: {
        "5.pdf": {
            debeContener: "REGISTRO DE TERAPIA RESPIRATORIA",
            igualarConFechas: true,
        },
    },
    SUCCION: {
        "5.pdf": {
            debeContener: "REGISTRO DE TERAPIA SUCCION",
            igualarConFechas: true,
        },
    },
    VM: {
        "5.pdf": {
            debeContener: "REGISTRO VALORACION MEDICA",
            igualarConFechas: true,
        },
    },
    ENF: {
        "5.pdf": {
            debeContener: "REGISTRO ENFERMERIA",
            igualarConFechas: true,
        },
    },
    PS: {
        "5.pdf": {
            debeContener: "REGISTRO PSICOLOGIA",
            igualarConFechas: true,
        },
    },
    TS: {
        "5.pdf": {
            debeContener: "REGISTRO TRABAJO SOCIAL",
            igualarConFechas: true,
        },
    },
};

// Reglas para validación por evento (archivo 2 + base 5)
export const REGLAS_EVENTO = {
    TF: {
        "2.pdf": { debeContener: "ATENCION [VISITA] DOMICILIARIA POR" },
        ...REGLAS_BASE_5.TF,
    },
    TR: {
        "2.pdf": { debeContener: "TERAPIA RESPIRATORIA" },
        ...REGLAS_BASE_5.TR,
    },
    SUCCION: {
        "2.pdf": { debeContener: "TERAPIA SUCCION" },
        ...REGLAS_BASE_5.SUCCION,
    },
    VM: {
        "2.pdf": { debeContener: "VALORACION MEDICA" },
        ...REGLAS_BASE_5.VM,
    },
    ENF: {
        "2.pdf": { debeContener: "ENFERMERIA" },
        ...REGLAS_BASE_5.ENF,
    },
    PS: {
        "2.pdf": { debeContener: "PSICOLOGIA" },
        ...REGLAS_BASE_5.PS,
    },
    TS: {
        "2.pdf": { debeContener: "TRABAJO SOCIAL" },
        ...REGLAS_BASE_5.TS,
    },
};

// Reglas para validación por paquete: iguales al evento para archivo 5;
// el archivo 2 no se valida (difiere solo ese caso)
export const REGLAS_POR_CARPETA = REGLAS_BASE_5;

export const REGEX_FECHA =
    /(?<!\[)\b(\d\s*\d\s*\d\s*\d\s*-\s*\d\s*\d\s*-\s*\d\s*\d)\b\s+(?:\d(?:\s*\d)?(?:(?:\s*:\s*\d\s*\d)|(?:\s+\d\s*\d\s*:\s*\d\s*\d)))\b/g;
