import { consultaEnviosA, consultaRespuestas, esPosterior, evaluarTraspaso, extraerMails, ultimaFecha } from './mailsContacto';

describe('extraerMails', () => {
  it('saca todas las direcciones con cualquier separador', () => {
    expect(extraerMails('aferrara@pampa.com, asottile@pampa.com')).toEqual(['aferrara@pampa.com', 'asottile@pampa.com']);
    expect(extraerMails('mariano.vicetto@bsci.com; Daniela.Carranza@bsci.com')).toEqual(['mariano.vicetto@bsci.com', 'daniela.carranza@bsci.com']);
    expect(extraerMails('mercedes.esposito@globant.com / nataly.buritica@globant.com, mariacamila.rojas@globant.com')).toHaveLength(3);
    expect(extraerMails('josefina.schaer@despegar.com,\nmaria.cid@despegar.com')).toEqual(['josefina.schaer@despegar.com', 'maria.cid@despegar.com']);
  });

  it('devuelve vacío si no hay mails y no repite', () => {
    expect(extraerMails('')).toEqual([]);
    expect(extraerMails(undefined)).toEqual([]);
    expect(extraerMails('Contacto joaco')).toEqual([]);
    expect(extraerMails('a@b.com a@b.com A@B.COM')).toEqual(['a@b.com']);
  });
});

describe('consultaRespuestas', () => {
  it('arma un from: simple o con OR', () => {
    expect(consultaRespuestas(['a@b.com'], 2)).toBe('from:a@b.com newer_than:2d');
    expect(consultaRespuestas(['a@b.com', 'c@d.com'], 2)).toBe('from:(a@b.com OR c@d.com) newer_than:2d');
  });

  it('null si no hay mails', () => {
    expect(consultaRespuestas([], 2)).toBeNull();
  });
});

describe('consultaEnviosA', () => {
  it('busca mails del encargado a la empresa en Para o CC', () => {
    expect(consultaEnviosA('mmejliker@itba.edu.ar', ['a@x.com', 'b@x.com'], 2)).toBe(
      'from:mmejliker@itba.edu.ar {to:a@x.com cc:a@x.com to:b@x.com cc:b@x.com} newer_than:2d',
    );
    expect(consultaEnviosA('mmejliker@itba.edu.ar', [], 2)).toBeNull();
  });
});

describe('ultimaFecha', () => {
  const ENCARGADO = 'mmejliker@itba.edu.ar';
  const EMPRESA = ['maria.cid@despegar.com'];
  const m = (de: string, para: string, cc: string, iso: string) => ({ de, para, cc, fecha: new Date(iso) });

  it('toma el último mensaje del encargado a la empresa, ignorando los de otros', () => {
    const mensajes = [
      m('María Cid <maria.cid@despegar.com>', ENCARGADO, '', '2026-11-26T10:00:00Z'),
      m(`Martin Mejliker <${ENCARGADO}>`, 'maria.cid@despegar.com', 'jravera@itba.edu.ar', '2026-11-26T12:00:00Z'),
      m(`Martin Mejliker <${ENCARGADO}>`, 'otra@empresa.com', '', '2026-11-27T12:00:00Z'),
    ];
    expect(ultimaFecha(mensajes, [ENCARGADO], EMPRESA)?.toISOString()).toBe('2026-11-26T12:00:00.000Z');
  });

  it('cuenta si la empresa está solo en copia', () => {
    const mensajes = [m(ENCARGADO, 'otro@x.com', 'Maria <maria.cid@despegar.com>', '2026-11-26T12:00:00Z')];
    expect(ultimaFecha(mensajes, [ENCARGADO], EMPRESA)).not.toBeNull();
  });

  it('sin destinatarios, solo filtra por remitente (respuesta de la empresa)', () => {
    const mensajes = [
      m(`Martin Mejliker <${ENCARGADO}>`, 'maria.cid@despegar.com', '', '2026-11-26T12:00:00Z'),
      m('maria.cid@despegar.com', ENCARGADO, '', '2026-11-26T10:00:00Z'),
    ];
    expect(ultimaFecha(mensajes, EMPRESA)?.toISOString()).toBe('2026-11-26T10:00:00.000Z');
  });
});

describe('esPosterior', () => {
  it('pide al menos un minuto de diferencia y es true sin referencia', () => {
    const ref = new Date('2026-11-26T10:00:00Z');
    expect(esPosterior(new Date('2026-11-26T10:00:30Z'), ref)).toBe(false);
    expect(esPosterior(new Date('2026-11-26T10:05:00Z'), ref)).toBe(true);
    expect(esPosterior(new Date('2026-11-26T10:05:00Z'), undefined)).toBe(true);
  });
});

describe('evaluarTraspaso', () => {
  // Caso real (OCASA): la empresa respondió el 24/11 08:48, el encargado contestó el 25/11 08:00 y
  // el sync de la primera versión guardó "Fecha último contacto" = 25/11 15:48 (hora del sync).
  const respuestaOcasa = new Date('2026-11-24T11:48:02Z');
  const envioMartin = new Date('2026-11-25T11:00:00Z');
  const fechaUltimoContactoMal = new Date('2026-11-25T18:48:11Z');

  it('OCASA: el encargado contestó después de la empresa → Mail enviado (aunque la fecha del CRM sea posterior)', () => {
    expect(evaluarTraspaso(envioMartin, [respuestaOcasa], fechaUltimoContactoMal)).toEqual({ mailEnviado: true, respuestaPosterior: null });
  });

  it('TGS: la empresa volvió a escribir después del encargado → Mail enviado y después Mail respondido', () => {
    const tgs = [new Date('2026-11-24T11:28:01Z'), new Date('2026-11-25T11:27:41Z')];
    expect(evaluarTraspaso(envioMartin, tgs, fechaUltimoContactoMal)).toEqual({
      mailEnviado: true,
      respuestaPosterior: new Date('2026-11-25T11:27:41Z'),
    });
  });

  it('no cuenta si el encargado escribió antes de cualquier respuesta de la empresa', () => {
    expect(evaluarTraspaso(new Date('2026-11-24T10:00:00Z'), [respuestaOcasa], undefined).mailEnviado).toBe(false);
  });

  it('sin mails de la empresa a la vista, usa la fecha del CRM', () => {
    expect(evaluarTraspaso(envioMartin, [], new Date('2026-11-24T00:00:00Z')).mailEnviado).toBe(true);
    expect(evaluarTraspaso(envioMartin, [], fechaUltimoContactoMal).mailEnviado).toBe(false);
    expect(evaluarTraspaso(null, [respuestaOcasa], undefined).mailEnviado).toBe(false);
  });
});
