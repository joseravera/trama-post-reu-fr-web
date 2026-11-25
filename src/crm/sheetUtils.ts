// Dueño: Persona B. Helpers puros para trabajar con el formato "primera fila = encabezados"
// de las hojas de Sheets, sin depender de Apps Script (SpreadsheetApp) — así se testean con Jest.
// `repo.ts`, `config.ts` e `historial.ts` los usan después de leer los valores con getValues().

export function indiceColumna(encabezados: readonly unknown[], nombre: string): number {
  const i = encabezados.findIndex((h) => String(h).trim() === nombre);
  if (i === -1) {
    throw new Error(`No se encontró la columna "${nombre}" en el encabezado (¿cambió el nombre en la hoja?)`);
  }
  return i;
}

export function filaVacia(fila: readonly unknown[]): boolean {
  return fila.every((v) => v === '' || v === null || v === undefined);
}

/**
 * Dado el rango completo de una tabla (valores[0] = encabezados), devuelve el número de fila
 * (1-based, como lo usa Sheets) de la primera fila vacía dentro de la tabla. Si no hay ninguna,
 * devuelve la fila siguiente a la última — así el upsert nunca hace un `appendRow` a ciegas que
 * salga de los límites de la tabla con formato/desplegables (regla de la sección 6, B2).
 */
export function primeraFilaVacia(valores: readonly unknown[][]): number {
  for (let i = 1; i < valores.length; i++) {
    if (filaVacia(valores[i])) return i + 1;
  }
  return valores.length + 1;
}

/**
 * Busca la fila (1-based) cuyo valor en `indiceClave` matchea `valorClave` según `comparador`.
 * Devuelve null si no la encuentra. `comparador` permite comparar normalizado (sin tildes, etc.)
 * sin que esta función sepa nada de esa lógica.
 */
export function buscarFilaPorClave(
  valores: readonly unknown[][],
  indiceClave: number,
  valorClave: string,
  comparador: (valorEnFila: string, valorBuscado: string) => boolean = (a, b) => a === b,
): number | null {
  for (let i = 1; i < valores.length; i++) {
    const v = valores[i][indiceClave];
    if (v !== '' && v !== null && v !== undefined && comparador(String(v), valorClave)) return i + 1;
  }
  return null;
}
