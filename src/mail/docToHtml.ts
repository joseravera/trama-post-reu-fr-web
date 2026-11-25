// Dueño: Persona C (sección 7, C1). Recorre el Google Doc del template y genera HTML de mail
// preservando párrafos, viñetas, negrita, cursiva y links. Depende de DocumentApp: no se puede
// testear con Jest (ver README, sección 9) — la parte pura (reemplazo de placeholders) está en
// template.ts y sí está testeada.

type Paragraph = GoogleAppsScript.Document.Paragraph;
type ListItem = GoogleAppsScript.Document.ListItem;
type ElementoDeTexto = Paragraph | ListItem;

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Recorre los "runs" de un elemento de texto (Paragraph o ListItem) preservando negrita,
// cursiva y links. getTextAttributeIndices() da los puntos donde cambia algún atributo;
// esos métodos solo están en Text, por eso se pasa por editAsText().
function textoARuns(elemento: ElementoDeTexto): string {
  const texto = elemento.editAsText();
  const contenido = texto.getText();
  if (contenido.length === 0) return '';
  const indices = texto.getTextAttributeIndices();
  let html = '';
  for (let i = 0; i < indices.length; i++) {
    const desde = indices[i];
    const hasta = i + 1 < indices.length ? indices[i + 1] : contenido.length;
    if (desde === undefined || hasta === undefined || hasta <= desde) continue;
    const fragmento = escaparHtml(contenido.substring(desde, hasta));
    const url = texto.getLinkUrl(desde);
    let span = fragmento;
    if (texto.isBold(desde)) span = `<strong>${span}</strong>`;
    if (texto.isItalic(desde)) span = `<em>${span}</em>`;
    if (url) span = `<a href="${escaparHtml(url)}">${span}</a>`;
    html += span;
  }
  return html;
}

function esListItem(elemento: GoogleAppsScript.Document.Element): elemento is ListItem {
  return elemento.getType() === DocumentApp.ElementType.LIST_ITEM;
}

function esParagraph(elemento: GoogleAppsScript.Document.Element): elemento is Paragraph {
  return elemento.getType() === DocumentApp.ElementType.PARAGRAPH;
}

export function docToHtml(templateDocId: string): string {
  const body = DocumentApp.openById(templateDocId).getBody();
  const numHijos = body.getNumChildren();

  let html = '';
  let listaAbierta: string | null = null; // 'ul' | 'ol' | null

  const cerrarListaSiHaceFalta = () => {
    if (listaAbierta) {
      html += `</${listaAbierta}>`;
      listaAbierta = null;
    }
  };

  for (let i = 0; i < numHijos; i++) {
    const hijo = body.getChild(i);

    if (esListItem(hijo)) {
      const esNumerada = hijo.getGlyphType() !== DocumentApp.GlyphType.BULLET;
      const tag = esNumerada ? 'ol' : 'ul';
      if (listaAbierta !== tag) {
        cerrarListaSiHaceFalta();
        html += `<${tag}>`;
        listaAbierta = tag;
      }
      html += `<li>${textoARuns(hijo)}</li>`;
      continue;
    }

    cerrarListaSiHaceFalta();

    if (esParagraph(hijo)) {
      const texto = textoARuns(hijo);
      if (texto.trim().length === 0) continue; // párrafos vacíos del Doc no generan <p></p>
      html += `<p>${texto}</p>`;
    }
  }
  cerrarListaSiHaceFalta();

  return html;
}
