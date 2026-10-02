"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ESTRUCTURA_VACIA,
  armarDescripcion,
  leerDescripcion,
  type EstructuraPieza,
} from "@/lib/contenidos/estructura-pieza";

/**
 * El brief de un carrusel o un post, cargado por partes: título, una fila por
 * slide (texto + fondo), cierre, CTA y notas. Lo pidió diseño: las ideas
 * llegaban en un párrafo largo y no se entendía qué iba en cada placa.
 *
 * Guarda texto (ver lib/contenidos/estructura-pieza). Si la pieza ya tenía un
 * texto libre viejo, se muestra tal cual con la opción de pasarlo a slides.
 */
export function BriefPorSlides({
  value,
  onChange,
  tipo,
}: {
  value: string;
  onChange: (v: string) => void;
  tipo: string;
}) {
  const esCarrusel = tipo === "carrusel";
  const [e, setE] = useState<EstructuraPieza>(() => leerDescripcion(value) ?? ESTRUCTURA_VACIA);
  const [libre, setLibre] = useState(() => !!value.trim() && !leerDescripcion(value));
  // El último texto que armamos nosotros: si el value cambia por otro lado (la
  // sugerencia de la IA), se vuelve a leer.
  const propio = useRef(value);

  useEffect(() => {
    if (value === propio.current) return;
    propio.current = value;
    const leida = leerDescripcion(value);
    if (leida) {
      setE(leida);
      setLibre(false);
    } else if (value.trim()) {
      setLibre(true);
    }
  }, [value]);

  function cambiar(nueva: EstructuraPieza) {
    setE(nueva);
    const texto = armarDescripcion(nueva);
    propio.current = texto;
    onChange(texto);
  }

  if (libre) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Descripción de la idea</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setLibre(false);
              cambiar({ ...ESTRUCTURA_VACIA, notas: value.trim() });
            }}
          >
            Ordenar en slides
          </Button>
        </div>
        <Textarea rows={5} value={value} onChange={(ev) => onChange(ev.target.value)} />
        <p className="text-[10px] text-muted-foreground">
          Esta idea está en texto libre. Pasala a slides para que diseño vea qué va en cada placa.
        </p>
      </div>
    );
  }

  const setSlide = (i: number, campo: "texto" | "fondo", v: string) =>
    cambiar({ ...e, slides: e.slides.map((s, j) => (j === i ? { ...s, [campo]: v } : s)) });

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="space-y-1.5">
        <Label>Título de la pieza</Label>
        <Input
          value={e.titulo}
          onChange={(ev) => cambiar({ ...e, titulo: ev.target.value })}
          placeholder="Ej: 5 razones por las que tu tesis está frenada"
        />
        <p className="text-[10px] text-muted-foreground">La frase de la portada: lo que frena el scroll.</p>
      </div>

      <div className="space-y-1.5">
        <Label>{esCarrusel ? "Slides" : "La placa"}</Label>
        <div className="space-y-2">
          {e.slides.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2 w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                {i + 1}.
              </span>
              <div className="grid flex-1 gap-1.5 sm:grid-cols-2">
                <Input
                  value={s.texto}
                  onChange={(ev) => setSlide(i, "texto", ev.target.value)}
                  placeholder="Texto que va escrito"
                />
                <Input
                  value={s.fondo}
                  onChange={(ev) => setSlide(i, "fondo", ev.target.value)}
                  placeholder="Fondo: qué se ve"
                />
              </div>
              {esCarrusel && e.slides.length > 1 && (
                <button
                  type="button"
                  onClick={() => cambiar({ ...e, slides: e.slides.filter((_, j) => j !== i) })}
                  className="mt-2 text-muted-foreground hover:text-foreground"
                  aria-label={`Quitar slide ${i + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {esCarrusel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => cambiar({ ...e, slides: [...e.slides, { texto: "", fondo: "" }] })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Agregar slide
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Cierre</Label>
          <Input
            value={e.cierre}
            onChange={(ev) => cambiar({ ...e, cierre: ev.target.value })}
            placeholder="Ej: Te apoyamos en cualquiera de estas 5"
          />
        </div>
        <div className="space-y-1.5">
          <Label>CTA</Label>
          <Input
            value={e.cta}
            onChange={(ev) => cambiar({ ...e, cta: ev.target.value })}
            placeholder="Ej: Pedí tu presupuesto hoy"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notas para diseño (opcional)</Label>
        <Textarea
          rows={2}
          value={e.notas}
          onChange={(ev) => cambiar({ ...e, notas: ev.target.value })}
          placeholder="Paleta, clima visual, algo que no entra arriba…"
        />
        <p className="text-[10px] text-muted-foreground">
          La referencia (Pinterest, una cuenta) va en el campo Referencia de abajo.
        </p>
      </div>
    </div>
  );
}
