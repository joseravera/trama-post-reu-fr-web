// Notas de prueba FICTICIAS (formato Granola) para el criterio de aceptación de A4:
// "con 10 notas de prueba, ninguna extracción inventa un mail o teléfono que no esté en el texto".
// Varias tienen trampas a propósito: persona sin mail, mail o teléfono de alguien de Trama,
// mail "deducible" del nombre, fechas relativas.
// TODO(A): sumar notas reales anonimizadas cuando Trama las pase.

import type { Club, Estado } from '../../src/shared/types';

export interface NotaPrueba {
  id: string;
  club: Club;
  empresa: string;
  fechaReunion: string; // yyyy-mm-dd
  estadoActual?: Estado;
  notas: string;
  // Lo que es válido extraer (todo lo demás sería inventado o de alguien de Trama).
  mailsValidos: string[];
  telefonosValidos: string[]; // solo dígitos
  // Si está, la fecha de próxima acción que tiene que salir (null = las notas no la dicen).
  fechaProximaAccionEsperada?: string | null;
}

export const NOTAS_PRUEBA: NotaPrueba[] = [
  {
    id: '01-sin-mail',
    club: 'Agro',
    empresa: 'Molinos del Litoral',
    fechaReunion: '2026-11-16',
    notas: `Reunión Molinos del Litoral
Participantes: Ricardo Paz (Gerente de RRHH), Tomás (Trama)
- Ricardo cuenta que hacen programa de jóvenes profesionales todos los años
- Interesados en el BootCamp pero tienen que ver presupuesto con la casa matriz en Rosario
- Quedó en mandarnos un mail la semana que viene
- No pasó contacto, escribirle por LinkedIn si no responde`,
    mailsValidos: [],
    telefonosValidos: [],
  },
  {
    id: '02-mail-de-trama',
    club: 'Consultoría',
    empresa: 'Estrategia Andina',
    fechaReunion: '2026-11-17',
    notas: `Estrategia Andina x Trama Consultoría
Asistentes: Paula Ibarra (Socia), Lucas Fontana (Trama, lucas.fontana@itba.edu.ar)
- Paula quiere sponsorear la Case Competition, categoría Main
- Pide que le mandemos el reglamento y las fechas
- Lucas le manda todo mañana desde su mail
- Paula: paula.ibarra@estrategiaandina.com`,
    mailsValidos: ['paula.ibarra@estrategiaandina.com'],
    telefonosValidos: [],
  },
  {
    id: '03-telefono-de-trama',
    club: 'Emprendedores',
    empresa: 'Impulso Ventures',
    fechaReunion: '2026-11-18',
    notas: `Call Impulso Ventures
- Hablamos con Germán Sosa, Partner
- Les interesa ser jurados en la Demo Night y poner un premio en efectivo
- Germán decide solo, nos confirma el viernes
- Si hay dudas, que llame a Sofi de Trama al 11 3030-4040
- Germán no dejó teléfono, el mail es german@impulsovc.com`,
    mailsValidos: ['german@impulsovc.com'],
    telefonosValidos: [],
  },
  {
    id: '04-rechazo',
    club: 'Finanzas y Tecnología',
    empresa: 'Fintech Patagonia',
    fechaReunion: '2026-11-10',
    estadoActual: 'Reunión coordinada',
    notas: `Reunión Fintech Patagonia
Con: Marina Quiroga (Employer Branding)
- Marina agradece pero este año no tienen presupuesto para eventos universitarios
- Recortaron todo el área después de la reestructuración
- Dice que volvamos a escribir en marzo del año que viene
- marina.quiroga@fintechpatagonia.com.ar | +54 9 294 455-1234`,
    mailsValidos: ['marina.quiroga@fintechpatagonia.com.ar'],
    telefonosValidos: ['5492944551234'],
  },
  {
    id: '05-confirman',
    club: 'Trama Lab',
    empresa: 'Robótica Austral',
    fechaReunion: '2026-11-12',
    estadoActual: 'Tratativas',
    notas: `Segunda reunión Robótica Austral
- Con Federico Luna (CTO) y Valeria (Administración)
- Confirman que van como sponsor Gold del Hackathon, ya está aprobado el presupuesto
- Valeria nos pide los datos para facturar, se los mandamos hoy
- Federico quiere dar un workshop de ROS el primer día
- Mail de Valeria para facturación: administracion@roboticaaustral.com`,
    mailsValidos: ['administracion@roboticaaustral.com'],
    telefonosValidos: [],
  },
  {
    id: '06-nombre-deducible',
    club: 'Agro',
    empresa: 'Tambos Unidos',
    fechaReunion: '2026-11-19',
    notas: `Tambos Unidos — primera reunión
- Hablamos con Carolina Méndez, jefa de comunicación
- La empresa usa mails nombre.apellido@tambosunidos.com.ar (lo comentó ella)
- Interés medio: les gusta la idea pero ya sponsorean otra universidad
- Que le mandemos el PDB y lo evalúan en diciembre`,
    mailsValidos: [],
    telefonosValidos: [],
  },
  {
    id: '07-otra-reunion',
    club: 'Consultoría',
    empresa: 'Grupo Delta',
    fechaReunion: '2026-11-13',
    estadoActual: 'Mail respondido',
    notas: `Grupo Delta
Participantes: Hernán Villalba (Talent Acquisition)
- Primera charla corta, Hernán tenía poco tiempo
- Quedamos en hacer otra reunión el martes 24 a las 15 con su jefa para presentarle la propuesta completa
- Tel Hernán 011 4789 2233
- hvillalba@grupodelta.com`,
    mailsValidos: ['hvillalba@grupodelta.com'],
    telefonosValidos: ['01147892233'],
  },
  {
    id: '08-fecha-relativa',
    club: 'Emprendedores',
    empresa: 'Café Origen',
    fechaReunion: '2026-11-20',
    notas: `Café Origen
- Con la dueña, Julieta Arce
- Quieren poner un stand de café en el evento de cierre a cambio de visibilidad (canje)
- Nos pidió el plano del lugar y la cantidad estimada de asistentes
- Le mandamos eso después del receso de la semana que viene
- WhatsApp de Julieta: 11-6677-8899`,
    mailsValidos: [],
    telefonosValidos: ['1166778899'],
  },
  {
    id: '09-varios-contactos',
    club: 'Finanzas y Tecnología',
    empresa: 'Seguros Horizonte',
    fechaReunion: '2026-11-11',
    notas: `Reunión Seguros Horizonte
Asistentes: Damián Ortega (Marketing), Lorena Paz (Compras), Juli y Nico (Trama)
- Damián lidera, Lorena ve la parte de contratación
- Interesados en el Fintech Summit, preguntan por la categoría Main
- Necesitan una propuesta formal en PDF para el comité del 2/12
- damian.ortega@seguroshorizonte.com.ar
- Lorena: compras@seguroshorizonte.com.ar`,
    mailsValidos: ['damian.ortega@seguroshorizonte.com.ar', 'compras@seguroshorizonte.com.ar'],
    telefonosValidos: [],
  },
  {
    id: '10-desordenada',
    club: 'Trama Lab',
    empresa: 'BioDatos',
    fechaReunion: '2026-11-18',
    notas: `biodatos
- ok con sponsorear? "probablemente" - Iván (fundador)
- mandaron deck, ver si encaja con Trama Lab
- nos pidieron casos de otros sponsors
- iván tiene que consultar con socios, respuesta en 2 semanas aprox
- contacto ivan arroba biodatos punto io (lo dictó así)`,
    mailsValidos: ['ivan@biodatos.io'],
    telefonosValidos: [],
  },
  {
    id: '11-proxima-accion-despues-del-mail',
    club: 'Emprendedores',
    empresa: 'Empresa de Prueba (manual)',
    fechaReunion: '2026-11-20',
    estadoActual: 'Mail respondido',
    notas: `Reunión Trama ITBA x Empresa de Prueba (manual)
vie, 20 nov 2026 · 15:00 – 15:35

Participantes
Laura Fernández (Empresa de Prueba), Jo (Trama – Emprendedores), Martín (Trama – Emprendedores)

### Sobre Empresa de Prueba (manual)
•  Laura es Gerente de Employer Branding y Talento Joven, lleva 2 años en el puesto
•  La empresa tiene ~800 empleados en Argentina, oficinas en CABA y Córdoba
•  Están armando un programa de jóvenes profesionales para 2027 y buscan visibilidad en universidades técnicas
•  El año pasado sponsorearon un evento en otra facultad, quedaron conformes pero sintieron que tuvieron poco contacto directo con estudiantes

### Presentación de Trama y el BootCamp
•  Le contamos qué es Trama y cómo se organizan los clubes
•  Presentamos el BootCamp: competencia de +150 estudiantes, proyectos de impacto, edición de mayo
•  Le interesó mucho la parte de mentorías: preguntó si gente de la empresa podría ser mentora o jurado
•  Preguntó por métricas de ediciones anteriores (asistentes, carreras, alcance en redes)

### Sponsoreo
•  Le explicamos a grandes rasgos las categorías del plan de beneficios
•  Dijo que el presupuesto de 2027 todavía no está cerrado, lo definen a principios de diciembre
•  La decisión final la toma su jefe (Director de RRHH), ella arma la propuesta interna
•  Le interesa más un paquete con presencia en el evento (stand + mentores) que solo logo

### Próximos pasos
•  Nosotros: mandarle el PDB actualizado y el documento del BootCamp
•  Nosotros: mandarle métricas de la edición anterior (asistentes, carreras, redes)
•  Laura: presentar la propuesta internamente y respondernos después del 10/12, cuando tengan el presupuesto cerrado
•  Si les cierra, coordinar una segunda reunión con su jefe en la segunda quincena de diciembre

### Contacto
•  laura.fernandez@example.com
•  Prefiere contacto por mail, no pasó teléfono`,
    mailsValidos: ['laura.fernandez@example.com'],
    telefonosValidos: [],
    fechaProximaAccionEsperada: '2026-12-10',
  },
];
