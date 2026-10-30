import type { MetadataRoute } from "next";

// permite "Adicionar à Tela de Início" no celular, abrindo como app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResultsNOW",
    short_name: "ResultsNOW",
    description: "Resultados de vela em tempo real",
    start_url: "/",
    display: "standalone",
    background_color: "#2A2F35",
    theme_color: "#2A2F35",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
