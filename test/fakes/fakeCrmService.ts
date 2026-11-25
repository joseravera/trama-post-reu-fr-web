// Fake de CrmService en memoria, para que A y C desarrollen/testeen sin esperar al B2 real.
// Implementa la máquina de estados real (crm/maquinaEstados.ts) para que el fake se comporte
// igual que el servicio final.

import { transicionValida as transicionValidaReal } from '../../src/crm/maquinaEstados';
import type {
  Club,
  CrmService,
  Estado,
  Evento,
  FilaCRM,
  PostReunionConfirmado,
  Usuario,
} from '../../src/shared/types';

export function crearFakeCrmService(filasIniciales: FilaCRM[] = []): CrmService {
  const filas = new Map<string, FilaCRM>(filasIniciales.map((f) => [`${f.club}|${f.empresa}`, f]));
  const eventos: Evento[] = [];

  const clave = (club: Club, empresa: string) => `${club}|${empresa}`;

  return {
    buscarEmpresas(club, texto) {
      const t = texto.toLowerCase();
      return [...filas.values()]
        .filter((f) => f.club === club && f.empresa.toLowerCase().includes(t))
        .map((f) => f.empresa);
    },
    getFila(club, empresa) {
      return filas.get(clave(club, empresa)) ?? null;
    },
    listarFilas(club) {
      return [...filas.values()].filter((f) => f.club === club);
    },
    aplicarPostReunion(p: PostReunionConfirmado, fr: Usuario): FilaCRM {
      const k = clave(p.club, p.empresa);
      const existente = filas.get(k);
      const fila: FilaCRM = {
        club: p.club,
        empresa: p.empresa,
        trameroEncargado: existente?.trameroEncargado ?? fr.nombre,
        persona: p.datos.persona ?? existente?.persona,
        rolPersona: p.datos.rolPersona ?? existente?.rolPersona,
        mail: p.datos.mail ?? existente?.mail,
        telefono: p.datos.telefono ?? existente?.telefono,
        linkedin: p.datos.linkedin ?? existente?.linkedin,
        estado: p.datos.estadoSugerido,
        comentarios: p.datos.comentarios,
        fechaPrimerContacto: existente?.fechaPrimerContacto ?? p.fechaReunion,
        fechaUltimoContacto: p.fechaReunion,
        canal: existente?.canal,
        proximaAccion: p.datos.proximaAccion ?? existente?.proximaAccion,
        fechaProximaAccion: p.datos.fechaProximaAccion
          ? new Date(p.datos.fechaProximaAccion)
          : existente?.fechaProximaAccion,
        pingueosSinRespuesta: 0,
      };
      filas.set(k, fila);
      eventos.push({
        timestamp: p.fechaReunion,
        club: p.club,
        empresa: p.empresa,
        fr: fr.nombre,
        tipo: 'POST_REUNION',
        estadoAnterior: existente?.estado,
        estadoNuevo: fila.estado,
        origen: 'UI',
      });
      return fila;
    },
    registrarPingueo(club, empresa, fr) {
      const fila = filas.get(clave(club, empresa));
      if (!fila) throw new Error('Empresa no encontrada');
      fila.pingueosSinRespuesta += 1;
      eventos.push({ timestamp: new Date(), club, empresa, fr: fr.nombre, tipo: 'PINGUEO', origen: 'UI' });
      return fila;
    },
    registrarRespuesta(club, empresa, fr, origen = 'UI') {
      const fila = filas.get(clave(club, empresa));
      if (!fila) throw new Error('Empresa no encontrada');
      fila.pingueosSinRespuesta = 0;
      if (fila.estado === 'Mail enviado') fila.estado = 'Mail respondido';
      eventos.push({ timestamp: new Date(), club, empresa, fr: fr.nombre, tipo: 'RESPUESTA', origen });
      return fila;
    },
    cambiarEstado(club, empresa, nuevo: Estado, fr) {
      const fila = filas.get(clave(club, empresa));
      if (!fila) throw new Error('Empresa no encontrada');
      if (!transicionValidaReal(fila.estado, nuevo)) throw new Error(`Transición inválida: ${fila.estado} -> ${nuevo}`);
      const anterior = fila.estado;
      fila.estado = nuevo;
      eventos.push({
        timestamp: new Date(),
        club,
        empresa,
        fr: fr.nombre,
        tipo: 'CAMBIO_ESTADO',
        estadoAnterior: anterior,
        estadoNuevo: nuevo,
        origen: 'UI',
      });
      return fila;
    },
    registrarReunionCoordinada(club, empresa, fechaEvento, fr) {
      const fila = filas.get(clave(club, empresa));
      if (!fila) throw new Error('Empresa no encontrada');
      const yaCoordinada = fila.estado === 'Reunión coordinada';
      if (!yaCoordinada && !transicionValidaReal(fila.estado, 'Reunión coordinada')) return fila;
      const anterior = fila.estado;
      fila.estado = 'Reunión coordinada';
      fila.proximaAccion = 'Reunión';
      fila.fechaProximaAccion = fechaEvento;
      fila.fechaUltimoContacto = new Date();
      if (!yaCoordinada) {
        eventos.push({
          timestamp: new Date(),
          club,
          empresa,
          fr: fr.nombre,
          tipo: 'CAMBIO_ESTADO',
          estadoAnterior: anterior,
          estadoNuevo: 'Reunión coordinada',
          origen: 'CALENDAR',
        });
      }
      return fila;
    },
    transicionValida(desde, hacia) {
      return transicionValidaReal(desde, hacia);
    },
    getEventos(desde, hasta, club) {
      return eventos.filter(
        (e) => e.timestamp >= desde && e.timestamp <= hasta && (club === undefined || e.club === club),
      );
    },
  };
}
