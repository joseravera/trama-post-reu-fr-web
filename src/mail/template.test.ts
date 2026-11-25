import { reemplazarPlaceholders, reemplazarPlaceholdersPingueo, validarTemplate, validarTemplatePingueo } from './template';

const HTML_BASE =
  '<p>Hola @PERSONA,</p>' +
  '<p>Gracias por recibirnos @FECHA_REUNION en representación de @NOMBRE EMPRESA.</p>' +
  '<p>@COMPROMISOS</p>' +
  '<p>Saludos, Trama ITBA</p>';

describe('reemplazarPlaceholders', () => {
  it('reemplaza los 4 placeholders cuando hay compromisos', () => {
    const resultado = reemplazarPlaceholders(HTML_BASE, {
      persona: 'Martina',
      nombreEmpresa: 'Acme S.A.',
      fechaReunion: 'de hoy',
      compromisos: 'Nos comprometimos a mandarles la propuesta antes del 5/12.',
    });
    expect(resultado).toContain('Hola Martina,');
    expect(resultado).toContain('de hoy en representación de Acme S.A.');
    expect(resultado).toContain('Nos comprometimos a mandarles la propuesta antes del 5/12.');
    expect(resultado).not.toContain('@');
  });

  it('borra el párrafo entero de @COMPROMISOS cuando compromisos es null', () => {
    const resultado = reemplazarPlaceholders(HTML_BASE, {
      persona: 'Martina',
      nombreEmpresa: 'Acme S.A.',
      fechaReunion: 'de hoy',
      compromisos: null,
    });
    expect(resultado).not.toContain('@COMPROMISOS');
    expect(resultado).not.toContain('<p></p>');
    expect(resultado).toContain('Hola Martina,');
    expect(resultado).toContain('Saludos, Trama ITBA');
  });

  it('borra el <li> entero cuando @COMPROMISOS está en una viñeta', () => {
    const html = '<ul><li>Antes: @COMPROMISOS</li><li>Otro punto</li></ul>';
    const resultado = reemplazarPlaceholders(html, {
      persona: 'Martina',
      nombreEmpresa: 'Acme',
      fechaReunion: 'de hoy',
      compromisos: null,
    });
    expect(resultado).toBe('<ul><li>Otro punto</li></ul>');
  });

  it('escapa HTML en los valores insertados', () => {
    const resultado = reemplazarPlaceholders('<p>@PERSONA</p>', {
      persona: 'Juan & Cía <socia>',
      nombreEmpresa: 'Acme',
      fechaReunion: 'de hoy',
      compromisos: null,
    });
    expect(resultado).toContain('Juan &amp; Cía &lt;socia&gt;');
  });
});

describe('validarTemplate', () => {
  it('no tira error si están los 4 placeholders', () => {
    expect(() => validarTemplate(HTML_BASE, 'Agro')).not.toThrow();
  });

  it('tira un error claro si falta un placeholder obligatorio', () => {
    expect(() => validarTemplate('<p>Hola @PERSONA</p>', 'Agro')).toThrow(/Agro/);
  });
});

describe('reemplazarPlaceholdersPingueo', () => {
  it('reemplaza @PERSONA y @NOMBRE EMPRESA', () => {
    const resultado = reemplazarPlaceholdersPingueo('<p>Hola @PERSONA, pingueo a @NOMBRE EMPRESA.</p>', {
      persona: 'Martina',
      nombreEmpresa: 'Acme S.A.',
    });
    expect(resultado).toBe('<p>Hola Martina, pingueo a Acme S.A..</p>');
  });

  it('deja un string vacío si no hay persona, sin romper el mail', () => {
    const resultado = reemplazarPlaceholdersPingueo('<p>Hola @PERSONA,</p>', { persona: '', nombreEmpresa: 'Acme' });
    expect(resultado).toBe('<p>Hola ,</p>');
  });
});

describe('validarTemplatePingueo', () => {
  it('no tira error si está @NOMBRE EMPRESA', () => {
    expect(() => validarTemplatePingueo('<p>Hola @NOMBRE EMPRESA</p>', 'Agro')).not.toThrow();
  });

  it('tira un error claro si falta @NOMBRE EMPRESA', () => {
    expect(() => validarTemplatePingueo('<p>Hola @PERSONA</p>', 'Agro')).toThrow(/Agro/);
  });
});
