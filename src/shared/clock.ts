// Dueño: Persona C (sección 7, C8). Todo el sistema usa now(), nunca `new Date()` directo,
// para que el modo demo pueda adelantar el reloj sin tocar el resto del código.

const DEMO_NOW_PROPERTY = 'DEMO_NOW';

function leerDemoNow(): string | null {
  if (typeof PropertiesService === 'undefined') return null; // corriendo fuera de Apps Script (tests)
  return PropertiesService.getScriptProperties().getProperty(DEMO_NOW_PROPERTY);
}

export function now(): Date {
  const demoNow = leerDemoNow();
  return demoNow ? new Date(demoNow) : new Date();
}

export function setDemoNow(fecha: Date | null): void {
  if (typeof PropertiesService === 'undefined') return;
  const props = PropertiesService.getScriptProperties();
  if (fecha === null) {
    props.deleteProperty(DEMO_NOW_PROPERTY);
  } else {
    props.setProperty(DEMO_NOW_PROPERTY, fecha.toISOString());
  }
}
