// Contratos entre módulos. Se modifica únicamente por PR aprobado por los 3
// (ver plan-implementacion-web.md).

// ---------- Dominio ----------
export type Club = 'Agro' | 'Consultoría' | 'Finanzas y Tecnología' | 'Emprendedores' | 'Trama Lab';

export type Estado =
  | 'Mail enviado' | 'Mail respondido'
  // Traspaso: el FR del año pasado le avisó a la empresa quién la sigue este año (Emprendedores).
  | 'FR viejo mando el mail de traspaso' | 'Respondió traspaso'
  | 'Reunión coordinada'
  | 'Tuvimos reunión, esperando respuesta' | 'Tratativas'
  | 'Va a ser sponsor' | 'No va a ser sponsor';

export type Rol = 'FR' | 'Coordinador' | 'Codirectora';

export interface Usuario {
  mail: string;
  nombre: string;
  club: Club | null; // null para codirectoras
  rol: Rol;
  admin?: boolean; // columna `admin` de _Usuarios: acceso a todos los clubes + "ver como"
  // Solo cuando un admin está usando "ver como": mail del admin real. Queda en _Historial (hechoPor).
  verComoPor?: string;
}

export interface FilaCRM {
  club: Club;
  empresa: string;
  trameroEncargado: string;
  persona?: string;
  rolPersona?: string;
  telefono?: string;
  mail?: string;
  linkedin?: string;
  estado?: Estado;
  comentarios?: string;
  fechaPrimerContacto?: Date;
  fechaUltimoContacto?: Date;
  canal?: string;
  proximaAccion?: string;
  fechaProximaAccion?: Date;
  pingueosSinRespuesta: number;
}

// ---------- Salida del LLM (la produce A) ----------
export interface Extraccion {
  persona: string | null;
  rolPersona: string | null;
  mail: string | null;
  telefono: string | null;
  linkedin: string | null;
  compromisosEmpresa: string[]; // lo que la empresa prometió
  compromisosTrama: string[]; // lo que Trama prometió / la empresa nos pidió
  parrafoCompromisos: string | null; // texto listo para el mail, null si no hubo compromisos
  estadoSugerido: Estado;
  comentarios: string; // resumen de la reunión (notas de Granola) para la columna Comentarios
  proximaAccion: string | null;
  fechaProximaAccion: string | null; // ISO yyyy-mm-dd
  camposFaltantes: string[]; // ej: ['mail', 'fechaProximaAccion']
}

// ---------- Lo que el FR confirma en el paso 2 ----------
export interface PostReunionConfirmado {
  club: Club;
  empresa: string;
  fechaReunion: Date;
  datos: Extraccion; // ya editado por el FR
  adjuntosExtra: string[]; // IDs de Drive elegidos por el FR
}

// ---------- Avisos (los produce C) ----------
export type TipoAviso =
  | 'CARGAR_POST_REUNION' | 'SEGUIMIENTO_VENCIDO' | 'PINGUEAR'
  | 'COMPROMISO_TRAMA' | 'ESCALAMIENTO'
  | 'RESUMEN_COORDINADOR' | 'RESUMEN_CODIS';

export interface Aviso {
  clave: string; // para deduplicar: tipo|club|empresa|fecha
  tipo: TipoAviso;
  destinatarios: string[]; // mails
  club?: Club;
  empresa?: string;
  texto: string;
}

// ---------- Eventos de historial (los guarda B) ----------
export interface Evento {
  timestamp: Date;
  club: Club;
  empresa: string;
  fr: string;
  tipo: 'ALTA' | 'CAMBIO_ESTADO' | 'PINGUEO' | 'RESPUESTA' | 'POST_REUNION';
  estadoAnterior?: Estado;
  estadoNuevo?: Estado;
  origen: 'UI' | 'CALENDAR' | 'GMAIL' | 'MANUAL';
  hechoPor?: string; // mail del admin si la acción se hizo en "ver como"
}

// ---------- Servicios ----------
export interface ConfigService { // B
  getUsuario(mail: string): Usuario | null;
  getUsuarios(filtro?: { rol?: Rol; club?: Club }): Usuario[];
  getClub(club: Club): {
    hoja: string;
    templateDocId: string;
    carpetaAdjuntosId: string;
    // Docs de template para A7 (pingueo), uno por club. Pueden venir vacíos todavía (solo
    // Emprendedores los tiene configurados mientras se prueba la función): en ese caso
    // MailService.crearBorradorPingueo tira un error claro en vez de abrir un Doc inexistente.
    templatePingueoPrimerContactoDocId: string;
    templatePingueoPostReunionDocId: string;
  };
  getParametro(nombre: string): number; // días de cada regla
  getParametroTexto(nombre: string): string | null; // parámetros no numéricos (ej. DIA_ENVIO_FR)
  // Clubes con `activo = TRUE` en _Clubes: los únicos que procesan los triggers (avisos,
  // historial diario, sync de Gmail/Calendar). Si la columna no existe, todos.
  getClubesActivos(): Club[];
}

export interface CrmService { // B
  buscarEmpresas(club: Club, texto: string): string[];
  getFila(club: Club, empresa: string): FilaCRM | null;
  listarFilas(club: Club): FilaCRM[];
  aplicarPostReunion(p: PostReunionConfirmado, fr: Usuario): FilaCRM; // valida transición, upsert, historial
  // Suma un pingueo. Lo llama el sync de Gmail cuando se manda el borrador de pingueo (`fecha` =
  // cuándo se mandó, origen GMAIL). Sin fecha: ahora; sin origen: 'UI'.
  registrarPingueo(club: Club, empresa: string, fr: Usuario, fecha?: Date, origen?: Evento['origen']): FilaCRM;
  // `origen` es opcional (default 'UI'): lo necesita B6 (sync de Gmail) para que el Evento quede
  // con origen: 'GMAIL' cuando la respuesta se detecta sola, en vez de 'UI' como si la hubiera
  // tocado el FR a mano (A7 sigue llamando esto igual que antes, sin pasar nada).
  // ⚠️ Parámetro nuevo en el contrato: avisar a A y C antes de mergear (regla de la sección 3.6).
  // `fecha`: cuándo llegó la respuesta (el sync de Gmail pasa la del mensaje); si no viene, ahora.
  registrarRespuesta(club: Club, empresa: string, fr: Usuario, origen?: Evento['origen'], fecha?: Date): FilaCRM;
  // El tramero encargado le escribió a la empresa en `fecha` (lo detecta el sync de Gmail). Aplica
  // ESTADO_AL_ESCRIBIR_ENCARGADO ("Respondió traspaso" → "Mail enviado"); si el estado no está en
  // esa tabla, no hace nada.
  registrarMailDelEncargado(club: Club, empresa: string, fr: Usuario, fecha: Date): FilaCRM;
  // Se mandó el mail post-reunión a la empresa en `fecha` (lo detecta el sync de Gmail por el
  // asunto). Aplica ESTADO_AL_MANDAR_RESUMEN ("Reunión coordinada" → "Tuvimos reunión, esperando
  // respuesta"); si el estado no está en esa tabla, no hace nada.
  registrarResumenEnviado(club: Club, empresa: string, fr: Usuario, fecha: Date): FilaCRM;
  cambiarEstado(club: Club, empresa: string, nuevo: Estado, fr: Usuario): FilaCRM;
  // Agregado por B para B5 (sync de Calendar): pasa a "Reunión coordinada" Y fija
  // "Próxima acción"/"Fecha próxima acción" en un solo paso (cambiarEstado no alcanza porque
  // no toca esos dos campos). Si la empresa ya estaba en "Reunión coordinada", solo actualiza
  // la fecha (reprogramación) sin exigir una transición ni duplicar el evento de cambio de estado.
  // ⚠️ Método nuevo en el contrato: avisar a A y C antes de mergear (regla de la sección 3.6).
  registrarReunionCoordinada(club: Club, empresa: string, fechaEvento: Date, fr: Usuario): FilaCRM;
  transicionValida(desde: Estado | undefined, hacia: Estado): boolean;
  getEventos(desde: Date, hasta: Date, club?: Club): Evento[];
}

export interface ExtraccionService { // A
  extraer(
    notas: string,
    ctx: { club: Club; empresa: string; filaExistente: FilaCRM | null; fechaReunion: Date },
  ): Extraccion;
}

// ---------- A7: pingueo (único botón de "Mis seguimientos") ----------
// 'PRIMER_CONTACTO': a la empresa solo se le mandó el mail inicial, nunca hubo reunión.
// 'POST_REUNION': ya hubo reunión y se mandó el mail post-reunión, pero no respondió.
export type TipoTemplatePingueo = 'PRIMER_CONTACTO' | 'POST_REUNION';

export interface DatosPingueo {
  club: Club;
  empresa: string;
  persona: string | null;
  mail: string; // mail del contacto en la empresa (no el del FR)
  tipo: TipoTemplatePingueo;
}

export interface MailService { // C
  previsualizar(p: PostReunionConfirmado, fr: Usuario): string; // HTML
  crearBorrador(p: PostReunionConfirmado, fr: Usuario): { draftId: string; url: string };
  crearBorradorPingueo(p: DatosPingueo, fr: Usuario): { draftId: string; url: string };
}

export interface NotificadorService { // C
  enviar(avisos: Aviso[]): void; // por mail, agrupados por destinatario
}
