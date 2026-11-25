// Fake de MailService, para que A desarrolle/testee el paso 2 sin esperar al C3 real.

import type { MailService } from '../../src/shared/types';

export function crearFakeMailService(): MailService {
  let contador = 0;
  return {
    previsualizar(p) {
      return `<html><body><p>[FAKE] Resumen de la reunión con ${p.empresa}</p></body></html>`;
    },
    crearBorrador(p) {
      contador += 1;
      return {
        draftId: `fake-draft-${contador}`,
        url: `https://mail.google.com/mail/#drafts?fake=${p.empresa}-${contador}`,
      };
    },
    crearBorradorPingueo(p) {
      contador += 1;
      return {
        draftId: `fake-draft-pingueo-${contador}`,
        url: `https://mail.google.com/mail/#drafts?fake-pingueo=${p.empresa}-${p.tipo}-${contador}`,
      };
    },
  };
}
