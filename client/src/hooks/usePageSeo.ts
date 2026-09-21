import { useEffect } from "react";

// Site-wide defaults (the homepage values). Restored when a page that set its
// own SEO unmounts, so navigating back doesn't leave a stale title.
export const DEFAULT_TITLE = "EventLink | Freelance Events Crew Network";
export const DEFAULT_DESCRIPTION =
  "EventLink is a freelance events crew network — employers find vetted crew fast; freelancers find event jobs and build their reputation.";

function setMetaDescription(content: string) {
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

/**
 * Sets the document title and meta description for a page, restoring the site
 * defaults on unmount. Client-side only (search engines that render JS pick
 * this up; the static index.html carries the homepage values for the rest).
 */
export function usePageSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    setMetaDescription(description);
    return () => {
      document.title = DEFAULT_TITLE;
      setMetaDescription(DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}
