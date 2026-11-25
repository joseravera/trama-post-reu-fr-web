// Dueño: Persona C (sección 7, C4). Agrupa Aviso[] en mails por destinatario: un "Agenda" por FR,
// un mail de escalamientos por club para coordinadores, resumen semanal incluido los lunes.
//
// construirMailsAAgendar es lógica pura y está testeada; enviarMails() es la parte que llama a
// MailApp y a logAvisos.ts (ver README, sección 9) y no se testea con Jest.
//
// Cada mail va en HTML con la estética de marca (plantillaMail.ts) y con el texto plano de respaldo
// para los clientes que no muestran HTML.

import { PREFIJO_ASUNTO_AVISOS } from '../shared/constants';
import type { Aviso, Club, NotificadorService } from '../shared/types';
import { TIPOS_PARA_CLUB, TIPOS_PARA_FR } from './reglas';
import { registrarEnvio, yaSeEnvio } from './logAvisos';
import { LOGO_TRAMA_PNG_BASE64 } from './logoTrama';
import { layoutMail, tarjetaAgenda, tarjetaEscalamientos, tarjetaTexto, type Tarjeta } from './plantillaMail';

export interface MailAAgendar {
  destinatarios: string[];
  asunto: string;
  cuerpo: string; // texto plano (respaldo)
  html: string;
  avisos: Aviso[]; // para poder registrar el envío de cada uno en logAvisos
}

export interface OpcionesMail {
  // Tarjeta HTML de cada resumen semanal, por clave del aviso (la arma scheduler.ts con los datos del
  // resumen). Si falta, el resumen se muestra con su texto.
  tarjetasResumen?: ReadonlyMap<string, Tarjeta>;
  urlApp?: string | null; // URL de la web app, para el botón "Abrir FR Assistant"
}

function fechaDeClave(clave: string): Date {
  const partes = clave.split('|');
  return new Date(`${partes[partes.length - 1]}T00:00:00Z`);
}

function diaDeClave(fecha: Date): number {
  return Math.floor(fecha.getTime() / 86_400_000);
}

function ordenarPorFecha(avisos: Aviso[]): Aviso[] {
  return [...avisos].sort((a, b) => fechaDeClave(a.clave).getTime() - fechaDeClave(b.clave).getTime());
}

function construirSeccionAgenda(
  avisosFr: Aviso[],
  hoyUtc: number,
): { cuerpo: string; vencidos: number; proximos: number; textosVencidos: string[]; textosProximos: string[] } {
  const vencidos = ordenarPorFecha(avisosFr.filter((a) => diaDeClave(fechaDeClave(a.clave)) < hoyUtc));
  const proximos = ordenarPorFecha(avisosFr.filter((a) => diaDeClave(fechaDeClave(a.clave)) >= hoyUtc));

  const partes: string[] = [];
  if (vencidos.length > 0) partes.push(`Vencido:\n${vencidos.map((a) => `- ${a.texto}`).join('\n')}`);
  if (proximos.length > 0) partes.push(`Hasta el próximo envío:\n${proximos.map((a) => `- ${a.texto}`).join('\n')}`);
  return {
    cuerpo: partes.join('\n\n'),
    vencidos: vencidos.length,
    proximos: proximos.length,
    textosVencidos: vencidos.map((a) => a.texto),
    textosProximos: proximos.map((a) => a.texto),
  };
}

function agruparPorDestinatario(avisos: Aviso[]): Map<string, Aviso[]> {
  const grupos = new Map<string, Aviso[]>();
  for (const aviso of avisos) {
    for (const destinatario of aviso.destinatarios) {
      grupos.set(destinatario, [...(grupos.get(destinatario) ?? []), aviso]);
    }
  }
  return grupos;
}

function tarjetaDeResumen(aviso: Aviso, opciones: OpcionesMail): Tarjeta {
  return opciones.tarjetasResumen?.get(aviso.clave) ?? tarjetaTexto('Resumen semanal', aviso.texto);
}

function construirMailDeFr(destinatario: string, avisos: Aviso[], hoyUtc: number, opciones: OpcionesMail): MailAAgendar {
  const agenda = avisos.filter((a) => TIPOS_PARA_FR.includes(a.tipo));
  const resumen = avisos.filter((a) => a.tipo === 'RESUMEN_CODIS');

  const { cuerpo: cuerpoAgenda, vencidos, proximos, textosVencidos, textosProximos } = construirSeccionAgenda(agenda, hoyUtc);
  const cuerpoResumen = resumen.map((a) => a.texto).join('\n\n');

  // El color del mail es el del club del FR; si solo trae el resumen de codirectoras, el de Trama.
  const club = agenda.find((a) => a.club)?.club ?? null;
  const tarjetas: Tarjeta[] = [];
  if (agenda.length > 0) tarjetas.push(tarjetaAgenda(textosVencidos, textosProximos, club, opciones.urlApp ?? null));
  resumen.forEach((a) => tarjetas.push(tarjetaDeResumen(a, opciones)));

  const cuerpo = [cuerpoAgenda, cuerpoResumen].filter((s) => s.length > 0).join('\n\n---\n\n');
  const asunto =
    agenda.length > 0
      ? `${PREFIJO_ASUNTO_AVISOS} Tu agenda: ${vencidos} vencidos, ${proximos} para esta semana`
      : `${PREFIJO_ASUNTO_AVISOS} Resumen semanal`;

  return { destinatarios: [destinatario], asunto, cuerpo, html: layoutMail(club, tarjetas), avisos };
}

// Escalamientos y resumen de coordinador van en mails separados aunque sean del mismo club: el
// escalamiento incluye al FR de la empresa trabada "en copia" (frEnCopia en reglas.ts), y ese FR no
// tiene que recibir el resumen semanal del coordinador, que es solo para coordinadores.
function construirMailEscalamientosDeClub(club: Club, avisos: Aviso[]): MailAAgendar | null {
  const escalamientos = ordenarPorFecha(avisos.filter((a) => a.tipo === 'ESCALAMIENTO'));
  if (escalamientos.length === 0) return null;

  const cuerpo = `Empresas trabadas:\n${escalamientos.map((a) => `- ${a.texto}`).join('\n')}`;
  const tarjetas: Tarjeta[] = [tarjetaEscalamientos(escalamientos.map((a) => a.texto), club)];
  const destinatarios = [...new Set(escalamientos.flatMap((a) => a.destinatarios))];
  const asunto = `${PREFIJO_ASUNTO_AVISOS} Escalamientos — ${club}`;

  return { destinatarios, asunto, cuerpo, html: layoutMail(club, tarjetas), avisos: escalamientos };
}

function construirMailResumenDeClub(club: Club, avisos: Aviso[], opciones: OpcionesMail): MailAAgendar | null {
  const resumen = avisos.filter((a) => a.tipo === 'RESUMEN_COORDINADOR');
  if (resumen.length === 0) return null;

  const cuerpo = resumen.map((a) => a.texto).join('\n\n');
  const tarjetas = resumen.map((a) => tarjetaDeResumen(a, opciones));
  const destinatarios = [...new Set(resumen.flatMap((a) => a.destinatarios))];
  const asunto = `${PREFIJO_ASUNTO_AVISOS} Resumen semanal — ${club}`;

  return { destinatarios, asunto, cuerpo, html: layoutMail(club, tarjetas), avisos: resumen };
}

export function construirMailsAAgendar(avisos: Aviso[], ahora: Date, opciones: OpcionesMail = {}): MailAAgendar[] {
  const hoyUtc = Math.floor(ahora.getTime() / 86_400_000);

  const avisosPorFr = avisos.filter((a) => TIPOS_PARA_FR.includes(a.tipo) || a.tipo === 'RESUMEN_CODIS');
  const avisosPorClub = avisos.filter((a) => TIPOS_PARA_CLUB.includes(a.tipo));

  const mailsFr = [...agruparPorDestinatario(avisosPorFr).entries()].map(([destinatario, avisosDeEste]) =>
    construirMailDeFr(destinatario, avisosDeEste, hoyUtc, opciones),
  );

  const porClub = new Map<Club, Aviso[]>();
  for (const aviso of avisosPorClub) {
    if (!aviso.club) continue;
    porClub.set(aviso.club, [...(porClub.get(aviso.club) ?? []), aviso]);
  }
  const mailsClub = [...porClub.entries()].flatMap(([club, avisosDeEste]) =>
    [
      construirMailEscalamientosDeClub(club, avisosDeEste),
      construirMailResumenDeClub(club, avisosDeEste, opciones),
    ].filter((mail): mail is MailAAgendar => mail !== null),
  );

  return [...mailsFr, ...mailsClub].filter((mail) => mail.cuerpo.trim().length > 0);
}

export function enviarMails(avisos: Aviso[], opciones: OpcionesMail = {}): void {
  const avisosAEnviar = avisos.filter((a) => a.tipo !== 'ESCALAMIENTO' || !yaSeEnvio(a.clave));
  const mails = construirMailsAAgendar(avisosAEnviar, new Date(), opciones);
  const logo = Utilities.newBlob(Utilities.base64Decode(LOGO_TRAMA_PNG_BASE64), 'image/png', 'logo-trama.png');

  for (const mail of mails) {
    const escalamientosDelMail = mail.avisos.filter((a) => a.tipo === 'ESCALAMIENTO');
    try {
      MailApp.sendEmail({
        to: mail.destinatarios.join(','),
        subject: mail.asunto,
        body: mail.cuerpo,
        htmlBody: mail.html,
        inlineImages: { logo },
        name: 'Trama FR Assistant',
      });
      escalamientosDelMail.forEach((a) => registrarEnvio(a, true));
    } catch (error) {
      escalamientosDelMail.forEach((a) => registrarEnvio(a, false));
    }
  }
}

export function crearNotificadorService(): NotificadorService {
  return {
    enviar(avisos: Aviso[]): void {
      enviarMails(avisos);
    },
  };
}
