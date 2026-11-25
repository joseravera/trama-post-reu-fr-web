import { construirMailsAAgendar } from './notificadorMail';
import { esc, layoutMail, tarjetaAgenda, tarjetaResumenCodis, tarjetaResumenCoordinador } from './plantillaMail';
import type { ResumenCoordinador } from './resumenes';
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

const RESUMEN: ResumenCoordinador = {
  club: 'Consultoría',
  contactosNuevos: 6,
  contactosNuevosSemanaAnterior: 4,
  reunionesHechas: 3,
  reunionesHechasSemanaAnterior: 5,
  nuevosSponsorsEmpresas: ['Accenture'],
  nuevosSponsors: 1,
  embudo: {
    'Mail enviado': 12,
    'Mail respondido': 4,
    'Reunión coordinada': 3,
    'Tuvimos reunión, esperando respuesta': 2,
    Tratativas: 2,
    'Va a ser sponsor': 1,
    'No va a ser sponsor': 3,
  },
  empresasTrabadas: [{ empresa: 'Deloitte <SA>', fr: 'Tomás', motivo: '2 pingueos sin respuesta' }],
  actividadPorFr: [{ fr: 'Lucía', postReunionesCargadas: 2 }],
  recomendaciones: ['Lucía tiene 1 seguimiento vencido.'],
};

describe('plantillaMail', () => {
  it('escapa el texto que viene del CRM', () => {
    expect(esc('<b>"A & B"</b>')).toBe('&lt;b&gt;&quot;A &amp; B&quot;&lt;/b&gt;');
    const html = tarjetaAgenda(['Pingueá a <script>x</script>'], [], 'Agro', null).html;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('el layout usa el color y el nombre del club, el logo en línea y el pie de Trama', () => {
    const html = layoutMail('Finanzas y Tecnología', [{ html: 'contenido' }]);
    expect(html).toContain('#00C1B0');
    expect(html).toContain('Finanzas y Tecnología');
    expect(html).toContain('src="cid:logo"');
    expect(html).toContain('contenido');
    expect(html).toContain('Trama ITBA · Fundraising');
  });

  it('sin club (codirectoras) usa el violeta de Trama', () => {
    expect(layoutMail(null, [])).toContain('#8865DD');
  });

  it('la agenda separa vencido de lo que viene y muestra el botón solo si hay URL', () => {
    const con = tarjetaAgenda(['vencido A'], ['próximo B'], 'Consultoría', 'https://script.google.com/app').html;
    expect(con.indexOf('Vencido')).toBeLessThan(con.indexOf('vencido A'));
    expect(con.indexOf('vencido A')).toBeLessThan(con.indexOf('Hasta el próximo envío'));
    expect(con).toContain('href="https://script.google.com/app"');
    expect(tarjetaAgenda(['vencido A'], [], 'Consultoría', null).html).not.toContain('<a ');
  });

  it('el resumen del coordinador trae números, embudo, trabadas y recomendaciones', () => {
    const html = tarjetaResumenCoordinador(RESUMEN).html;
    expect(html).toContain('semana anterior: 4');
    expect(html).toContain('Accenture');
    expect(html).toContain('Tratativas · 2');
    expect(html).toContain('Deloitte &lt;SA&gt;');
    expect(html).toContain('Lucía tiene 1 seguimiento vencido.');
  });

  it('el resumen de codirectoras tiene una fila por club con su color', () => {
    const html = tarjetaResumenCodis({
      porClub: [{ club: 'Agro', contactos: 2, reuniones: 1, sponsors: 0, trabadas: 3 }],
      clubesConMenosActividad: ['Agro'],
      nuevosSponsors: [{ club: 'Agro', empresa: 'Campo Verde' }],
    }).html;
    expect(html).toContain('#FED201');
    expect(html).toContain('Menos actividad que la semana anterior');
    expect(html).toContain('Campo Verde (Agro)');
  });
});

describe('construirMailsAAgendar — HTML', () => {
  it('cada mail lleva HTML además del texto plano', () => {
    const [mail] = construirMailsAAgendar([aviso({ texto: 'Pingueá a Acme' })], AHORA, { urlApp: 'https://app' });
    expect(mail?.cuerpo).toContain('Pingueá a Acme');
    expect(mail?.html).toContain('Pingueá a Acme');
    expect(mail?.html).toContain('#FED201'); // color de Agro
    expect(mail?.html).toContain('href="https://app"');
  });

  it('usa la tarjeta del resumen si la mandó el scheduler y, si no, el texto', () => {
    const resumen = aviso({
      clave: 'RESUMEN_COORDINADOR|Agro|_|2026-11-23',
      tipo: 'RESUMEN_COORDINADOR',
      destinatarios: ['coordi@trama.org'],
      texto: 'Resumen de Agro\nlínea 2',
    });
    const [conTarjeta] = construirMailsAAgendar([resumen], AHORA, {
      tarjetasResumen: new Map([[resumen.clave, { html: 'TARJETA-RESUMEN' }]]),
    });
    expect(conTarjeta?.html).toContain('TARJETA-RESUMEN');

    const [sinTarjeta] = construirMailsAAgendar([resumen], AHORA);
    expect(sinTarjeta?.html).toContain('Resumen de Agro<br>línea 2');
  });

  it('el mail de escalamientos va con la tarjeta negra de empresas trabadas', () => {
    const [mail] = construirMailsAAgendar(
      [aviso({ clave: 'ESCALAMIENTO|Agro|A|2026-11-22', tipo: 'ESCALAMIENTO', destinatarios: ['coordi@trama.org'], texto: 'A está trabada' })],
      AHORA,
    );
    expect(mail?.html).toContain('trabadas');
    expect(mail?.html).toContain('A está trabada');
    expect(mail?.html).toContain('background:#212121');
  });
});
