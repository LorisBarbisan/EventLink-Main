import { useEffect } from "react";

interface SeoHeadProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE_URL = "https://eventlink.one";

export default function SeoHead({ title, description, canonicalPath, ogImage, noindex }: SeoHeadProps) {
  const canonical = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;
  const image = ogImage || `${BASE_URL}/og-default.png`;

  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", description);
    if (noindex) setMeta("robots", "noindex, nofollow");
    else setMeta("robots", "index, follow");

    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:image", image, true);
    setMeta("og:type", "website", true);
    if (canonical) setMeta("og:url", canonical, true);

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    }
  }, [title, description, canonical, image, noindex]);

  return null;
}
