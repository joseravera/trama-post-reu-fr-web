// Dueño: Persona A (sección 5, A3–A4). Cliente HTTP a la API de Gemini y ExtraccionService.

import { ErrorParaUsuario } from "../app/mensajes";
import type { Estado, ExtraccionService, Extraccion } from "../shared/types";
import {
  construirPrompt,
  type ContextoExtraccion,
  type PromptGemini,
} from "./prompt";
import { EXTRACCION_RESPONSE_SCHEMA } from "./schema";
import { parsearExtraccion, validarExtraccion } from "./validacion";

// "Modelo Flash vigente" (sección 3.1 del plan).
export const MODELO_GEMINI = "gemini-3.6-flash";

export function armarCuerpo(prompt: PromptGemini): object {
  return {
    systemInstruction: { parts: [{ text: prompt.sistema }] },
    contents: prompt.contenidos,
    // temperature 0: ante las mismas notas, la misma respuesta (menos variación entre corridas).
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: EXTRACCION_RESPONSE_SCHEMA },
  };
}

export function leerTexto(respuesta: unknown): string {
  const r = respuesta as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };
  const candidato = r.candidates?.[0];
  const texto =
    candidato?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!texto.trim())
    throw new Error(
      `Gemini no devolvió texto (${candidato?.finishReason ?? "sin candidatos"})`,
    );
  return texto;
}

// Error de conexión con Gemini (HTTP, clave, red). `motivo` es para el FR; `detalle` va al log.
// No se reintenta: el reintento del plan (A4) es solo para respuestas que no cumplen el esquema,
// y cada llamada fallida también gasta cuota.
export class ErrorConexionGemini extends Error {
  constructor(
    public readonly motivo: string,
    public readonly puedeReintentar: boolean,
    detalle: string,
  ) {
    super(detalle);
    this.name = "ErrorConexionGemini";
  }
}

export function errorPorCodigo(
  codigo: number,
  cuerpo: string,
): ErrorConexionGemini {
  const detalle = `Gemini respondió ${codigo}: ${cuerpo.slice(0, 300)}`;
  if (codigo === 429)
    return new ErrorConexionGemini(
      "se alcanzó el límite de uso de la IA",
      true,
      detalle,
    );
  if (codigo >= 500)
    return new ErrorConexionGemini(
      "la IA está saturada en este momento",
      true,
      detalle,
    );
  if (codigo === 401 || codigo === 403 || /API key|API_KEY/i.test(cuerpo)) {
    return new ErrorConexionGemini(
      "la clave de la IA no es válida",
      false,
      detalle,
    );
  }
  if (codigo === 404)
    return new ErrorConexionGemini(
      "el modelo de IA configurado no existe",
      false,
      detalle,
    );
  return new ErrorConexionGemini("la IA respondió con un error", true, detalle);
}

export function llamarGemini(prompt: PromptGemini): string {
  const apiKey =
    PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey)
    throw new ErrorConexionGemini(
      "falta configurar la clave de la IA",
      false,
      "Falta GEMINI_API_KEY en Script Properties",
    );

  let respuesta: GoogleAppsScript.URL_Fetch.HTTPResponse;
  try {
    respuesta = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`,
      {
        method: "post",
        contentType: "application/json",
        headers: { "x-goog-api-key": apiKey },
        payload: JSON.stringify(armarCuerpo(prompt)),
        muteHttpExceptions: true,
      },
    );
  } catch (e) {
    throw new ErrorConexionGemini(
      "no se pudo conectar con la IA",
      true,
      (e as Error).message,
    );
  }
  if (respuesta.getResponseCode() !== 200)
    throw errorPorCodigo(
      respuesta.getResponseCode(),
      respuesta.getContentText(),
    );
  return leerTexto(JSON.parse(respuesta.getContentText()));
}

export function mensajeFalloExtraccion(
  motivo: string,
  puedeReintentar: boolean,
): string {
  return (
    `No se pudieron completar los datos automáticamente: ${motivo}. ` +
    (puedeReintentar
      ? "Podés completarlos a mano, o volver y probar de nuevo en unos minutos."
      : "Completalos a mano y avisale al equipo para que lo revise.")
  );
}

// Si la respuesta no cumple el esquema, reintenta una vez con el error en el prompt; si vuelve a
// fallar, tira el error para que la UI lo muestre y el FR complete a mano (A4).
export function crearExtraccionService(
  transicionValida: (desde: Estado | undefined, hacia: Estado) => boolean,
  llamar: (prompt: PromptGemini) => string = llamarGemini,
): ExtraccionService {
  return {
    extraer(notas: string, ctx: ContextoExtraccion): Extraccion {
      let error: string | undefined;
      for (let intento = 0; intento < 2; intento++) {
        try {
          const r = parsearExtraccion(llamar(construirPrompt(notas, ctx, error)), notas);
          if (r.ok) {
            return validarExtraccion(r.extraccion, {
              filaExistente: ctx.filaExistente,
              fechaReunion: ctx.fechaReunion,
              transicionValida,
            });
          }
          error = r.error;
        } catch (e) {
          if (e instanceof ErrorConexionGemini) {
            console.error(`[extraccion] ${e.message}`);
            throw new ErrorParaUsuario(
              mensajeFalloExtraccion(e.motivo, e.puedeReintentar),
            );
          }
          error = (e as Error).message;
        }
      }
      console.error(
        `[extraccion] la respuesta no cumplió el esquema dos veces: ${error}`,
      );
      throw new ErrorParaUsuario(
        mensajeFalloExtraccion("la IA devolvió una respuesta incompleta", true),
      );
    },
  };
}
