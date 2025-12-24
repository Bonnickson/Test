// Configuración y constantes del validador

export const DEBUG = true;

export const ALLOWED_TYPES = [
    "TR",
    "SUCCION",
    "TF",
    "VM",
    "ENF",
    "PSI",
    "TS",
    "TO",
];

export const SERVICIOS_TERAPIA = ["TF", "TR", "SUCCION"];

export const SERVICIOS_NOMBRES = {
    ENF: "🩺 Enfermería",
    PSI: "🧠 Psicología",
    TF: "🏃 Terapia Física",
    TR: "🫁 Terapia Respiratoria",
    TS: "🤝 Trabajo Social",
    VM: "👨‍⚕️ Valoración Médica",
    SUCCION: "💨 Succión",
    TO: "🧘 Terapia Ocupacional",
};

export const PDF_WORKER_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

export const PDF_LIB_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
