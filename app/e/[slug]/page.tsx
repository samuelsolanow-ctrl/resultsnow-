import { permanentRedirect } from "next/navigation";

/** Link curto para compartilhar: /e/finn-sudeste → /eventos/finn-sudeste (mantém ?aba=avisos) */
export default async function Short({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const qs = q.toString();
  permanentRedirect(`/eventos/${slug}${qs ? `?${qs}` : ""}`);
}
