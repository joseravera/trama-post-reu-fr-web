import { agregarMails, crearEsDeLaEmpresa, dominiosEmpresa, esMailAutomatico, unirMails, validarListaMails } from './mails';

describe('validarListaMails', () => {
  it('acepta uno o varios mails con cualquier separador', () => {
    expect(validarListaMails('a@b.com')).toBe(true);
    expect(validarListaMails('a@b.com, c@d.com')).toBe(true);
    expect(validarListaMails('a@b.com;c@d.com / e@f.com')).toBe(true);
    expect(validarListaMails(null)).toBe(true);
  });

  it('rechaza si alguno no es un mail', () => {
    expect(validarListaMails('sin-arroba')).toBe(false);
    expect(validarListaMails('a@b.com, Juan')).toBe(false);
    expect(validarListaMails('')).toBe(false);
  });
});

describe('unirMails', () => {
  it('junta, limpia y no repite', () => {
    expect(unirMails('josefina.schaer@despegar.com,\nmaria.cid@despegar.com', 'MARIA.CID@despegar.com')).toBe(
      'josefina.schaer@despegar.com, maria.cid@despegar.com',
    );
    expect(unirMails(null, undefined, 'Contacto joaco')).toBeNull();
  });
});

describe('agregarMails', () => {
  it('suma los mails nuevos sin borrar los que había', () => {
    expect(agregarMails('aferrara@pampa.com, asottile@pampa.com', 'nuevo@pampa.com')).toBe(
      'aferrara@pampa.com, asottile@pampa.com, nuevo@pampa.com',
    );
  });

  it('no duplica y conserva el texto que no es mail', () => {
    expect(agregarMails('a@x.com; b@x.com', 'b@x.com, a@x.com')).toBe('a@x.com; b@x.com');
    expect(agregarMails('Contacto joaco', 'joaco@x.com')).toBe('Contacto joaco, joaco@x.com');
    expect(agregarMails(undefined, 'a@x.com')).toBe('a@x.com');
    expect(agregarMails(undefined, null)).toBeNull();
  });
});

describe('dominios de la empresa', () => {
  it('saca los dominios propios y descarta los genéricos', () => {
    expect(dominiosEmpresa(['maria.cid@despegar.com', 'x@despegar.com', 'alguien@gmail.com'])).toEqual(['despegar.com']);
    expect(dominiosEmpresa(['gustavozayat@gmail.com'])).toEqual([]);
  });

  it('reconoce direcciones automáticas', () => {
    expect(esMailAutomatico('no-reply@despegar.com')).toBe(true);
    expect(esMailAutomatico('noreply@x.com')).toBe(true);
    expect(esMailAutomatico('notifications@x.com')).toBe(true);
    expect(esMailAutomatico('maria.cid@despegar.com')).toBe(false);
    expect(esMailAutomatico('noemi@x.com')).toBe(false);
  });

  it('una persona nueva del mismo dominio cuenta como de la empresa; Gmail genérico no', () => {
    const esDespegar = crearEsDeLaEmpresa(['maria.cid@despegar.com']);
    expect(esDespegar('orianaabrego@despegar.com')).toBe(true);
    expect(esDespegar('ORIANAABREGO@DESPEGAR.COM')).toBe(true);
    expect(esDespegar('no-reply@despegar.com')).toBe(false);
    expect(esDespegar('otro@tecpetrol.com')).toBe(false);

    const esChevron = crearEsDeLaEmpresa(['gustavozayat@gmail.com']);
    expect(esChevron('gustavozayat@gmail.com')).toBe(true);
    expect(esChevron('cualquiera@gmail.com')).toBe(false);
  });

  it('nunca toma como de la empresa a alguien de Trama', () => {
    const es = crearEsDeLaEmpresa(['a@empresa.com'], ['coordi@empresa.com']);
    expect(es('coordi@empresa.com')).toBe(false);
  });
});
