// Dueño: Persona A. Traduce los errores técnicos (de Google, de Gemini, de JavaScript) a mensajes que
// entienda un FR. El detalle técnico no se pierde: se escribe en el log de Apps Script (Ejecuciones).

// Error cuyo mensaje ya está pensado para el usuario: se muestra tal cual.
export class ErrorParaUsuario extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorParaUsuario';
  }
}

export const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Probá de nuevo y, si sigue pasando, avisale al equipo.';

interface Regla {
  patron: RegExp;
  mensaje: (m: RegExpMatchArray) => string;
}

const REGLAS: Regla[] = [
  {
    patron: /permisos especificados no son suficientes|required permissions|permission|PERMISSION_DENIED|googleapis\.com\/auth/i,
    mensaje: () => 'La app no tiene los permisos de Google que necesita para esto. Avisale al equipo para que lo revise.',
  },
  {
    patron: /Service invoked too many times|Servicio invocado demasiadas veces|Límite excedido|quota|cuota/i,
    mensaje: () => 'Google limitó el uso de la app por hoy. Probá de nuevo más tarde.',
  },
  {
    patron: /lock|timed out|tiempo de espera|se agotó el tiempo/i,
    mensaje: () => 'Alguien más está actualizando el CRM en este momento. Esperá unos segundos y probá de nuevo.',
  },
  {
    patron: /Transición inválida: "(.+)" -> "(.+)"/,
    mensaje: (m) => `No se puede pasar la empresa de "${m[1]}" a "${m[2]}".`,
  },
  {
    patron: /No existe la hoja|No se encontró la columna|no está dado de alta|parámetro "|El template de/i,
    mensaje: () => 'Hay un problema con la configuración del CRM o de los templates. Avisale al equipo para que lo revise.',
  },
];

// Mensajes en inglés o con pinta de código: no le sirven al FR.
const TECNICO = /TypeError|ReferenceError|SyntaxError|Cannot read|is not a function|undefined|Exception|https?:\/\/|[{}]/;

export function mensajeParaUsuario(e: unknown): string {
  if (e instanceof ErrorParaUsuario) return e.message;
  const crudo = (e instanceof Error ? e.message : String(e)).replace(/^(Exception|Error):\s*/, '');
  for (const r of REGLAS) {
    const m = crudo.match(r.patron);
    if (m) return r.mensaje(m);
  }
  return TECNICO.test(crudo) || !crudo.trim() ? MENSAJE_INESPERADO : crudo;
}

// Deja el detalle técnico en el log y devuelve el mensaje para la pantalla.
export function registrarYTraducir(e: unknown, contexto: string): string {
  const mensaje = mensajeParaUsuario(e);
  if (!(e instanceof ErrorParaUsuario)) {
    console.error(`[${contexto}] ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  }
  return mensaje;
}

// Envuelve una función expuesta a google.script.run: si falla, el navegador recibe un mensaje claro.
export function conMensajeClaro<A extends unknown[], R>(nombre: string, fn: (...args: A) => R): (...args: A) => R {
  return (...args: A) => {
    try {
      return fn(...args);
    } catch (e) {
      throw new ErrorParaUsuario(registrarYTraducir(e, nombre));
    }
  };
}
