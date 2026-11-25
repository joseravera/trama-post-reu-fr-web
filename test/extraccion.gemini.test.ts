// Criterio de aceptación de A4 contra la API REAL de Gemini (sección 5, A4):
// "con 10 notas de prueba, ninguna extracción inventa un mail o teléfono que no esté en el texto;
// los campos faltantes quedan marcados". No corre con `npm test`; se corre a mano con:
//   PROBAR_GEMINI=1 GEMINI_API_KEY=... npx jest test/extraccion.gemini.test.ts
// Para probar otro modelo sin cambiar la app: GEMINI_MODEL=gemini-3.5-flash adelante.
//
// La capa gratuita de Gemini a veces responde 503 (modelo saturado) o 429 (límite por minuto). Por eso
// las llamadas van espaciadas y, ante esos errores, se espera y se reintenta. Si se agotó la cuota
// DIARIA, el test corta enseguida con un mensaje claro (reintentar solo gastaría tiempo).

import { transicionValida } from '../src/crm/maquinaEstados';
import { armarCuerpo, leerTexto, MODELO_GEMINI } from '../src/extraccion/gemini';
import { construirPrompt } from '../src/extraccion/prompt';
import { fechaDeDia, parsearExtraccion, validarExtraccion } from '../src/extraccion/validacion';
import type { FilaCRM } from '../src/shared/types';
import { NOTAS_PRUEBA } from './notas/notasPrueba';

// Tipos mínimos de Node (el proyecto no depende de @types/node).
declare const process: { env: Record<string, string | undefined> };
declare function fetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
): Promise<{ status: number; text(): Promise<string> }>;
declare function setTimeout(fn: () => void, ms: number): unknown;

const KEY = process.env.GEMINI_API_KEY;
const MODELO = process.env.GEMINI_MODEL || MODELO_GEMINI;
const PAUSA_ENTRE_NOTAS_MS = 6_000;
const ESPERAS_REINTENTO_MS = [15_000, 30_000, 60_000]; // hasta 3 reintentos por nota
const soloDigitos = (t: string) => t.replace(/\D/g, '');
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(() => r(), ms));

let cuotaDiariaAgotada = false;

async function llamarConReintentos(cuerpo: object): Promise<unknown> {
  for (let intento = 0; ; intento++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
      body: JSON.stringify(cuerpo),
    });
    const texto = await res.text();
    if (res.status === 200) return JSON.parse(texto);

    if (res.status === 429 && /per ?day/i.test(texto)) {
      cuotaDiariaAgotada = true;
      throw new Error('Se agotó la cuota DIARIA de la capa gratuita. Ver https://ai.dev/rate-limit');
    }
    const reintentable = res.status === 503 || res.status === 429;
    const espera = ESPERAS_REINTENTO_MS[intento];
    if (!reintentable || espera === undefined) {
      throw new Error(`Gemini respondió ${res.status} (después de ${intento} reintentos): ${texto.slice(0, 300)}`);
    }
    await dormir(espera);
  }
}

(process.env.PROBAR_GEMINI === '1' && KEY ? describe : describe.skip)(`extracción real con ${MODELO}`, () => {
  jest.setTimeout(5 * 60_000);

  it.each(NOTAS_PRUEBA.map((n, i) => [n.id, n, i] as const))('%s: no inventa mails ni teléfonos', async (_id, n, i) => {
    if (cuotaDiariaAgotada) throw new Error('Salteado: la cuota diaria ya estaba agotada.');
    if (i > 0) await dormir(PAUSA_ENTRE_NOTAS_MS);

    const fila: FilaCRM | null = n.estadoActual
      ? { club: n.club, empresa: n.empresa, trameroEncargado: 'FR de prueba', estado: n.estadoActual, pingueosSinRespuesta: 0 }
      : null;
    const ctx = { club: n.club, empresa: n.empresa, filaExistente: fila, fechaReunion: fechaDeDia(n.fechaReunion) };

    const r = parsearExtraccion(leerTexto(await llamarConReintentos(armarCuerpo(construirPrompt(n.notas, ctx)))), n.notas);
    if (!r.ok) throw new Error(`La respuesta no cumple el esquema: ${r.error}`);
    const e = validarExtraccion(r.extraccion, { filaExistente: fila, fechaReunion: ctx.fechaReunion, transicionValida });

    if (e.mail) expect(n.mailsValidos).toContain(e.mail.toLowerCase());
    else expect(e.camposFaltantes).toContain('mail');
    if (e.telefono) expect(n.telefonosValidos).toContain(soloDigitos(e.telefono));
    else expect(e.camposFaltantes).toContain('telefono');
    if (n.fechaProximaAccionEsperada !== undefined) expect(e.fechaProximaAccion).toBe(n.fechaProximaAccionEsperada);
  });
});
