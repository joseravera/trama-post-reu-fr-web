// Dueño: Persona C (sección 7, C4 y C7). HTML de los mails de avisos y de los resúmenes semanales,
// con la estética del manual de marca de Trama (la misma de src/ui/styles.html).
//
// Los mails se arman con tablas y estilos inline porque Gmail no respeta <style>, variables CSS,
// SVG ni imágenes data:. Por eso las formas de los clubes van como caracteres parecidos y el logo
// va como imagen en línea (cid:logo, ver notificadorMail.ts). Si el cliente no carga Montserrat,
// cae en Arial.
//
// Lógica pura y testeada. Todo texto que viene del CRM pasa por esc().

import { ESTADOS } from '../shared/constants';
import type { Club, Estado } from '../shared/types';
import type { ResumenCodis, ResumenCoordinador } from './resumenes';

// Paleta oficial (manual de marca). Mismos valores que los tokens de src/ui/styles.html.
const COLOR = {
  violeta: '#8865DD',
  naranja: '#FE5501',
  amarillo: '#FED201',
  turquesa: '#00C1B0',
  rojo: '#FF3A4E',
  azul: '#2569FF',
  negro: '#212121',
  crema: '#F4ECE0',
  blanco: '#FFFFFF',
  gris: '#6B6660',
  linea: '#D9CFC0',
  negroSuave: '#343434',
  textoSobreNegro: '#D8D2C8',
};

const FUENTE = 'Montserrat,Arial,Helvetica,sans-serif';

export interface TemaClub {
  nombre: string;
  color: string; // color del club (--club)
  sobreColor: string; // texto sobre el color del club (--on-club)
  glifo: string; // forma del club como caracter (Gmail no muestra SVG)
}

// Mapeo club → color y forma, igual que en src/ui/styles.html y FORMA_CLUB de client.js.html.
const TEMA_TRAMA: TemaClub = { nombre: 'Trama ITBA', color: COLOR.violeta, sobreColor: COLOR.blanco, glifo: '&#9829;' };
const TEMA_CLUB: Record<Club, TemaClub> = {
  Consultoría: { nombre: 'Consultoría', color: COLOR.rojo, sobreColor: COLOR.negro, glifo: '&#10059;' },
  Emprendedores: { nombre: 'Emprendedores', color: COLOR.naranja, sobreColor: COLOR.negro, glifo: '&#10040;' },
  'Finanzas y Tecnología': { nombre: 'Finanzas y Tecnología', color: COLOR.turquesa, sobreColor: COLOR.negro, glifo: '&#10022;' },
  Agro: { nombre: 'Agro', color: COLOR.amarillo, sobreColor: COLOR.negro, glifo: '&#10041;' },
  'Trama Lab': { nombre: 'Trama Lab', color: COLOR.azul, sobreColor: COLOR.blanco, glifo: '&#10035;' },
};

export function temaDe(club?: Club | null): TemaClub {
  return club ? TEMA_CLUB[club] : TEMA_TRAMA;
}

// Colores de los estados del CRM: los mismos de .estado[data-estado] en src/ui/styles.html.
const COLOR_ESTADO: Record<Estado, { fondo: string; texto: string }> = {
  'Mail enviado': { fondo: '#ECE6DB', texto: COLOR.negro },
  'Mail respondido': { fondo: '#DCE6FF', texto: '#1546B8' },
  'FR viejo mando el mail de traspaso': { fondo: '#FFE3E6', texto: '#B0182B' },
  'Respondió traspaso': { fondo: '#D1F4F1', texto: '#00756B' },
  'Reunión coordinada': { fondo: '#EDE6F9', texto: '#5A37B0' },
  'Tuvimos reunión, esperando respuesta': { fondo: '#FFF1A6', texto: '#6B5500' },
  Tratativas: { fondo: '#FFE2D4', texto: '#A33500' },
  'Va a ser sponsor': { fondo: COLOR.turquesa, texto: COLOR.negro },
  'No va a ser sponsor': { fondo: COLOR.negro, texto: COLOR.blanco },
};

export function esc(texto: unknown): string {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------- Piezas ----------

export interface Tarjeta {
  html: string;
  oscura?: boolean; // tarjeta negra (escalamientos); si no, blanca
}

// Título en Montserrat Black mayúscula, con la segunda parte en el color del club.
function titulo(normal: string, acento: string, tema: TemaClub, oscura = false): string {
  // Amarillo sobre blanco no se lee: para Agro el acento va como resaltador (igual que el hero de la UI).
  const estiloAcento =
    tema.color === COLOR.amarillo && !oscura
      ? `background:${COLOR.amarillo};color:${COLOR.negro};padding:0 6px;border-radius:6px;`
      : `color:${tema.color};`;
  return (
    `<div style="font-weight:900;font-size:34px;line-height:1.05;text-transform:uppercase;letter-spacing:-.01em;">` +
    `${esc(normal)} <span style="${estiloAcento}">${esc(acento)}</span></div>`
  );
}

function bajada(texto: string, oscura = false): string {
  return `<p style="margin:12px 0 24px;font-size:15px;line-height:1.5;color:${oscura ? COLOR.textoSobreNegro : COLOR.negro};">${esc(texto)}</p>`;
}

function subtitulo(texto: string, cuenta?: { n: number; fondo: string; texto: string }): string {
  const badge = cuenta
    ? ` <span style="display:inline-block;background:${cuenta.fondo};color:${cuenta.texto};border-radius:999px;padding:1px 8px;font-size:11px;margin-left:4px;">${cuenta.n}</span>`
    : '';
  return `<div style="font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;">${esc(texto)}${badge}</div>`;
}

// Renglón con franja de color a la izquierda, como los .seg de "Mis seguimientos".
function renglon(contenidoHtml: string, franja: string, oscura = false, margenAbajo = 8): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:${margenAbajo}px;"><tr>` +
    `<td width="6" style="width:6px;background:${franja};border-radius:6px 0 0 6px;"></td>` +
    `<td style="background:${oscura ? COLOR.negroSuave : COLOR.crema};border-radius:0 12px 12px 0;padding:12px 14px;font-size:14px;line-height:1.45;">${contenidoHtml}</td>` +
    `</tr></table>`
  );
}

function boton(texto: string, url: string, fondo: string, color: string): string {
  return (
    `<a href="${esc(url)}" style="display:inline-block;background:${fondo};color:${color};text-decoration:none;font-weight:800;` +
    `font-size:13px;text-transform:uppercase;letter-spacing:.04em;padding:13px 22px;border-radius:12px;">${esc(texto)} &rarr;</a>`
  );
}

// ---------- Estructura del mail ----------

export function layoutMail(club: Club | null | undefined, tarjetas: Tarjeta[]): string {
  const tema = temaDe(club);
  const filasTarjetas = tarjetas
    .map(
      (t, i) =>
        `<tr><td style="background:${t.oscura ? COLOR.negro : COLOR.blanco};color:${t.oscura ? COLOR.blanco : COLOR.negro};` +
        `border-radius:24px;padding:32px 30px;">${t.html}</td></tr>` +
        (i < tarjetas.length - 1 ? '<tr><td height="16" style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>' : ''),
    )
    .join('');
  const mosaico = [COLOR.rojo, COLOR.amarillo, COLOR.naranja, COLOR.turquesa, COLOR.azul, COLOR.violeta]
    .map((c) => `<td height="34" style="height:34px;background:${c};"></td>`)
    .join('');

  return (
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet"></head>` +
    `<body style="margin:0;padding:0;background:${COLOR.crema};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.crema};">` +
    `<tr><td align="center" style="padding:28px 12px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FUENTE};color:${COLOR.negro};">` +
    // header: logo, marca y globo del club
    `<tr><td style="padding:0 4px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="52" style="width:52px;"><img src="cid:logo" width="44" height="44" alt="Trama" style="display:block;border-radius:50%;"></td>` +
    `<td style="padding-left:10px;line-height:1.1;">` +
    `<div style="font-weight:900;font-size:15px;text-transform:uppercase;letter-spacing:.01em;">FR Assistant</div>` +
    `<div style="font-weight:600;font-size:11px;color:${COLOR.gris};">Trama ITBA · Fundraising</div></td>` +
    `<td align="right"><span style="display:inline-block;background:${tema.color};color:${tema.sobreColor};font-weight:600;font-size:12px;` +
    `padding:6px 12px;border-radius:8px;">${tema.glifo} ${esc(tema.nombre)}</span></td>` +
    `</tr></table></td></tr>` +
    filasTarjetas +
    // mosaico con la paleta y pie
    `<tr><td style="padding:18px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-radius:14px;overflow:hidden;"><tr>${mosaico}</tr></table></td></tr>` +
    `<tr><td style="padding:14px 4px 0;font-size:11px;color:${COLOR.gris};line-height:1.5;">` +
    `<span style="color:${COLOR.violeta};">&#9829;</span> Trama ITBA · Fundraising · Este mail lo manda FR Assistant automáticamente.</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

// ---------- Tarjetas de cada mail ----------

// Agenda del FR: lo vencido con franja roja, lo que viene con el color del club.
export function tarjetaAgenda(vencidos: string[], proximos: string[], club: Club | null | undefined, urlApp: string | null): Tarjeta {
  const tema = temaDe(club);
  const partes = [titulo('Tu', 'agenda', tema), bajada('Esto es lo que tenés pendiente con tus empresas.')];
  if (vencidos.length > 0) {
    partes.push(subtitulo('Vencido', { n: vencidos.length, fondo: COLOR.rojo, texto: COLOR.negro }));
    vencidos.forEach((t, i) => partes.push(renglon(esc(t), COLOR.rojo, false, i === vencidos.length - 1 ? 26 : 8)));
  }
  if (proximos.length > 0) {
    partes.push(subtitulo('Hasta el próximo envío', { n: proximos.length, fondo: tema.color, texto: tema.sobreColor }));
    proximos.forEach((t, i) => partes.push(renglon(esc(t), tema.color, false, i === proximos.length - 1 ? 26 : 8)));
  }
  if (urlApp) partes.push(boton('Abrir FR Assistant', urlApp, COLOR.negro, COLOR.blanco));
  return { html: partes.join('') };
}

// Escalamientos para coordinadores: tarjeta negra.
export function tarjetaEscalamientos(textos: string[], club: Club | null | undefined): Tarjeta {
  const tema = temaDe(club);
  const partes = [titulo('Empresas', 'trabadas', tema, true), bajada('Estas empresas necesitan que alguien decida o dé una mano.', true)];
  textos.forEach((t, i) => partes.push(renglon(esc(t), COLOR.rojo, true, i === textos.length - 1 ? 0 : 8)));
  return { html: partes.join(''), oscura: true };
}

function kpi(valor: number, etiqueta: string, detalle: string, fondo: string, color: string, radio: string): string {
  return (
    `<td width="33%" style="width:33%;background:${fondo};color:${color};border-radius:${radio};padding:16px 14px;vertical-align:top;">` +
    `<div style="font-weight:900;font-size:32px;line-height:1;">${valor}</div>` +
    `<div style="font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-top:6px;">${esc(etiqueta)}</div>` +
    `<div style="font-size:11px;margin-top:2px;">${esc(detalle)}</div></td>`
  );
}

function chipEstado(estado: Estado, cantidad: number): string {
  const c = COLOR_ESTADO[estado];
  return (
    `<span style="display:inline-block;background:${c.fondo};color:${c.texto};border-radius:999px;padding:3px 10px;margin:0 4px 6px 0;">` +
    `${esc(estado)} · ${cantidad}</span>`
  );
}

// Resumen semanal del coordinador (lunes).
export function tarjetaResumenCoordinador(r: ResumenCoordinador): Tarjeta {
  const tema = temaDe(r.club);
  const partes = [titulo('Tu', 'semana', tema), bajada(`Lo que pasó en ${r.club} en los últimos 7 días.`)];

  partes.push(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;"><tr>` +
      kpi(r.contactosNuevos, 'Contactos nuevos', `semana anterior: ${r.contactosNuevosSemanaAnterior}`, tema.color, tema.sobreColor, '16px 0 0 16px') +
      kpi(r.reunionesHechas, 'Reuniones hechas', `semana anterior: ${r.reunionesHechasSemanaAnterior}`, COLOR.negro, COLOR.blanco, '0') +
      kpi(
        r.nuevosSponsors,
        r.nuevosSponsors === 1 ? 'Nuevo sponsor' : 'Nuevos sponsors',
        r.nuevosSponsorsEmpresas.length > 0 ? r.nuevosSponsorsEmpresas.join(', ') : 'ninguno esta semana',
        COLOR.turquesa,
        COLOR.negro,
        '0 16px 16px 0',
      ) +
      `</tr></table>`,
  );

  partes.push(subtitulo('Embudo'));
  partes.push(
    `<div style="line-height:1.9;margin-bottom:20px;font-size:12px;font-weight:700;">` +
      ESTADOS.map((e) => chipEstado(e, r.embudo[e] ?? 0)).join('') +
      `</div>`,
  );

  if (r.empresasTrabadas.length > 0) {
    partes.push(subtitulo('Empresas trabadas', { n: r.empresasTrabadas.length, fondo: COLOR.rojo, texto: COLOR.negro }));
    r.empresasTrabadas.forEach((t, i) =>
      partes.push(
        renglon(
          `<b>${esc(t.empresa)}</b> <span style="color:${COLOR.gris};">(${esc(t.fr)})</span> · ${esc(t.motivo)}`,
          COLOR.rojo,
          false,
          i === r.empresasTrabadas.length - 1 ? 24 : 8,
        ),
      ),
    );
  }

  if (r.actividadPorFr.length > 0) {
    partes.push(subtitulo('Post-reuniones cargadas esta semana'));
    partes.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;font-size:14px;">` +
        r.actividadPorFr
          .map(
            (a) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid ${COLOR.linea};">${esc(a.fr)}</td>` +
              `<td align="right" style="padding:8px 0;border-bottom:1px solid ${COLOR.linea};font-weight:800;">${a.postReunionesCargadas}</td></tr>`,
          )
          .join('') +
        `</table>`,
    );
  }

  if (r.recomendaciones.length > 0) {
    partes.push(
      renglon(
        `<div style="font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Recomendaciones</div>` +
          r.recomendaciones.map((rec) => `· ${esc(rec)}`).join('<br>'),
        tema.color,
        false,
        0,
      ),
    );
  }

  return { html: partes.join('') };
}

// Resumen consolidado de los 5 clubes para codirectoras (lunes). Tema Trama general (violeta).
export function tarjetaResumenCodis(r: ResumenCodis): Tarjeta {
  const partes = [titulo('Los 5', 'clubes', TEMA_TRAMA), bajada('Consolidado de los últimos 7 días.')];

  const celda = (contenido: string, extra = '') =>
    `<td align="right" style="padding:10px 0 10px 8px;border-top:1px solid ${COLOR.linea};${extra}">${contenido}</td>`;
  partes.push(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;margin-bottom:24px;">` +
      `<tr style="font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:${COLOR.gris};">` +
      `<td style="padding:0 0 8px;">Club</td><td align="right" style="padding:0 0 8px 8px;">Contactos</td><td align="right" style="padding:0 0 8px 8px;">Reuniones</td>` +
      `<td align="right" style="padding:0 0 8px 8px;">Sponsors</td><td align="right" style="padding:0 0 8px 8px;">Trabadas</td></tr>` +
      r.porClub
        .map(
          (c) =>
            `<tr><td style="padding:10px 0;border-top:1px solid ${COLOR.linea};font-weight:700;">` +
            `<span style="color:${temaDe(c.club).color};">&#9679;</span> ${esc(c.club)}</td>` +
            celda(String(c.contactos)) +
            celda(String(c.reuniones)) +
            celda(String(c.sponsors), 'font-weight:800;') +
            celda(String(c.trabadas)) +
            `</tr>`,
        )
        .join('') +
      `</table>`,
  );

  const avisos: string[] = [];
  if (r.clubesConMenosActividad.length > 0) {
    avisos.push(renglon(`<b>Menos actividad que la semana anterior:</b> ${r.clubesConMenosActividad.map(esc).join(', ')}`, COLOR.naranja));
  }
  if (r.nuevosSponsors.length > 0) {
    avisos.push(
      renglon(`<b>Nuevos sponsors:</b> ${r.nuevosSponsors.map((s) => `${esc(s.empresa)} (${esc(s.club)})`).join(', ')}`, COLOR.turquesa),
    );
  }
  partes.push(...avisos);

  return { html: partes.join('') };
}

// Para un aviso del que solo tenemos el texto ya formateado (respaldo si no llegó el HTML).
export function tarjetaTexto(tituloTexto: string, texto: string): Tarjeta {
  return {
    html:
      subtitulo(tituloTexto) +
      `<div style="font-size:14px;line-height:1.55;">${esc(texto).replace(/\n/g, '<br>')}</div>`,
  };
}
