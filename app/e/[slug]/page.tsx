import { permanentRedirect } from "next/navigation";

/** Link curto para compartilhar: /e/finn-sudeste → /eventos/finn-sudeste */
export default async function Short({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/eventos/${slug}`);
}
