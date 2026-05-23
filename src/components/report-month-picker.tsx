"use client";

export function ReportMonthPicker({
  currentMes,
  clientId,
}: {
  currentMes: string;
  clientId: string;
}) {
  return (
    <form
      action={`/reporte/cliente/${clientId}`}
      method="get"
      className="flex items-center gap-2"
    >
      <label htmlFor="mes" className="text-xs text-zinc-600">
        Mes:
      </label>
      <input
        id="mes"
        type="month"
        name="mes"
        defaultValue={currentMes}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
      />
      <noscript>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50"
        >
          Cambiar
        </button>
      </noscript>
    </form>
  );
}
