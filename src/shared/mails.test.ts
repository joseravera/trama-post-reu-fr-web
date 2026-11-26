import { agregarMails, unirMails, validarListaMails } from './mails';

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
