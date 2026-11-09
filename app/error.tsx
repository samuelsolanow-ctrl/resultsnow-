"use client";

/** Erro ao carregar (ex.: banco fora do ar): mensagem clara + tentar de novo */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap max-w-md py-16 text-center">
      <p className="text-4xl">⛵</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Não foi possível carregar agora</h1>
      <p className="mt-2 text-sm text-ink-3">O servidor de resultados não respondeu. Tente de novo em alguns segundos.</p>
      <button onClick={reset} className="btn-primary mt-5">Tentar de novo</button>
    </div>
  );
}
