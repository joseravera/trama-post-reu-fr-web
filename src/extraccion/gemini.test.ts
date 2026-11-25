import { transicionValida } from '../crm/maquinaEstados';
import type { Extraccion } from '../shared/types';
import { armarCuerpo, crearExtraccionService, errorPorCodigo, ErrorConexionGemini, leerTexto } from './gemini';
import { construirPrompt, EJEMPLOS, PROMPT_SISTEMA, type PromptGemini } from './prompt';
import { EXTRACCION_RESPONSE_SCHEMA } from './schema';
import { aExtraccion, fechaDeDia, parsearRespuestaGemini } from './validacion';

const CTX = { club: 'Agro' as const, empresa: 'Semillas del Sur', filaExistente: null, fechaReunion: fechaDeDia('2026-11-18') };
const NOTAS = 'Reunión con Pablo (Compras) de Semillas del Sur. Mail pablo@semillasdelsur.com. Interesados en el BootCamp.';

const RESPUESTA: Extraccion = {
  persona: 'Pablo',
  rolPersona: 'Compras',
  mail: 'pablo@semillasdelsur.com',
  telefono: null,
  linkedin: null,
  compromisosEmpresa: [],
  compromisosTrama: [],
  parrafoCompromisos: null,
  estadoSugerido: 'Tuvimos reunión, esperando respuesta',
  comentarios: 'Reunión con Pablo (Compras). Interesados en el BootCamp.',
  proximaAccion: null,
  fechaProximaAccion: null,
  camposFaltantes: ['telefono', 'linkedin', 'proximaAccion', 'fechaProximaAccion'],
};

function llmQueDevuelve(...respuestas: (string | Error)[]) {
  const prompts: PromptGemini[] = [];
  const llamar = (p: PromptGemini) => {
    prompts.push(p);
    const r = respuestas[prompts.length - 1];
    if (r === undefined) throw new Error('llamada de más');
    if (r instanceof Error) throw r;
    return r;
  };
  return { llamar, prompts };
}

function ultimoTexto(p: PromptGemini): string {
  return p.contenidos[p.contenidos.length - 1]!.parts[0]!.text;
}

describe('ExtraccionService', () => {
  it('devuelve la extracción validada', () => {
    const { llamar, prompts } = llmQueDevuelve(JSON.stringify(RESPUESTA));
    const r = crearExtraccionService(transicionValida, llamar).extraer(NOTAS, CTX);
    expect(r.mail).toBe('pablo@semillasdelsur.com');
    expect(prompts).toHaveLength(1);
  });

  it('si no cumple el esquema, reintenta una vez con el error en el prompt', () => {
    const { llamar, prompts } = llmQueDevuelve('{roto', JSON.stringify(RESPUESTA));
    crearExtraccionService(transicionValida, llamar).extraer(NOTAS, CTX);
    expect(prompts).toHaveLength(2);
    expect(ultimoTexto(prompts[1]!)).toMatch(/no cumplía el esquema \(la respuesta no es JSON válido\)/);
  });

  it('si vuelve a fallar, tira un error claro para completar a mano', () => {
    const { llamar, prompts } = llmQueDevuelve('{roto', '{roto otra vez');
    expect(() => crearExtraccionService(transicionValida, llamar).extraer(NOTAS, CTX)).toThrow(
      'No se pudieron completar los datos automáticamente: la IA devolvió una respuesta incompleta. Podés completarlos a mano, o volver y probar de nuevo en unos minutos.',
    );
    expect(prompts).toHaveLength(2);
  });

  it('si Gemini está saturado (503), no reintenta y no muestra el detalle técnico', () => {
    const { llamar, prompts } = llmQueDevuelve(errorPorCodigo(503, '{"error":{"code":503,"status":"UNAVAILABLE"}}'));
    let mensaje = '';
    try {
      crearExtraccionService(transicionValida, llamar).extraer(NOTAS, CTX);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    expect(mensaje).toBe(
      'No se pudieron completar los datos automáticamente: la IA está saturada en este momento. Podés completarlos a mano, o volver y probar de nuevo en unos minutos.',
    );
    expect(mensaje).not.toMatch(/503|UNAVAILABLE|\{/);
    expect(prompts).toHaveLength(1);
  });

  it('si falta la clave, pide avisar al equipo', () => {
    const { llamar } = llmQueDevuelve(new ErrorConexionGemini('falta configurar la clave de la IA', false, 'Falta GEMINI_API_KEY'));
    expect(() => crearExtraccionService(transicionValida, llamar).extraer(NOTAS, CTX)).toThrow(/avisale al equipo/);
  });
});

describe('errorPorCodigo', () => {
  it.each([
    [429, '', 'se alcanzó el límite de uso de la IA', true],
    [503, '', 'la IA está saturada en este momento', true],
    [500, '', 'la IA está saturada en este momento', true],
    [400, '{"error":{"message":"API key not valid"}}', 'la clave de la IA no es válida', false],
    [403, '', 'la clave de la IA no es válida', false],
    [404, '', 'el modelo de IA configurado no existe', false],
    [400, '{"error":{"message":"otra cosa"}}', 'la IA respondió con un error', true],
  ])('%i → motivo claro', (codigo, cuerpo, motivo, puedeReintentar) => {
    const e = errorPorCodigo(codigo, cuerpo);
    expect(e.motivo).toBe(motivo);
    expect(e.puedeReintentar).toBe(puedeReintentar);
    expect(e.message).toContain(String(codigo)); // el detalle técnico queda para el log
  });
});

describe('prompt', () => {
  it('sistema + ejemplos (user/model) + notas con la fecha de la reunión', () => {
    const p = construirPrompt(NOTAS, CTX);
    expect(p.sistema).toBe(PROMPT_SISTEMA);
    expect(p.contenidos.map((c) => c.role)).toEqual(['user', 'model', 'user', 'model', 'user', 'model', 'user']);
    expect(ultimoTexto(p)).toContain('miércoles 2026-11-18');
    expect(ultimoTexto(p)).toContain(NOTAS);
  });

  it('los ejemplos cumplen el esquema', () => {
    for (const ej of EJEMPLOS) expect(parsearRespuestaGemini(JSON.stringify(ej.salida)).ok).toBe(true);
  });

  it('en los ejemplos, el fragmento de la fecha está literalmente en las notas', () => {
    for (const ej of EJEMPLOS) {
      expect(aExtraccion(ej.salida, ej.notas).fechaProximaAccion).toBe(ej.salida.fechaProximoContacto);
    }
  });
});

describe('cliente HTTP (partes puras)', () => {
  it('arma el cuerpo con responseMimeType JSON y el responseSchema', () => {
    const cuerpo = armarCuerpo(construirPrompt(NOTAS, CTX)) as { generationConfig: Record<string, unknown> };
    expect(cuerpo.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json', responseSchema: EXTRACCION_RESPONSE_SCHEMA });
  });

  it('lee el texto de la respuesta', () => {
    expect(leerTexto({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })).toBe('{"a":1}');
    expect(() => leerTexto({ candidates: [{ finishReason: 'SAFETY' }] })).toThrow(/SAFETY/);
  });
});
