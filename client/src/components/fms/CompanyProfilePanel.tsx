import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Building2,
  Globe,
  Linkedin,
  Instagram,
  Twitter,
  Phone,
  MapPin,
  Shield,
  Award,
  Briefcase,
  Users,
  Pound,
  FileText,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Save,
  X,
  Plus,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPANY_TYPES = [
  { value: "production_company", label: "Production Company" },
  { value: "av_supplier", label: "AV / Technical Supplier" },
  { value: "agency", label: "Talent / Crew Agency" },
  { value: "venue", label: "Venue" },
  { value: "exhibition_trade_show_organiser", label: "Exhibition & Trade Show Organiser" },
  { value: "entertainment_agency", label: "Entertainment Agency" },
  { value: "broadcast", label: "Broadcast / Media" },
  { value: "corporate_events", label: "Corporate Events" },
  { value: "festival_outdoor", label: "Festival & Outdoor Events" },
  { value: "other", label: "Other" },
];

const COMPANY_SIZES = [
  { value: "1-5", label: "1–5 employees" },
  { value: "6-20", label: "6–20 employees" },
  { value: "21-50", label: "21–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "200+", label: "200+ employees" },
];

const SPECIALISATIONS = [
  "Live Events", "AV / Technical Production", "Broadcast & Media", "Corporate Events",
  "Festivals & Outdoor", "Theatre & Performing Arts", "Film & TV", "Sports Events",
  "Hospitality & Experiential", "Virtual & Hybrid Events", "Exhibitions & Trade Shows",
  "Touring & Travel",
];

const TYPICAL_ROLES = [
  "Stage Manager", "Production Manager", "Technical Director", "Sound Engineer",
  "Lighting Technician", "Video Technician", "Rigger", "Crew Chief", "Follow Spot Operator",
  "FOH Engineer", "Monitor Engineer", "Broadcast Engineer", "Camera Operator", "Vision Mixer",
  "Set Builder / Carpenter", "Driver / Transport", "Runner / Production Assistant",
  "Event Manager", "Site Manager", "Logistics Coordinator",
];

const PAYMENT_TERMS = [
  { value: "7_days", label: "7 days" },
  { value: "14_days", label: "14 days" },
  { value: "30_days", label: "30 days" },
  { value: "on_completion", label: "On completion" },
  { value: "in_advance", label: "In advance" },
];

const IR35_PREFS = [
  { value: "outside", label: "Outside IR35 (self-employed)" },
  { value: "inside", label: "Inside IR35 (PAYE)" },
  { value: "both", label: "Both / varies per engagement" },
];

const PUBLIC_LIABILITY_VALUES = [
  { value: "£1m", label: "£1 million" },
  { value: "£2m", label: "£2 million" },
  { value: "£5m", label: "£5 million" },
  { value: "£10m", label: "£10 million" },
  { value: "£10m+", label: "£10 million+" },
];

const INDUSTRY_BODIES = [
  "ALD (Association of Lighting Designers)",
  "PLASA (Professional Lighting & Sound Association)",
  "PSA (Production Services Association)",
  "BECTU (Broadcasting, Entertainment, Communications & Theatre Union)",
  "IATSE",
  "ESTA (Entertainment Services & Technology Association)",
  "TPi (Tour Production International)",
  "ABTT (Association of British Theatre Technicians)",
  "EVCOM (Event & Visual Communications Association)",
];

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="ml-12 space-y-4">{children}</div>
    </div>
  );
}

// ── Tag selector (multi-select chips) ────────────────────────────────────────

function TagSelector({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const toggle = (item: string) =>
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => toggle(item)}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            selected.includes(item)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
        >
          {selected.includes(item) && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
          {item}
        </button>
      ))}
    </div>
  );
}

// ── Completion bar ────────────────────────────────────────────────────────────

function ProfileCompletionBar({ profile }: { profile: any }) {
  const fields = [
    profile?.company_name,
    profile?.contact_name,
    profile?.company_type,
    profile?.description,
    profile?.phone,
    profile?.address_line1,
    profile?.city,
    profile?.postcode,
    profile?.website_url,
    profile?.specialisations?.length,
    profile?.typical_roles?.length,
    profile?.public_liability_value,
    profile?.company_logo_url,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);
  const color = pct < 40 ? "bg-red-400" : pct < 75 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Profile completeness</span>
        <span className="text-sm font-semibold">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {pct < 100 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Complete your profile so freelancers know who they're working with.
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompanyProfilePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: [`/api/profiles/recruiter/${user?.id}`],
    enabled: !!user?.id,
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newRole, setNewRole] = useState("");

  // Initialise form when profile loads
  const startEditing = useCallback(() => {
    setForm({
      company_name: profile?.company_name ?? "",
      contact_name: profile?.contact_name ?? "",
      company_type: profile?.company_type ?? "",
      company_size: profile?.company_size ?? "",
      founded_year: profile?.founded_year?.toString() ?? "",
      company_registration_number: profile?.company_registration_number ?? "",
      vat_number: profile?.vat_number ?? "",
      description: profile?.description ?? "",
      mission_statement: profile?.mission_statement ?? "",
      notable_clients: profile?.notable_clients ?? "",
      company_logo_url: profile?.company_logo_url ?? "",
      cover_image_url: profile?.cover_image_url ?? "",
      // Contact
      phone: profile?.phone ?? "",
      address_line1: profile?.address_line1 ?? "",
      address_line2: profile?.address_line2 ?? "",
      city: profile?.city ?? "",
      county: profile?.county ?? "",
      postcode: profile?.postcode ?? "",
      website_url: profile?.website_url ?? "",
      linkedin_url: profile?.linkedin_url ?? "",
      instagram_url: profile?.instagram_url ?? "",
      twitter_url: profile?.twitter_url ?? "",
      // Billing
      billing_same_as_company: profile?.billing_same_as_company ?? true,
      billing_address_line1: profile?.billing_address_line1 ?? "",
      billing_address_line2: profile?.billing_address_line2 ?? "",
      billing_city: profile?.billing_city ?? "",
      billing_county: profile?.billing_county ?? "",
      billing_postcode: profile?.billing_postcode ?? "",
      // Operations
      specialisations: profile?.specialisations ?? [],
      typical_roles: profile?.typical_roles ?? [],
      day_rate_min: profile?.day_rate_min?.toString() ?? "",
      day_rate_max: profile?.day_rate_max?.toString() ?? "",
      payment_terms: profile?.payment_terms ?? "",
      ir35_preference: profile?.ir35_preference ?? "",
      // Insurance
      public_liability_value: profile?.public_liability_value ?? "",
      employers_liability: profile?.employers_liability ?? false,
      professional_indemnity: profile?.professional_indemnity ?? false,
      gdpr_compliant: profile?.gdpr_compliant ?? false,
      // Accreditations
      industry_bodies: profile?.industry_bodies ?? [],
      other_accreditations: profile?.other_accreditations ?? "",
    });
    setIsEditing(true);
  }, [profile]);

  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/profiles/recruiter/${user?.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          founded_year: form.founded_year ? parseInt(form.founded_year) : null,
          day_rate_min: form.day_rate_min ? parseInt(form.day_rate_min) : null,
          day_rate_max: form.day_rate_max ? parseInt(form.day_rate_max) : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/profiles/recruiter/${user?.id}`] });
      setIsEditing(false);
      toast({ title: "Company profile saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isEditing) {
    return <ProfileView profile={profile} onEdit={startEditing} />;
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Edit Company Profile</h2>
          <p className="text-sm text-muted-foreground">
            Visible to freelancers when they view your bookings and job postings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setIsEditing(false)}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* ── 1. Identity ────────────────────────────────────────────────────── */}
      <Section
        icon={<Building2 className="h-5 w-5" />}
        title="Company Identity"
        subtitle="Core information about your business"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="company_name">Company Name *</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              placeholder="Acme Productions Ltd"
            />
          </div>
          <div>
            <Label htmlFor="contact_name">Primary Contact Name</Label>
            <Input
              id="contact_name"
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Company Type</Label>
            <Select value={form.company_type} onValueChange={(v) => set("company_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Company Size</Label>
            <Select value={form.company_size} onValueChange={(v) => set("company_size", v)}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {COMPANY_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="founded_year">Founded Year</Label>
            <Input
              id="founded_year"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={form.founded_year}
              onChange={(e) => set("founded_year", e.target.value)}
              placeholder="2010"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="company_registration_number">Company Registration No.</Label>
            <Input
              id="company_registration_number"
              value={form.company_registration_number}
              onChange={(e) => set("company_registration_number", e.target.value)}
              placeholder="12345678"
            />
          </div>
          <div>
            <Label htmlFor="vat_number">VAT Number</Label>
            <Input
              id="vat_number"
              value={form.vat_number}
              onChange={(e) => set("vat_number", e.target.value)}
              placeholder="GB 123 4567 89"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Company Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Tell freelancers about your company — what you do, the scale of events you produce, your culture and working environment..."
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor="mission_statement">Mission / Positioning Statement</Label>
          <Textarea
            id="mission_statement"
            value={form.mission_statement}
            onChange={(e) => set("mission_statement", e.target.value)}
            placeholder="One or two sentences about what makes your company distinctive..."
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="notable_clients">Notable Clients / Projects</Label>
          <Textarea
            id="notable_clients"
            value={form.notable_clients}
            onChange={(e) => set("notable_clients", e.target.value)}
            placeholder="e.g. Glastonbury Festival, BBC Proms, O2 Arena residencies, corporate clients including FTSE 100 brands..."
            rows={2}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <ImageUpload
            label="Company Logo"
            value={form.company_logo_url}
            onChange={(url: string) => set("company_logo_url", url)}
            shape="circle"
          />
          <ImageUpload
            label="Cover / Banner Image"
            value={form.cover_image_url}
            onChange={(url: string) => set("cover_image_url", url)}
            shape="square"
          />
        </div>
      </Section>

      <Separator />

      {/* ── 2. Contact & Location ───────────────────────────────────────────── */}
      <Section
        icon={<MapPin className="h-5 w-5" />}
        title="Contact & Location"
        subtitle="How freelancers and partners can reach you"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+44 20 7946 0000"
            />
          </div>
          <div>
            <Label htmlFor="website_url">Website</Label>
            <Input
              id="website_url"
              value={form.website_url}
              onChange={(e) => set("website_url", e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="address_line1">Address Line 1</Label>
          <Input
            id="address_line1"
            value={form.address_line1}
            onChange={(e) => set("address_line1", e.target.value)}
            placeholder="123 Production House, Studio Way"
          />
        </div>
        <div>
          <Label htmlFor="address_line2">Address Line 2</Label>
          <Input
            id="address_line2"
            value={form.address_line2}
            onChange={(e) => set("address_line2", e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="city">City / Town</Label>
            <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="London" />
          </div>
          <div>
            <Label htmlFor="county">County</Label>
            <Input id="county" value={form.county} onChange={(e) => set("county", e.target.value)} placeholder="Greater London" />
          </div>
          <div>
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} placeholder="EC1A 1BB" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <Input
              id="linkedin_url"
              value={form.linkedin_url}
              onChange={(e) => set("linkedin_url", e.target.value)}
              placeholder="linkedin.com/company/..."
            />
          </div>
          <div>
            <Label htmlFor="instagram_url">Instagram</Label>
            <Input
              id="instagram_url"
              value={form.instagram_url}
              onChange={(e) => set("instagram_url", e.target.value)}
              placeholder="@yourcompany"
            />
          </div>
          <div>
            <Label htmlFor="twitter_url">X / Twitter</Label>
            <Input
              id="twitter_url"
              value={form.twitter_url}
              onChange={(e) => set("twitter_url", e.target.value)}
              placeholder="@yourcompany"
            />
          </div>
        </div>

        {/* Billing address */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="billing_same"
              checked={form.billing_same_as_company}
              onCheckedChange={(v) => set("billing_same_as_company", !!v)}
            />
            <Label htmlFor="billing_same" className="cursor-pointer font-normal">
              Billing address same as company address
            </Label>
          </div>
          {!form.billing_same_as_company && (
            <div className="space-y-3 pt-2">
              <div>
                <Label>Billing Address Line 1</Label>
                <Input value={form.billing_address_line1} onChange={(e) => set("billing_address_line1", e.target.value)} />
              </div>
              <div>
                <Label>Billing Address Line 2</Label>
                <Input value={form.billing_address_line2} onChange={(e) => set("billing_address_line2", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>City</Label>
                  <Input value={form.billing_city} onChange={(e) => set("billing_city", e.target.value)} />
                </div>
                <div>
                  <Label>County</Label>
                  <Input value={form.billing_county} onChange={(e) => set("billing_county", e.target.value)} />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input value={form.billing_postcode} onChange={(e) => set("billing_postcode", e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Separator />

      {/* ── 3. Operations ───────────────────────────────────────────────────── */}
      <Section
        icon={<Briefcase className="h-5 w-5" />}
        title="Operations"
        subtitle="How you work — helps freelancers know what to expect"
      >
        <div>
          <Label className="mb-2 block">Specialisations</Label>
          <p className="mb-3 text-xs text-muted-foreground">Select all event types your company produces</p>
          <TagSelector
            options={SPECIALISATIONS}
            selected={form.specialisations}
            onChange={(v) => set("specialisations", v)}
          />
        </div>

        <div>
          <Label className="mb-2 block">Typical Crew Roles Hired</Label>
          <p className="mb-3 text-xs text-muted-foreground">Which roles do you most commonly book through EventLink?</p>
          <TagSelector
            options={TYPICAL_ROLES}
            selected={form.typical_roles}
            onChange={(v) => set("typical_roles", v)}
          />
          {/* Custom role input */}
          <div className="mt-3 flex gap-2">
            <Input
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="Add a custom role..."
              className="max-w-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRole.trim()) {
                  set("typical_roles", [...(form.typical_roles ?? []), newRole.trim()]);
                  setNewRole("");
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (newRole.trim()) {
                  set("typical_roles", [...(form.typical_roles ?? []), newRole.trim()]);
                  setNewRole("");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Standard Day Rate Range (£)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={form.day_rate_min}
                onChange={(e) => set("day_rate_min", e.target.value)}
                placeholder="Min"
                min="0"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                value={form.day_rate_max}
                onChange={(e) => set("day_rate_max", e.target.value)}
                placeholder="Max"
                min="0"
              />
            </div>
          </div>
          <div>
            <Label>Standard Payment Terms</Label>
            <Select value={form.payment_terms} onValueChange={(v) => set("payment_terms", v)}>
              <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TERMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>IR35 / Engagement Preference</Label>
          <Select value={form.ir35_preference} onValueChange={(v) => set("ir35_preference", v)}>
            <SelectTrigger><SelectValue placeholder="How do you typically engage freelancers?" /></SelectTrigger>
            <SelectContent>
              {IR35_PREFS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Separator />

      {/* ── 4. Insurance & Compliance ────────────────────────────────────────── */}
      <Section
        icon={<Shield className="h-5 w-5" />}
        title="Insurance & Compliance"
        subtitle="Professional credentials — visible on your company profile"
      >
        <div>
          <Label>Public Liability Insurance</Label>
          <Select value={form.public_liability_value} onValueChange={(v) => set("public_liability_value", v)}>
            <SelectTrigger><SelectValue placeholder="Select cover value" /></SelectTrigger>
            <SelectContent>
              {PUBLIC_LIABILITY_VALUES.map((v) => (
                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="employers_liability"
              checked={form.employers_liability}
              onCheckedChange={(v) => set("employers_liability", !!v)}
            />
            <Label htmlFor="employers_liability" className="cursor-pointer font-normal">
              Employers Liability Insurance
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="professional_indemnity"
              checked={form.professional_indemnity}
              onCheckedChange={(v) => set("professional_indemnity", !!v)}
            />
            <Label htmlFor="professional_indemnity" className="cursor-pointer font-normal">
              Professional Indemnity Insurance
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="gdpr_compliant"
              checked={form.gdpr_compliant}
              onCheckedChange={(v) => set("gdpr_compliant", !!v)}
            />
            <Label htmlFor="gdpr_compliant" className="cursor-pointer font-normal">
              GDPR Compliant — we handle freelancer data in accordance with UK GDPR
            </Label>
          </div>
        </div>
      </Section>

      <Separator />

      {/* ── 5. Accreditations ───────────────────────────────────────────────── */}
      <Section
        icon={<Award className="h-5 w-5" />}
        title="Industry Accreditations"
        subtitle="Professional memberships and certifications"
      >
        <div>
          <Label className="mb-3 block">Industry Bodies</Label>
          <TagSelector
            options={INDUSTRY_BODIES}
            selected={form.industry_bodies}
            onChange={(v) => set("industry_bodies", v)}
          />
        </div>
        <div>
          <Label htmlFor="other_accreditations">Other Accreditations</Label>
          <Input
            id="other_accreditations"
            value={form.other_accreditations}
            onChange={(e) => set("other_accreditations", e.target.value)}
            placeholder="ISO 9001, Investors in People, etc."
          />
        </div>
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 py-3 shadow-lg sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Changes are saved to your profile immediately.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile read-only view ────────────────────────────────────────────────────

function ProfileView({ profile, onEdit }: { profile: any; onEdit: () => void }) {
  const hasAddress = profile?.address_line1 || profile?.city;
  const hasInsurance = profile?.public_liability_value || profile?.employers_liability || profile?.professional_indemnity;

  return (
    <div className="space-y-6">
      <ProfileCompletionBar profile={profile} />

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {profile?.cover_image_url && (
          <div className="h-32 w-full overflow-hidden bg-muted">
            <img src={profile.cover_image_url} alt="Cover" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-primary/10 shadow">
                {profile?.company_logo_url ? (
                  <img src={profile.company_logo_url} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile?.company_name || "Company Name"}</h2>
                {profile?.contact_name && <p className="text-muted-foreground">{profile.contact_name}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile?.company_type && (
                    <Badge variant="secondary">
                      {COMPANY_TYPES.find((t) => t.value === profile.company_type)?.label ?? profile.company_type}
                    </Badge>
                  )}
                  {profile?.company_size && <Badge variant="outline">{profile.company_size} employees</Badge>}
                  {profile?.founded_year && <Badge variant="outline">Est. {profile.founded_year}</Badge>}
                </div>
              </div>
            </div>
            <Button onClick={onEdit} variant="outline" size="sm">
              Edit Profile
            </Button>
          </div>

          {/* Contact row */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {hasAddress && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {[profile.address_line1, profile.city, profile.postcode].filter(Boolean).join(", ")}
              </span>
            )}
            {profile?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {profile.phone}
              </span>
            )}
            {profile?.website_url && (
              <a
                href={profile.website_url.match(/^https?:\/\//) ? profile.website_url : `https://${profile.website_url}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
            {profile?.linkedin_url && (
              <a
                href={profile.linkedin_url.match(/^https?:\/\//) ? profile.linkedin_url : `https://${profile.linkedin_url}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Linkedin className="h-4 w-4" /> LinkedIn
              </a>
            )}
            {profile?.instagram_url && (
              <a
                href={profile.instagram_url.match(/^https?:\/\//) ? profile.instagram_url : `https://instagram.com/${profile.instagram_url.replace(/^@/, "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            )}
          </div>
        </div>
      </div>

      {/* About */}
      {(profile?.description || profile?.mission_statement) && (
        <div className="rounded-xl border bg-card p-6 space-y-3 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> About
          </h3>
          {profile.description && <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>}
          {profile.mission_statement && (
            <blockquote className="border-l-4 border-primary pl-4 italic text-sm text-muted-foreground">
              {profile.mission_statement}
            </blockquote>
          )}
          {profile.notable_clients && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Notable Clients</p>
              <p className="text-sm">{profile.notable_clients}</p>
            </div>
          )}
        </div>
      )}

      {/* Specialisations */}
      {profile?.specialisations?.length > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-primary" /> Specialisations
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.specialisations.map((s: string) => (
              <Badge key={s} variant="secondary">{s}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Operations */}
      {(profile?.day_rate_min || profile?.payment_terms || profile?.ir35_preference) && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" /> Working Arrangements
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {(profile.day_rate_min || profile.day_rate_max) && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Day Rate Range</p>
                <p className="mt-1 font-semibold">
                  £{profile.day_rate_min ?? "—"} – £{profile.day_rate_max ?? "—"}
                </p>
              </div>
            )}
            {profile.payment_terms && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment Terms</p>
                <p className="mt-1 font-semibold">
                  {PAYMENT_TERMS.find((t) => t.value === profile.payment_terms)?.label ?? profile.payment_terms}
                </p>
              </div>
            )}
            {profile.ir35_preference && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IR35 Preference</p>
                <p className="mt-1 font-semibold">
                  {IR35_PREFS.find((p) => p.value === profile.ir35_preference)?.label ?? profile.ir35_preference}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insurance */}
      {hasInsurance && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" /> Insurance & Compliance
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.public_liability_value && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Public Liability: {profile.public_liability_value}</span>
              </div>
            )}
            {profile.employers_liability && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Employers Liability Insurance</span>
              </div>
            )}
            {profile.professional_indemnity && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Professional Indemnity Insurance</span>
              </div>
            )}
            {profile.gdpr_compliant && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">GDPR Compliant</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accreditations */}
      {(profile?.industry_bodies?.length > 0 || profile?.other_accreditations) && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-primary" /> Accreditations
          </h3>
          {profile.industry_bodies?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {profile.industry_bodies.map((b: string) => (
                <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
              ))}
            </div>
          )}
          {profile.other_accreditations && (
            <p className="text-sm text-muted-foreground">{profile.other_accreditations}</p>
          )}
        </div>
      )}

      {/* Prompt to fill in if very sparse */}
      {!profile?.description && !profile?.specialisations?.length && (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Complete your company profile</h3>
          <p className="text-sm text-muted-foreground mb-4">
            A complete profile builds trust with freelancers and increases booking acceptance rates.
          </p>
          <Button onClick={onEdit}>
            <ChevronRight className="mr-2 h-4 w-4" /> Set Up Profile
          </Button>
        </div>
      )}
    </div>
  );
}
