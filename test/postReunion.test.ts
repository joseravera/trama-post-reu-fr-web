import { confirmarPostReunion, reintentarBorrador } from '../src/app/postReunion';
import { crearFakeCrmService } from './fakes/fakeCrmService';
import { crearFakeMailService } from './fakes/fakeMailService';
import type { CrmService, MailService, PostReunionConfirmado, Usuario } from '../src/shared/types';

const fr: Usuario = { mail: 'fr@trama.org', nombre: 'Juana Pérez', club: 'Agro', rol: 'FR' };

const p: PostReunionConfirmado = {
  club: 'Agro',
  empresa: 'AgroTech SA',
  fechaReunion: new Date('2026-11-18T10:00:00-03:00'),
  datos: {
    persona: 'Martina',
    rolPersona: 'Marketing',
    mail: 'martina@agrotech.com',
    telefono: null,
    linkedin: null,
    compromisosEmpresa: ['Mandan propuesta antes del 5/12'],
    compromisosTrama: [],
    parrafoCompromisos: 'Quedamos en que nos envían la propuesta antes del 5/12.',
    estadoSugerido: 'Tratativas',
    comentarios: 'Reunión con Martina (Mkt). Interesados en sponsorear el BootCamp.',
    proximaAccion: 'Esperar propuesta',
    fechaProximaAccion: '2026-12-05',
    camposFaltantes: [],
  },
  adjuntosExtra: [],
};

describe('confirmarPostReunion (con fakes, sin esperar a los servicios reales)', () => {
  it('crea la fila en el CRM y el borrador, y devuelve los links', () => {
    const crm = crearFakeCrmService();
    const resultado = confirmarPostReunion(p, fr, crm, crearFakeMailService());
    expect(resultado.ok).toBe(true);
    expect(resultado.borradorUrl).toContain('AgroTech SA');
    expect(resultado.filaUrl).toContain('docs.google.com/spreadsheets');
    expect(crm.getFila('Agro', 'AgroTech SA')?.estado).toBe('Tratativas');
  });

  it('si falla el CRM no se crea el borrador', () => {
    const crm: CrmService = { ...crearFakeCrmService(), aplicarPostReunion: () => { throw new Error('hoja bloqueada'); } };
    const mail = crearFakeMailService();
    const spy = jest.spyOn(mail, 'crearBorrador');
    expect(confirmarPostReunion(p, fr, crm, mail)).toMatchObject({ ok: false, fallo: 'CRM' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('si falla el borrador después del CRM, se informa y se reintenta solo el borrador', () => {
    const crm = crearFakeCrmService();
    const roto: MailService = { ...crearFakeMailService(), crearBorrador: () => { throw new Error('cuota de Gmail'); } };
    const r = confirmarPostReunion(p, fr, crm, roto);
    expect(r).toMatchObject({ ok: false, fallo: 'BORRADOR' });
    expect(crm.getFila('Agro', 'AgroTech SA')).not.toBeNull();

    const aplicar = jest.spyOn(crm, 'aplicarPostReunion');
    expect(reintentarBorrador(p, fr, crearFakeMailService()).ok).toBe(true);
    expect(aplicar).not.toHaveBeenCalled();
  });
});
