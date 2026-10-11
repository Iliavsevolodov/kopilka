import type { MetadataRoute } from "next";
import { publicPath } from "@/lib/base-path";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: publicPath("/"),
    name: "KOPILKA — личные финансы",
    short_name: "Копилка",
    description: "Ваши деньги. Ваше завтра.",
    start_url: publicPath("/dashboard/"),
    scope: publicPath("/"),
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#236a54",
    lang: "ru",
    icons: [
      {
        src: publicPath("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: publicPath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: publicPath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
