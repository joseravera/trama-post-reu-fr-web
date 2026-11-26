// Dueño: Persona B (sección 6, B6). Corre como cada usuario, cada 1 hora. Solo lee metadatos
// (remitente, destinatarios, fecha); no guarda el contenido de los mails.
//
// Para cada empresa no final de los clubes activos que le tocan al usuario (el suyo; las
// codirectoras sin club, todos los activos), mira su Gmail:
// 0. Si ya se mandó un borrador de pingueo que creó la app en la casilla de este usuario (se
//    reconoce por el hilo de Gmail del borrador): registrarPingueo → suma uno al contador.
// 1. Si la empresa escribió (desde cualquiera de los mails de la celda "Mail"): registrarRespuesta
//    → "Mail enviado" pasa a "Mail respondido" y "FR viejo mando el mail de traspaso" a
//    "Respondió traspaso" (ESTADO_AL_RESPONDER en crm/maquinaEstados.ts).
// 2. Si está en "Respondió traspaso" y el tramero encargado le escribió a la empresa después de
//    esa respuesta (se ve en la casilla del encargado o en la de un coordinador/codirectora que
//    estaba en copia): registrarMailDelEncargado → "Mail enviado".
// 3. Si está en "Reunión coordinada" y ya se mandó el borrador post-reunión que creó la app en
//    la casilla de este usuario (por el hilo, igual que el pingueo): registrarResumenEnviado →
//    "Tuvimos reunión, esperando respuesta".
// Todos los casos quedan en _Historial con origen GMAIL.

import { esEstadoFinal } from '../crm/maquinaEstados';
import { crearConfigService } from '../crm/config';
import { crearCrmService } from '../crm/repo';
import { mismoNombre } from '../shared/nombres';
import type { Club, FilaCRM } from '../shared/types';
import {
  consultaEnviosA,
  consultaRespuestas,
  esPosterior,
  evaluarTraspaso,
  extraerMails,
  type MensajeSimple,
  ultimaFecha,
} from './mailsContacto';
import { borrarBorradorPendiente, leerBorradorPendiente } from './borradoresPendientes';

const DIAS_VENTANA = 2;
// Para "¿el encargado contestó después que la empresa?" se mira una semana: la respuesta de la
// empresa puede ser de varios días antes que la del encargado.
const DIAS_VENTANA_ENCARGADO = 7;

function aSimple(m: GoogleAppsScript.Gmail.GmailMessage): MensajeSimple {
  return {
    de: m.getFrom(),
    para: m.getTo(),
    cc: m.getCc(),
    // getDate() devuelve el Date "no estándar" de Apps Script: lo paso a Date real.
    fecha: new Date(m.getDate().getTime()),
  };
}

// Mensajes ya enviados (no borradores) del hilo; vacío si el hilo ya no existe.
function enviadosDelHilo(hiloId: string): MensajeSimple[] {
  try {
    const hilo = GmailApp.getThreadById(hiloId);
    return hilo ? hilo.getMessages().filter((m) => !m.isDraft()).map(aSimple) : [];
  } catch (e) {
    return [];
  }
}

function buscarMensajes(consulta: string): MensajeSimple[] {
  return GmailApp.search(consulta)
    .flatMap((hilo) => hilo.getMessages())
    .map(aSimple);
}

export function sincronizarRespuestasGmail(): void {
  const mailUsuario = Session.getActiveUser().getEmail();
  const config = crearConfigService();
  const usuario = config.getUsuario(mailUsuario);
  if (!usuario) return;

  const activos = config.getClubesActivos();
  const clubes: Club[] = usuario.club
    ? activos.filter((c) => c === usuario.club)
    : usuario.rol === 'Codirectora' ? activos : [];
  if (clubes.length === 0) return;

  const usuarios = config.getUsuarios();
  const mailsTrama = usuarios.map((u) => u.mail);
  const crm = crearCrmService();

  for (const club of clubes) {
    for (const fila of crm.listarFilas(club)) {
      if (!fila.estado || esEstadoFinal(fila.estado)) continue;
      const mailsEmpresa = extraerMails(fila.mail);
      if (mailsEmpresa.length === 0) continue;

      let actual: FilaCRM = fila;

      // 0. ¿Se mandó un borrador de pingueo que creó la app?
      const hiloPingueo = leerBorradorPendiente('PINGUEO', club, fila.empresa);
      if (hiloPingueo) {
        const enviado = ultimaFecha(enviadosDelHilo(hiloPingueo), mailsTrama, mailsEmpresa);
        if (enviado) {
          actual = crm.registrarPingueo(club, fila.empresa, usuario, enviado, 'GMAIL');
          borrarBorradorPendiente('PINGUEO', club, fila.empresa);
        }
      }

      // 1. ¿Escribió la empresa?
      const consulta = consultaRespuestas(mailsEmpresa, DIAS_VENTANA);
      const respuesta = consulta ? ultimaFecha(buscarMensajes(consulta), mailsEmpresa) : null;
      if (respuesta && esPosterior(respuesta, actual.fechaUltimoContacto)) {
        actual = crm.registrarRespuesta(club, fila.empresa, usuario, 'GMAIL', respuesta);
      }

      // 2. ¿Le contestó el encargado después de que respondieran el traspaso?
      if (actual.estado === 'Respondió traspaso') {
        const mailEncargado = usuarios.find((u) => mismoNombre(u.nombre, actual.trameroEncargado))?.mail;
        const consultaEncargado = mailEncargado ? consultaEnviosA(mailEncargado, mailsEmpresa, DIAS_VENTANA_ENCARGADO) : null;
        const envio = consultaEncargado && mailEncargado
          ? ultimaFecha(buscarMensajes(consultaEncargado), [mailEncargado], mailsEmpresa)
          : null;
        if (envio) {
          const consultaEmpresa = consultaRespuestas(mailsEmpresa, DIAS_VENTANA_ENCARGADO);
          const fechasEmpresa = consultaEmpresa
            ? buscarMensajes(consultaEmpresa)
              .filter((m) => extraerMails(m.de).some((x) => mailsEmpresa.includes(x)))
              .map((m) => m.fecha)
            : [];
          const { mailEnviado, respuestaPosterior } = evaluarTraspaso(envio, fechasEmpresa, actual.fechaUltimoContacto);
          if (mailEnviado) {
            actual = crm.registrarMailDelEncargado(club, fila.empresa, usuario, envio);
            // Si la empresa ya contestó ese mail del encargado: "Mail enviado" → "Mail respondido".
            if (respuestaPosterior) {
              actual = crm.registrarRespuesta(club, fila.empresa, usuario, 'GMAIL', respuestaPosterior);
            }
          }
        }
      }

      // 3. ¿Se mandó el borrador post-reunión que creó la app?
      const hiloResumen = leerBorradorPendiente('POST_REUNION', club, fila.empresa);
      if (hiloResumen) {
        if (actual.estado !== 'Reunión coordinada') {
          borrarBorradorPendiente('POST_REUNION', club, fila.empresa); // el estado ya avanzó por otro lado
        } else {
          const enviado = ultimaFecha(enviadosDelHilo(hiloResumen), mailsTrama, mailsEmpresa);
          if (enviado) {
            crm.registrarResumenEnviado(club, fila.empresa, usuario, enviado);
            borrarBorradorPendiente('POST_REUNION', club, fila.empresa);
          }
        }
      }
    }
  }
}
