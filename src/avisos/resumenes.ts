// Dueño: Persona C (sección 7, C7). Resúmenes semanales (lunes 9:00) para coordinadores y codirectoras.
// Lógica pura, testeada sin Apps Script: recibe filas/eventos ya filtrados (CrmService.listarFilas /
// getEventos los trae) y devuelve texto listo para mandar por notificadorMail.ts.

import { ESTADOS, ESTADOS_FINALES } from '../shared/constants';
import type { Club, Estado, Evento, FilaCRM } from '../shared/types';

// No viene de _Parametros (ParametrosReglas no se pasa acá a propósito, para que el resumen
// sea independiente del motor de reglas): mismo umbral que PINGUEOS_ESCALA por defecto.
const UMBRAL_PINGUEOS_TRABADA = 2;

export interface ResumenCoordinador {
  club: Club;
  contactosNuevos: number;
  contactosNuevosSemanaAnterior: number;
  reunionesHechas: number;
  reunionesHechasSemanaAnterior: number;
  nuevosSponsorsEmpresas: string[];
  nuevosSponsors: number;
  embudo: Record<Estado, number>;
  empresasTrabadas: Array<{ empresa: string; fr: string; motivo: string }>;
  actividadPorFr: Array<{ fr: string; postReunionesCargadas: number }>;
  recomendaciones: string[];
}

function contar(eventos: Evento[], tipo: Evento['tipo']): number {
  return eventos.filter((e) => e.tipo === tipo).length;
}

function nuevosSponsorsDe(eventos: Evento[]): string[] {
  const empresas = eventos.filter((e) => e.estadoNuevo === 'Va a ser sponsor').map((e) => e.empresa);
  return [...new Set(empresas)];
}

function esSeguimientoVencido(fila: FilaCRM, ahora: Date): boolean {
  if (!fila.estado || ESTADOS_FINALES.includes(fila.estado)) return false;
  return !!fila.fechaProximaAccion && fila.fechaProximaAccion.getTime() < ahora.getTime();
}

function construirEmbudo(filas: FilaCRM[]): Record<Estado, number> {
  const embudo = Object.fromEntries(ESTADOS.map((estado) => [estado, 0])) as Record<Estado, number>;
  for (const fila of filas) {
    if (fila.estado) embudo[fila.estado] += 1;
  }
  return embudo;
}

function construirEmpresasTrabadas(filas: FilaCRM[], ahora: Date): ResumenCoordinador['empresasTrabadas'] {
  return filas
    .filter((f) => f.pingueosSinRespuesta >= UMBRAL_PINGUEOS_TRABADA || esSeguimientoVencido(f, ahora))
    .map((f) => ({
      empresa: f.empresa,
      fr: f.trameroEncargado,
      motivo:
        f.pingueosSinRespuesta >= UMBRAL_PINGUEOS_TRABADA
          ? `${f.pingueosSinRespuesta} pingueos sin respuesta`
          : 'seguimiento vencido',
    }));
}

function construirActividadPorFr(eventosSemanaActual: Evento[]): ResumenCoordinador['actividadPorFr'] {
  const porFr = new Map<string, number>();
  for (const evento of eventosSemanaActual) {
    if (evento.tipo !== 'POST_REUNION') continue;
    porFr.set(evento.fr, (porFr.get(evento.fr) ?? 0) + 1);
  }
  return [...porFr.entries()].map(([fr, postReunionesCargadas]) => ({ fr, postReunionesCargadas }));
}

function construirRecomendaciones(
  empresasTrabadas: ResumenCoordinador['empresasTrabadas'],
  filas: FilaCRM[],
  ahora: Date,
): string[] {
  const recomendaciones: string[] = [];

  const porPingueos = empresasTrabadas.filter((t) => t.motivo.includes('pingueos'));
  if (porPingueos.length > 0) {
    recomendaciones.push(
      `${porPingueos.length} empresas con ${UMBRAL_PINGUEOS_TRABADA}+ pingueos sin respuesta: decidir si se descartan.`,
    );
  }

  const vencidosPorFr = new Map<string, number>();
  for (const fila of filas) {
    if (esSeguimientoVencido(fila, ahora)) {
      vencidosPorFr.set(fila.trameroEncargado, (vencidosPorFr.get(fila.trameroEncargado) ?? 0) + 1);
    }
  }
  for (const [fr, cantidad] of vencidosPorFr) {
    recomendaciones.push(`${fr} tiene ${cantidad} seguimiento${cantidad > 1 ? 's' : ''} vencido${cantidad > 1 ? 's' : ''}.`);
  }

  return recomendaciones;
}

export function construirResumenCoordinador(
  club: Club,
  filas: FilaCRM[],
  eventosSemanaActual: Evento[],
  eventosSemanaAnterior: Evento[],
  ahora: Date,
): ResumenCoordinador {
  const nuevosSponsorsEmpresas = nuevosSponsorsDe(eventosSemanaActual);
  const empresasTrabadas = construirEmpresasTrabadas(filas, ahora);

  return {
    club,
    contactosNuevos: contar(eventosSemanaActual, 'ALTA'),
    contactosNuevosSemanaAnterior: contar(eventosSemanaAnterior, 'ALTA'),
    reunionesHechas: contar(eventosSemanaActual, 'POST_REUNION'),
    reunionesHechasSemanaAnterior: contar(eventosSemanaAnterior, 'POST_REUNION'),
    nuevosSponsorsEmpresas,
    nuevosSponsors: nuevosSponsorsEmpresas.length,
    embudo: construirEmbudo(filas),
    empresasTrabadas,
    actividadPorFr: construirActividadPorFr(eventosSemanaActual),
    recomendaciones: construirRecomendaciones(empresasTrabadas, filas, ahora),
  };
}

export interface ResumenCodis {
  porClub: Array<{ club: Club; contactos: number; reuniones: number; sponsors: number; trabadas: number }>;
  clubesConMenosActividad: Club[];
  nuevosSponsors: Array<{ club: Club; empresa: string }>;
}

export function construirResumenCodis(resumenesPorClub: ResumenCoordinador[]): ResumenCodis {
  return {
    porClub: resumenesPorClub.map((r) => ({
      club: r.club,
      contactos: r.contactosNuevos,
      reuniones: r.reunionesHechas,
      sponsors: r.nuevosSponsors,
      trabadas: r.empresasTrabadas.length,
    })),
    clubesConMenosActividad: resumenesPorClub
      .filter((r) => r.contactosNuevos + r.reunionesHechas < r.contactosNuevosSemanaAnterior + r.reunionesHechasSemanaAnterior)
      .map((r) => r.club),
    nuevosSponsors: resumenesPorClub.flatMap((r) => r.nuevosSponsorsEmpresas.map((empresa) => ({ club: r.club, empresa }))),
  };
}

export function formatearResumenCoordinador(r: ResumenCoordinador): string {
  const lineas: string[] = [
    `Resumen semanal — ${r.club}`,
    `Contactos nuevos: ${r.contactosNuevos} (semana anterior: ${r.contactosNuevosSemanaAnterior})`,
    `Reuniones hechas: ${r.reunionesHechas} (semana anterior: ${r.reunionesHechasSemanaAnterior})`,
    `Nuevos sponsors: ${r.nuevosSponsors}${r.nuevosSponsorsEmpresas.length > 0 ? ' — ' + r.nuevosSponsorsEmpresas.join(', ') : ''}`,
    `Embudo: ${Object.entries(r.embudo).map(([estado, cantidad]) => `${estado}: ${cantidad}`).join(', ')}`,
  ];
  if (r.empresasTrabadas.length > 0) {
    lineas.push('Empresas trabadas:');
    r.empresasTrabadas.forEach((t) => lineas.push(`- ${t.empresa} (${t.fr}): ${t.motivo}`));
  }
  if (r.actividadPorFr.length > 0) {
    lineas.push('Post-reuniones cargadas esta semana:');
    r.actividadPorFr.forEach((a) => lineas.push(`- ${a.fr}: ${a.postReunionesCargadas}`));
  }
  if (r.recomendaciones.length > 0) {
    lineas.push('Recomendaciones:');
    r.recomendaciones.forEach((rec) => lineas.push(`- ${rec}`));
  }
  return lineas.join('\n');
}

export function formatearResumenCodis(r: ResumenCodis): string {
  const lineas: string[] = ['Resumen semanal — consolidado de los 5 clubes'];
  r.porClub.forEach((c) =>
    lineas.push(`- ${c.club}: ${c.contactos} contactos, ${c.reuniones} reuniones, ${c.sponsors} sponsors, ${c.trabadas} trabadas`),
  );
  if (r.clubesConMenosActividad.length > 0) {
    lineas.push(`Clubes con menos actividad que la semana anterior: ${r.clubesConMenosActividad.join(', ')}`);
  }
  if (r.nuevosSponsors.length > 0) {
    lineas.push(`Nuevos sponsors de la semana: ${r.nuevosSponsors.map((s) => `${s.empresa} (${s.club})`).join(', ')}`);
  }
  return lineas.join('\n');
}
