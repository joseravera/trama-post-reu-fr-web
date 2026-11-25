import { construirMailsAAgendar } from './notificadorMail';
import type { Aviso } from '../shared/types';

const AHORA = new Date('2026-11-25T09:00:00-03:00'); // miércoles

function aviso(overrides: Partial<Aviso>): Aviso {
  return {
    clave: 'PINGUEAR|Agro|Acme|2026-11-25',
    tipo: 'PINGUEAR',
    destinatarios: ['juan@trama.org'],
    club: 'Agro',
    empresa: 'Acme',
    texto: 'texto',
    ...overrides,
  };
}

describe('construirMailsAAgendar — agenda del FR', () => {
  it('junta todos los pendientes de un mismo FR en un único mail', () => {
    const avisos = [
      aviso({ clave: 'PINGUEAR|Agro|A|2026-11-23', texto: 'Pingueá a A' }),
      aviso({ clave: 'SEGUIMIENTO_VENCIDO|Agro|B|2026-11-26', tipo: 'SEGUIMIENTO_VENCIDO', texto: 'Seguí a B' }),
    ];
    const mails = construirMailsAAgendar(avisos, AHORA);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.destinatarios).toEqual(['juan@trama.org']);
    expect(mails[0]?.cuerpo).toContain('Pingueá a A');
    expect(mails[0]?.cuerpo).toContain('Seguí a B');
  });

  it('separa vencidos de próximos y los cuenta en el asunto', () => {
    const avisos = [
      aviso({ clave: 'PINGUEAR|Agro|A|2026-11-20', texto: 'vencido A' }), // hace 5 días
      aviso({ clave: 'PINGUEAR|Agro|B|2026-11-26', texto: 'próximo B' }), // mañana
      aviso({ clave: 'PINGUEAR|Agro|C|2026-11-27', texto: 'próximo C' }), // en 2 días
    ];
    const [mail] = construirMailsAAgendar(avisos, AHORA);
    expect(mail?.asunto).toBe('[Trama FR] Tu agenda: 1 vencidos, 2 para esta semana');
    expect(mail?.cuerpo.indexOf('vencido A')).toBeLessThan(mail!.cuerpo.indexOf('próximo B'));
  });

  it('ordena de más viejo a más nuevo dentro de cada sección', () => {
    const avisos = [
      aviso({ clave: 'PINGUEAR|Agro|A|2026-11-15', texto: 'el más viejo' }),
      aviso({ clave: 'PINGUEAR|Agro|B|2026-11-20', texto: 'el más nuevo' }),
    ];
    const [mail] = construirMailsAAgendar(avisos, AHORA);
    expect(mail?.cuerpo.indexOf('el más viejo')).toBeLessThan(mail!.cuerpo.indexOf('el más nuevo'));
  });

  it('no genera ningún mail si no hay avisos', () => {
    expect(construirMailsAAgendar([], AHORA)).toHaveLength(0);
  });

  it('incluye el resumen semanal (RESUMEN_CODIS) en el mail de la codirectora, sin agenda', () => {
    const avisos = [
      aviso({
        clave: 'RESUMEN_CODIS|_|_|2026-11-23',
        tipo: 'RESUMEN_CODIS',
        club: undefined,
        empresa: undefined,
        destinatarios: ['codi@trama.org'],
        texto: 'Resumen de la semana para codis',
      }),
    ];
    const [mail] = construirMailsAAgendar(avisos, AHORA);
    expect(mail?.destinatarios).toEqual(['codi@trama.org']);
    expect(mail?.asunto).toBe('[Trama FR] Resumen semanal');
    expect(mail?.cuerpo).toContain('Resumen de la semana para codis');
  });
});

describe('construirMailsAAgendar — escalamientos por club', () => {
  it('agrupa los escalamientos de un club en un solo mail con todos los destinatarios', () => {
    const avisos = [
      aviso({
        clave: 'ESCALAMIENTO|Agro|A|2026-11-22',
        tipo: 'ESCALAMIENTO',
        destinatarios: ['coordi@trama.org', 'juan@trama.org'],
        texto: 'A está trabada',
      }),
      aviso({
        clave: 'ESCALAMIENTO|Agro|B|2026-11-23',
        tipo: 'ESCALAMIENTO',
        destinatarios: ['coordi@trama.org', 'martina@trama.org'],
        texto: 'B está trabada',
      }),
    ];
    const mails = construirMailsAAgendar(avisos, AHORA);
    expect(mails).toHaveLength(1);
    expect(mails[0]?.destinatarios.sort()).toEqual(['coordi@trama.org', 'juan@trama.org', 'martina@trama.org']);
    expect(mails[0]?.asunto).toBe('[Trama FR] Escalamientos — Agro');
    expect(mails[0]?.cuerpo).toContain('A está trabada');
    expect(mails[0]?.cuerpo).toContain('B está trabada');
  });

  it('si no hay escalamientos pero sí resumen de coordinador, el asunto es de resumen', () => {
    const avisos = [
      aviso({
        clave: 'RESUMEN_COORDINADOR|Agro|_|2026-11-23',
        tipo: 'RESUMEN_COORDINADOR',
        destinatarios: ['coordi@trama.org'],
        texto: 'Resumen de Agro',
      }),
    ];
    const [mail] = construirMailsAAgendar(avisos, AHORA);
    expect(mail?.asunto).toBe('[Trama FR] Resumen semanal — Agro');
  });

  it('cuando coinciden escalamiento y resumen del mismo club, van en mails separados y el FR en copia del escalamiento no ve el resumen', () => {
    const avisos = [
      aviso({
        clave: 'ESCALAMIENTO|Agro|A|2026-11-22',
        tipo: 'ESCALAMIENTO',
        destinatarios: ['coordi@trama.org', 'juan@trama.org'],
        texto: 'A está trabada',
      }),
      aviso({
        clave: 'RESUMEN_COORDINADOR|Agro|_|2026-11-23',
        tipo: 'RESUMEN_COORDINADOR',
        destinatarios: ['coordi@trama.org'],
        texto: 'Resumen de Agro',
      }),
    ];
    const mails = construirMailsAAgendar(avisos, AHORA);
    expect(mails).toHaveLength(2);

    const escalamiento = mails.find((m) => m.asunto.includes('Escalamientos'));
    const resumen = mails.find((m) => m.asunto.includes('Resumen semanal'));

    expect(escalamiento?.destinatarios.sort()).toEqual(['coordi@trama.org', 'juan@trama.org']);
    expect(escalamiento?.cuerpo).not.toContain('Resumen de Agro');

    expect(resumen?.destinatarios).toEqual(['coordi@trama.org']);
    expect(resumen?.cuerpo).not.toContain('está trabada');
  });
});
