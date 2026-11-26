// Dueño: Persona C (sección 7, C3). previsualizar() + crearBorrador(), con firma de Gmail del FR.
// Las partes que llaman a Gmail/Drive no se testean con Jest (ver README, sección 9); las
// partes puras (construirAsunto, textoPlano, construirDatosTemplate) sí están exportadas y testeadas.

import { now } from '../shared/clock';
import { ASUNTO_BORRADOR_TEMPLATE, ASUNTO_PINGUEO_TEMPLATE, PLACEHOLDERS_TEMPLATE } from '../shared/constants';
import type { ConfigService, DatosPingueo, MailService, PostReunionConfirmado, Usuario } from '../shared/types';
import { obtenerAdjuntosExtra, obtenerAdjuntosFijos } from './adjuntos';
import { docToHtml } from './docToHtml';
import { formatearFechaReunion } from './fechas';
import {
  reemplazarPlaceholders,
  reemplazarPlaceholdersPingueo,
  validarTemplate,
  validarTemplatePingueo,
  type DatosTemplate,
} from './template';
import { guardarBorradorPendiente } from '../sync/borradoresPendientes';
import { extraerMails } from '../shared/mails';

export function construirDatosTemplate(p: PostReunionConfirmado, fechaCarga: Date): DatosTemplate {
  return {
    persona: p.datos.persona ?? '',
    nombreEmpresa: p.empresa,
    fechaReunion: formatearFechaReunion(p.fechaReunion, fechaCarga),
    compromisos: p.datos.parrafoCompromisos,
  };
}

export function construirAsunto(empresa: string): string {
  return ASUNTO_BORRADOR_TEMPLATE.split(PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA).join(empresa);
}

export function construirAsuntoPingueo(empresa: string): string {
  return ASUNTO_PINGUEO_TEMPLATE.split(PLACEHOLDERS_TEMPLATE.NOMBRE_EMPRESA).join(empresa);
}

// Versión en texto plano del HTML, para el cuerpo alternativo del mail (los clientes que no
// rendericen HTML). No necesita ser perfecta, solo legible.
export function textoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function construirHtmlDelMail(config: ConfigService, p: PostReunionConfirmado): string {
  const club = config.getClub(p.club);
  const htmlTemplate = docToHtml(club.templateDocId);
  validarTemplate(htmlTemplate, p.club);
  return reemplazarPlaceholders(htmlTemplate, construirDatosTemplate(p, now()));
}

function construirHtmlDelMailPingueo(config: ConfigService, p: DatosPingueo): string {
  const club = config.getClub(p.club);
  const templateDocId =
    p.tipo === 'POST_REUNION' ? club.templatePingueoPostReunionDocId : club.templatePingueoPrimerContactoDocId;
  if (!templateDocId) {
    const nombreTemplate = p.tipo === 'POST_REUNION' ? 'post-reunión' : 'primer contacto';
    throw new Error(`El club ${p.club} todavía no tiene configurado el template de pingueo de ${nombreTemplate}`);
  }
  const htmlTemplate = docToHtml(templateDocId);
  validarTemplatePingueo(htmlTemplate, p.club);
  return reemplazarPlaceholdersPingueo(htmlTemplate, { persona: p.persona ?? '', nombreEmpresa: p.empresa });
}

// Busca la firma configurada por el FR en Gmail (Configuración → Firma) usando el servicio
// avanzado de Gmail; como la app corre como el FR, lee la suya. Si no tiene, no bloquea:
// devuelve null y el mail sale sin firma (el paso 2, en A, avisa de esto).
export function tieneFirmaConfigurada(): boolean {
  return obtenerFirmaHtml() !== null;
}

function obtenerFirmaHtml(): string | null {
  try {
    const respuesta = Gmail.Users!.Settings!.SendAs!.list('me');
    const direcciones = respuesta.sendAs ?? [];
    const principal = direcciones.find((d) => d.isPrimary) ?? direcciones[0];
    return principal?.signature ? principal.signature : null;
  } catch {
    return null;
  }
}

// Idempotencia: si la app ya había creado un borrador de este tipo para esta empresa y todavía
// no se mandó, lo reemplaza en vez de duplicarlo. Se identifica por el ID guardado en las
// propiedades de la cuenta (no por el asunto: el post-reunión y el pingueo tienen el mismo).
type TipoBorrador = 'POST_REUNION' | 'PINGUEO';

function claveBorrador(tipo: TipoBorrador, club: string, empresa: string): string {
  return `BORRADOR|${tipo}|${club}|${empresa.trim().toLowerCase()}`;
}

function borrarBorradorPrevio(tipo: TipoBorrador, club: string, empresa: string): void {
  const id = PropertiesService.getUserProperties().getProperty(claveBorrador(tipo, club, empresa));
  if (!id) return;
  try {
    GmailApp.getDraft(id).deleteDraft();
  } catch (e) {
    // Ya se mandó o lo borraron a mano: no hay nada que reemplazar.
  }
}

function recordarBorrador(tipo: TipoBorrador, club: string, empresa: string, draft: GoogleAppsScript.Gmail.GmailDraft): void {
  PropertiesService.getUserProperties().setProperty(claveBorrador(tipo, club, empresa), draft.getId());
}

function urlBorrador(draft: GoogleAppsScript.Gmail.GmailDraft): string {
  // Mejor esfuerzo: GmailApp no da una URL directa al borrador. El id del draft funciona como
  // parámetro "compose" en la mayoría de las cuentas; si no abriera directo, el borrador queda
  // igual en la carpeta de Borradores del FR.
  return `https://mail.google.com/mail/u/0/#drafts?compose=${draft.getId()}`;
}

export function crearMailService(config: ConfigService): MailService {
  return {
    previsualizar(p: PostReunionConfirmado, _fr: Usuario): string {
      return construirHtmlDelMail(config, p);
    },
    crearBorrador(p: PostReunionConfirmado, fr: Usuario): { draftId: string; url: string } {
      const destinatario = extraerMails(p.datos.mail).join(', ');
      if (!destinatario) {
        throw new Error(`No se puede crear el borrador para ${p.empresa}: falta el mail de contacto`);
      }
      const club = config.getClub(p.club);
      const firma = obtenerFirmaHtml();
      const htmlCuerpo = construirHtmlDelMail(config, p) + (firma ? `<br><br>${firma}` : '');
      const asunto = construirAsunto(p.empresa);

      borrarBorradorPrevio('POST_REUNION', p.club, p.empresa);

      const adjuntos = [
        ...obtenerAdjuntosFijos(club.carpetaAdjuntosId),
        ...obtenerAdjuntosExtra(p.adjuntosExtra),
      ];
      const draft = GmailApp.createDraft(destinatario, asunto, textoPlano(htmlCuerpo), {
        htmlBody: htmlCuerpo,
        attachments: adjuntos,
      });
      recordarBorrador('POST_REUNION', p.club, p.empresa, draft);
      // Para que el sync de Gmail sepa cuándo se mandó (ver sync/borradoresPendientes.ts).
      guardarBorradorPendiente('POST_REUNION', p.club, p.empresa, draft.getMessage().getThread().getId());
      return { draftId: draft.getId(), url: urlBorrador(draft) };
    },
    crearBorradorPingueo(p: DatosPingueo, _fr: Usuario): { draftId: string; url: string } {
      const firma = obtenerFirmaHtml();
      const htmlCuerpo = construirHtmlDelMailPingueo(config, p) + (firma ? `<br><br>${firma}` : '');
      const asunto = construirAsuntoPingueo(p.empresa);

      borrarBorradorPrevio('PINGUEO', p.club, p.empresa);

      const destinatarios = extraerMails(p.mail).join(', ');
      if (!destinatarios) throw new Error(`No se puede crear el pingueo para ${p.empresa}: falta el mail de contacto`);
      const draft = GmailApp.createDraft(destinatarios, asunto, textoPlano(htmlCuerpo), { htmlBody: htmlCuerpo });
      recordarBorrador('PINGUEO', p.club, p.empresa, draft);
      // El pingueo se cuenta en el CRM cuando se manda, no ahora (ver sync/borradoresPendientes.ts).
      guardarBorradorPendiente('PINGUEO', p.club, p.empresa, draft.getMessage().getThread().getId());
      return { draftId: draft.getId(), url: urlBorrador(draft) };
    },
  };
}
