export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80);
}

export function generateFreelancerSlug(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  role: string | null | undefined
): string {
  const parts = [firstName, lastName, role].filter(Boolean).join(" ");
  return slugify(parts);
}

export function generateJobSlug(title: string, location: string, id: number): string {
  const city = location.split(",")[0].trim();
  const base = `${title} ${city} ${id}`;
  return slugify(base);
}

export function generateEmployerSlug(companyName: string): string {
  return slugify(companyName);
}

export async function makeFreelancerSlugUnique(
  baseSlug: string,
  existingSlugFn: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;
  while (await existingSlugFn(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}
