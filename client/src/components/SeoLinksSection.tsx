import { Link } from "wouter";
import { MapPin, Users } from "lucide-react";

const ROLES = [
  { slug: "sound-engineer", label: "Sound Engineer" },
  { slug: "lighting-technician", label: "Lighting Technician" },
  { slug: "production-manager", label: "Production Manager" },
  { slug: "stage-manager", label: "Stage Manager" },
  { slug: "av-technician", label: "AV Technician" },
  { slug: "rigger", label: "Rigger" },
  { slug: "video-technician", label: "Video Technician" },
  { slug: "event-manager", label: "Event Manager" },
  { slug: "technical-director", label: "Technical Director" },
  { slug: "broadcast-technician", label: "Broadcast Technician" },
];

const CITIES = [
  { slug: "london", label: "London" },
  { slug: "manchester", label: "Manchester" },
  { slug: "birmingham", label: "Birmingham" },
  { slug: "bristol", label: "Bristol" },
  { slug: "leeds", label: "Leeds" },
  { slug: "glasgow", label: "Glasgow" },
  { slug: "edinburgh", label: "Edinburgh" },
  { slug: "liverpool", label: "Liverpool" },
  { slug: "sheffield", label: "Sheffield" },
  { slug: "nottingham", label: "Nottingham" },
];

export default function SeoLinksSection() {
  return (
    <section className="bg-white py-14 px-4 border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Browse by role */}
          <div>
            <h2 className="text-xl font-bold text-[#3D1766] mb-5 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Browse by Role
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <li key={r.slug}>
                  <Link href={`/roles/${r.slug}`}>
                    <span className="text-sm text-[#3D1766] hover:underline cursor-pointer font-medium">
                      {r.label}s
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Browse by location */}
          <div>
            <h2 className="text-xl font-bold text-[#3D1766] mb-5 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Browse by Location
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {CITIES.map(c => (
                <li key={c.slug}>
                  <Link href={`/locations/${c.slug}`}>
                    <span className="text-sm text-[#3D1766] hover:underline cursor-pointer font-medium">
                      Event Freelancers in {c.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
