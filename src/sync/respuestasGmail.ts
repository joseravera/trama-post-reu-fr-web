// Dueño: Persona B (sección 6, B6). Corre como cada FR, cada 1 hora. Solo lee metadatos
// (remitente, fecha); no guarda el contenido de los mails.

import { esEstadoFinal } from '../crm/maquinaEstados';
import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';

export function sincronizarRespuestasGmail(): void {
  const mailUsuario = Session.getActiveUser().getEmail();
  const usuario = crearConfigService().getUsuario(mailUsuario);
  if (!usuario || !usuario.club) return;

  const crm = crearCrmService();

  for (const fila of crm.listarFilas(usuario.club)) {
    if (!fila.mail || !fila.estado || esEstadoFinal(fila.estado)) continue;

    const hilos = GmailApp.search(`from:${fila.mail} newer_than:2d`);
    if (hilos.length === 0) continue;

    const fechaUltimoMensaje = hilos
      .flatMap((hilo) => hilo.getMessages())
      .reduce<Date | null>((masReciente, mensaje) => {
        // getDate() devuelve el Date "no estándar" de Apps Script: lo paso a Date real.
        const fecha = new Date(mensaje.getDate().getTime());
        return !masReciente || fecha > masReciente ? fecha : masReciente;
      }, null);

    if (fechaUltimoMensaje && (!fila.fechaUltimoContacto || fechaUltimoMensaje > fila.fechaUltimoContacto)) {
      crm.registrarRespuesta(usuario.club, fila.empresa, usuario, 'GMAIL');
    }
  }
}
