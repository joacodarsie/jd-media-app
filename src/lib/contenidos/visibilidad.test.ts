import { describe, it, expect } from "vitest";
import { sinIdeasParaProduccion } from "./visibilidad";

const pubs = [
  { id: "1", estado: "idea" },
  { id: "2", estado: "en_diseno" },
  { id: "3", estado: "edicion" },
];
const ids = (l: { id: string }[]) => l.map((p) => p.id);

describe("sinIdeasParaProduccion", () => {
  it("diseño y edición no ven las ideas sin aprobar", () => {
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "diseno" }))).toEqual(["2", "3"]);
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "audiovisual" }))).toEqual(["2", "3"]);
  });

  it("los que arman y aprueban el calendario ven todo", () => {
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "community_manager" }))).toHaveLength(3);
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "coordinador" }))).toHaveLength(3);
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "admin" }))).toHaveLength(3);
  });

  it("un CM que además diseña ve las ideas", () => {
    expect(ids(sinIdeasParaProduccion(pubs, { rol: "diseno", rol_secundario: "community_manager" }))).toHaveLength(3);
  });
});
