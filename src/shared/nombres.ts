// Comparación de nombres de personas ("Tramero encargado" del CRM vs. nombre en _Usuarios):
// sin importar tildes, mayúsculas ni espacios/tabs de más.

export function normalizarNombrePersona(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function mismoNombre(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizarNombrePersona(a) === normalizarNombrePersona(b);
}
