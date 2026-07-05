"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";

/**
 * Toggle para editar el documento de la carta acuerdo DIRECTO en pantalla, antes
 * de imprimir/guardar como PDF. Pone `contentEditable` en el `.doc`: podés
 * cambiar cualquier texto a mano para este PDF puntual (no se guarda; es solo
 * para la copia que le pasás al cliente).
 */
export function DocEditToggle() {
  const [editing, setEditing] = useState(false);

  function toggle() {
    const doc = document.querySelector(".doc") as HTMLElement | null;
    if (!doc) return;
    const next = !editing;
    doc.contentEditable = next ? "true" : "false";
    doc.classList.toggle("editing", next);
    if (next) doc.focus();
    setEditing(next);
  }

  return (
    <a onClick={toggle} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
      {editing ? (
        <>
          <Check style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
          Listo de editar
        </>
      ) : (
        <>
          <Pencil style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
          Editar texto
        </>
      )}
    </a>
  );
}
