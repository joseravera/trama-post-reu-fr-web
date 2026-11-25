// Dueño: Persona C (sección 7, C3). PDB y documento del evento (siempre) + adjuntos extra elegidos.
// Depende de DriveApp: no se puede testear con Jest (ver README, sección 9).

// La carpeta de adjuntos del club (ID en _Clubes, ver ConfigService.getClub) tiene siempre
// el PDB y el material del evento: se adjuntan todos los archivos que haya ahí.
export function obtenerAdjuntosFijos(carpetaAdjuntosId: string): GoogleAppsScript.Base.Blob[] {
  const archivos = DriveApp.getFolderById(carpetaAdjuntosId).getFiles();
  const blobs: GoogleAppsScript.Base.Blob[] = [];
  while (archivos.hasNext()) {
    blobs.push(archivos.next().getBlob());
  }
  return blobs;
}

// Adjuntos extra que el FR elige en el paso 2 (archivos de la carpeta del club).
export function obtenerAdjuntosExtra(idsDrive: string[]): GoogleAppsScript.Base.Blob[] {
  return idsDrive.map((id) => DriveApp.getFileById(id).getBlob());
}
