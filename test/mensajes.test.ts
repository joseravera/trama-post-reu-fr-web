import { conMensajeClaro, ErrorParaUsuario, MENSAJE_INESPERADO, mensajeParaUsuario } from '../src/app/mensajes';

describe('mensajeParaUsuario', () => {
  it('los mensajes pensados para el usuario pasan tal cual', () => {
    expect(mensajeParaUsuario(new ErrorParaUsuario('Falta la empresa.'))).toBe('Falta la empresa.');
  });

  it('falta de permisos de Google (el caso de la vista previa del mail)', () => {
    const e = new Error(
      'Los permisos especificados no son suficientes para llamar a DocumentApp.openById. Permisos necesarios: https://www.googleapis.com/auth/documents',
    );
    expect(mensajeParaUsuario(e)).toBe('La app no tiene los permisos de Google que necesita para esto. Avisale al equipo para que lo revise.');
  });

  it('cuota de Apps Script, CRM bloqueado y transición inválida', () => {
    expect(mensajeParaUsuario(new Error('Service invoked too many times for one day: gmail.'))).toMatch(/Google limitó el uso/);
    expect(mensajeParaUsuario(new Error('Lock timeout: another process was holding the lock for too long.'))).toMatch(/Alguien más está actualizando el CRM/);
    expect(mensajeParaUsuario(new Error('Transición inválida: "Mail enviado" -> "Va a ser sponsor"'))).toBe(
      'No se puede pasar la empresa de "Mail enviado" a "Va a ser sponsor".',
    );
  });

  it('errores de configuración del CRM no muestran detalles internos', () => {
    expect(mensajeParaUsuario(new Error('No existe la hoja de sistema "_Clubes" (¿falta crearla? ver sección 6, B1)'))).toMatch(
      /configuración del CRM.*Avisale al equipo/,
    );
  });

  it('errores de JavaScript o con JSON se reemplazan por un mensaje genérico', () => {
    expect(mensajeParaUsuario(new TypeError("Cannot read properties of undefined (reading 'getRange')"))).toBe(MENSAJE_INESPERADO);
    expect(mensajeParaUsuario(new Error('{"error":{"code":500}}'))).toBe(MENSAJE_INESPERADO);
  });

  it('los mensajes en español de los otros módulos pasan tal cual', () => {
    expect(mensajeParaUsuario(new Error('No se encontró la empresa "Acme 500" en la hoja "Agro"'))).toBe(
      'No se encontró la empresa "Acme 500" en la hoja "Agro"',
    );
  });
});

describe('conMensajeClaro', () => {
  it('si la función falla, tira un mensaje claro y deja el detalle en el log', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = conMensajeClaro('prueba', () => {
      throw new TypeError('x is not a function');
    });
    expect(f).toThrow(MENSAJE_INESPERADO);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('x is not a function'));
    log.mockRestore();
  });

  it('si no falla, devuelve el resultado', () => {
    expect(conMensajeClaro('prueba', (a: number, b: number) => a + b)(2, 3)).toBe(5);
  });
});
