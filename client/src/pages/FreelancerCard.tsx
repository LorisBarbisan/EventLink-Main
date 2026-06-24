import { apiRequest } from "@/lib/queryClient";
import { useFreelancerAverageRating } from "@/hooks/useRatings";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import QRCode from "qrcode";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  FileText,
  LayoutGrid,
  MapPin,
  Share2,
  ShieldCheck,
  Star,
  User,
  Globe,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Brand palette
const C = {
  orange: "hsl(27,88%,45%)",
  orangeLight: "hsl(27,88%,95%)",
  purple: "hsl(258,70%,55%)",
  purpleLight: "hsl(258,70%,96%)",
  purpleDark: "hsl(258,70%,40%)",
  success: "hsl(142,76%,36%)",
  successLight: "hsl(142,76%,94%)",
  bg2: "#f7f7f8",
  bg3: "#eeeef0",
  text2: "#555",
  text3: "#999",
  border: "rgba(0,0,0,0.10)",
  border2: "rgba(0,0,0,0.18)",
};

type Detail = "about" | "credentials" | "portfolio" | "files" | null;
type RightTab = "about" | "credentials" | "portfolio" | "files";

export default function FreelancerCard() {
  const { userId } = useParams();
  const { toast } = useToast();

  const [view, setView] = useState<"card" | "wallet">("card");
  const [flipped, setFlipped] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [rightTab, setRightTab] = useState<RightTab>("about");
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  const { data: freelancer, isLoading } = useQuery({
    queryKey: ["/api/freelancer", userId],
    queryFn: () => apiRequest(`/api/freelancer/${userId}`),
    enabled: !!userId,
    retry: false,
  });

  const uid: number | undefined = freelancer?.user_id;

  const { data: portfolio = [] } = useQuery<any[]>({
    queryKey: ["/api/portfolio", uid],
    queryFn: () => apiRequest(`/api/portfolio?userId=${uid}`),
    enabled: !!uid,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents", uid],
    queryFn: () => apiRequest(`/api/documents/${uid}`),
    enabled: !!uid,
  });

  const { data: references = [] } = useQuery<any[]>({
    queryKey: ["/api/references/freelancer", uid],
    queryFn: () => apiRequest(`/api/references/freelancer/${uid}`),
    enabled: !!uid,
  });

  const { data: rating } = useFreelancerAverageRating(uid || 0);

  const profileUrl = () => {
    const slug = freelancer?.custom_slug || freelancer?.slug;
    const base = window.location.origin;
    return slug ? `${base}/profile/${slug}` : `${base}/profile/${uid ?? userId}`;
  };

  useEffect(() => {
    if (view === "wallet" && uid) {
      QRCode.toDataURL(profileUrl(), { width: 220 }).then(setQrUrl);
    }
  }, [view, uid]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadQR = async () => {
    const url = qrUrl || (await QRCode.toDataURL(profileUrl(), { width: 400 }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${freelancer?.first_name || "profile"}-qr-code.png`;
    a.click();
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg3,
        }}
      >
        <p style={{ color: C.text3, fontSize: 13 }}>Loading…</p>
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg3,
        }}
      >
        <p style={{ color: C.text3, fontSize: 13 }}>Profile not found.</p>
      </div>
    );
  }

  const initials =
    `${(freelancer.first_name || "")[0] ?? ""}${(freelancer.last_name || "")[0] ?? ""}`.toUpperCase();
  const fullName = `${freelancer.first_name || ""} ${freelancer.last_name || ""}`.trim();
  const avgRating = rating?.average ? rating.average.toFixed(1) : null;
  const hasPhoto =
    !!freelancer.profile_photo_url &&
    freelancer.profile_photo_url !== "null" &&
    freelancer.profile_photo_url.trim() !== "";
  const skills: string[] = Array.isArray(freelancer.skills) ? freelancer.skills : [];
  const pt = freelancer.reference_token
    ? `?pt=${encodeURIComponent(freelancer.reference_token)}`
    : "";
  const avail: string = freelancer.availability_status || "available";
  const availLabel =
    avail === "available" ? "Available now" : avail === "busy" ? "Busy" : "Unavailable";
  const isVerified = (references as any[]).some(
    (r) =>
      r.badge_result === "highly_recommended" ||
      r.badge_result === "recommended" ||
      r.badge_result === "work_history_confirmed"
  );

  // ── shared micro-components (stable references — defined outside JSX) ──

  function Avatar({ size = 64 }: { size?: number }) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${size > 48 ? 2.5 : 2}px solid ${C.orange}`,
          background: "linear-gradient(135deg,#b8cce0,#7a93a8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {hasPhoto ? (
          <img
            src={`/api/profile-photo/${uid}`}
            alt={fullName}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontWeight: 700, color: "#fff", fontSize: Math.floor(size * 0.28) }}>
            {initials}
          </span>
        )}
      </div>
    );
  }

  function SkillPill({ label, style: sx = {} }: { label: string; style?: React.CSSProperties }) {
    return (
      <span
        style={{
          fontSize: 9,
          padding: "2px 7px",
          borderRadius: 10,
          background: C.purpleLight,
          color: C.purpleDark,
          border: "0.5px solid rgba(120,80,220,0.15)",
          fontWeight: 500,
          ...sx,
        }}
      >
        {label}
      </span>
    );
  }

  function RatingPill() {
    if (!avgRating) return null;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: C.orangeLight,
          borderRadius: 20,
          padding: "3px 9px",
          fontSize: 11,
          fontWeight: 700,
          color: C.orange,
        }}
      >
        <Star style={{ width: 11, height: 11, fill: C.orange, color: C.orange }} /> {avgRating}
      </div>
    );
  }

  function VerifiedBadge() {
    if (!isVerified) return null;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 600,
          color: C.success,
          background: C.successLight,
          borderRadius: 20,
          padding: "3px 8px",
        }}
      >
        <ShieldCheck style={{ width: 11, height: 11 }} /> EventLink verified
      </div>
    );
  }

  // ── detail panel content ──
  function renderDetail(type: Detail) {
    if (type === "about") {
      return (
        <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>
          <p>{freelancer.bio || "No bio available."}</p>
          {(freelancer.location || freelancer.country) && (
            <p style={{ marginTop: 10, color: C.text3, fontSize: 11 }}>
              📍 {[freelancer.location, freelancer.country].filter(Boolean).join(", ")}
            </p>
          )}
          <p style={{ marginTop: 8, fontSize: 11, color: C.text3 }}>{availLabel}</p>
        </div>
      );
    }
    if (type === "credentials") {
      return (
        <div>
          {isVerified && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 0",
                borderBottom: "1px solid #f4f4f8",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: C.successLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck style={{ width: 14, height: 14, color: C.success }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>
                  EventLink verified
                </div>
                <div style={{ fontSize: 10, color: "#999" }}>
                  {(references as any[]).length} reference
                  {(references as any[]).length !== 1 ? "s" : ""} received
                </div>
              </div>
            </div>
          )}
          {(references as any[]).slice(0, 4).map((ref: any, i: number) => (
            <div
              key={ref.id ?? i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 0",
                borderBottom: "1px solid #f4f4f8",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: C.purpleLight,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Award style={{ width: 14, height: 14, color: C.purple }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>
                  {ref.referee_name || "Reference"}
                </div>
                <div style={{ fontSize: 10, color: "#999" }}>
                  {ref.referee_organisation || ref.badge_result?.replace(/_/g, " ") || ""}
                </div>
              </div>
            </div>
          ))}
          {(references as any[]).length === 0 && !isVerified && (
            <p style={{ fontSize: 12, color: C.text3 }}>No credentials added yet.</p>
          )}
        </div>
      );
    }
    if (type === "portfolio") {
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(portfolio as any[]).length === 0 && (
            <p style={{ fontSize: 12, color: C.text3, gridColumn: "1/-1" }}>
              No portfolio items yet.
            </p>
          )}
          {(portfolio as any[]).slice(0, 4).map((item: any) => {
            const emoji = item.type === "photo" ? "🖼️" : item.type === "video" ? "🎬" : "📝";
            const bg =
              item.type === "photo" ? "#fef3e8" : item.type === "video" ? C.purpleLight : "#edf7ed";
            const typeColor =
              item.type === "photo" ? C.orange : item.type === "video" ? C.purple : C.success;
            return (
              <div
                key={item.id}
                style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #eee" }}
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    style={{ width: "100%", height: 52, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      height: 52,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {emoji}
                  </div>
                )}
                <div style={{ padding: "5px 7px" }}>
                  <div
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      fontWeight: 600,
                      color: typeColor,
                      marginBottom: 1,
                    }}
                  >
                    {item.type}
                  </div>
                  <div style={{ fontSize: 10, color: "#333", fontWeight: 500 }}>
                    {item.title || "Untitled"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    if (type === "files") {
      type FileEntry = { name: string; sub: string; bg: string; iconColor: string; href: string };
      const files: FileEntry[] = [];
      if (freelancer.cv_file_url && freelancer.cv_file_name) {
        files.push({
          name: freelancer.cv_file_name,
          sub: "CV",
          bg: "#fee2e2",
          iconColor: "#dc2626",
          href: `/api/cv/download/${uid}${pt}`,
        });
      }
      (documents as any[]).forEach((doc: any) => {
        files.push({
          name: doc.file_name || doc.document_type || "Document",
          sub: doc.document_type?.replace(/_/g, " ") || "",
          bg: C.purpleLight,
          iconColor: C.purple,
          href: `/api/documents/${doc.id}/download${pt}`,
        });
      });
      return (
        <div>
          {files.length === 0 && (
            <p style={{ fontSize: 12, color: C.text3 }}>No files available.</p>
          )}
          {files.map((f, i) => (
            <a
              key={i}
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid #f4f4f8",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: f.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText style={{ width: 14, height: 14, color: f.iconColor }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>{f.name}</div>
                {f.sub && <div style={{ fontSize: 10, color: "#999" }}>{f.sub}</div>}
              </div>
              <Download style={{ width: 13, height: 13, color: "#bbb" }} />
            </a>
          ))}
        </div>
      );
    }
    return null;
  }

  // Section button used on card back
  function SectionBtn({
    id,
    icon,
    iconBg,
    label,
    sub,
  }: {
    id: Detail;
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    sub: string;
  }) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setDetail(id);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: C.bg2,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "10px 11px",
          marginBottom: 7,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>{label}</span>
          <span style={{ fontSize: 10, color: "#888" }}>{sub}</span>
        </div>
        <ChevronRight style={{ marginLeft: "auto", width: 13, height: 13, color: "#bbb" }} />
      </div>
    );
  }

  // ── D-ROW (desktop content row) ──
  function DRow({
    iconBg,
    icon,
    label,
    sub,
    href,
    action,
  }: {
    iconBg: string;
    icon: React.ReactNode;
    label: string;
    sub?: string;
    href?: string;
    action?: React.ReactNode;
  }) {
    const inner = (
      <>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{sub}</div>}
        </div>
        {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
      </>
    );
    const row = {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      marginBottom: 8,
      background: C.bg2,
    } as React.CSSProperties;
    if (href)
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...row, textDecoration: "none" }}
        >
          {inner}
        </a>
      );
    return <div style={row}>{inner}</div>;
  }

  const DETAIL_PANELS: Detail[] = ["about", "credentials", "portfolio", "files"];

  return (
    <div
      style={{
        background: C.bg3,
        minHeight: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: "white",
          borderBottom: `1px solid ${C.border}`,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, color: C.orange, fontSize: 16, letterSpacing: "-0.3px" }}>
          EventLink
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["card", "wallet"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: view === v ? C.orange : "transparent",
                color: view === v ? "white" : C.text2,
              }}
            >
              {v === "card" ? "Card" : "Wallet"}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════ CARD VIEW ══════════════ */}
      {view === "card" && (
        <>
          {/* ── MOBILE (hidden on md+) ── */}
          <div className="md:hidden">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px 16px 32px",
              }}
            >
              {/* Card scene */}
              <div
                onClick={() => {
                  if (!detail) setFlipped((f) => !f);
                }}
                style={{
                  width: "min(340px, calc(100vw - 32px))",
                  height: "min(566px, calc((100vw - 32px) * 1.665))",
                  perspective: 1000,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transition: "transform 0.6s cubic-bezier(.4,0,.2,1)",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* FRONT */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      background: "#fff",
                      border: "1px solid #e0e0e8",
                      borderRadius: 18,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "16px 14px 12px",
                    }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "1.5px solid #ccc",
                        background: C.bg3,
                        marginBottom: 10,
                      }}
                    />
                    <div style={{ marginBottom: 8 }}>
                      <Avatar size={64} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 1 }}>
                      {fullName}
                    </div>
                    <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>
                      {freelancer.title || "Freelancer"}
                    </div>
                    <RatingPill />
                    <div
                      style={{ width: "100%", height: 1, background: "#f0f0f4", margin: "8px 0" }}
                    />
                    <VerifiedBadge />
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        justifyContent: "center",
                        margin: "8px 0",
                      }}
                    >
                      {skills.slice(0, 5).map((s) => (
                        <SkillPill key={s} label={s} />
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: "auto",
                        fontSize: 10,
                        color: "#aaa",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <MapPin style={{ width: 11, height: 11 }} />{" "}
                      {[freelancer.location, freelancer.country].filter(Boolean).join(", ") || "–"}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.orange,
                        letterSpacing: "-0.3px",
                        marginTop: 5,
                      }}
                    >
                      EventLink
                    </div>
                  </div>

                  {/* BACK */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      background: "#fff",
                      border: "1px solid #e0e0e8",
                      borderRadius: 18,
                      transform: "rotateY(180deg)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Main back content */}
                    <div
                      style={{
                        padding: "14px 12px",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
                      >
                        <Avatar size={32} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
                            {fullName}
                          </div>
                          <div style={{ fontSize: 10, color: "#888" }}>
                            {freelancer.title || "Freelancer"}
                          </div>
                        </div>
                      </div>

                      <SectionBtn
                        id="about"
                        icon={<User style={{ width: 15, height: 15, color: C.orange }} />}
                        iconBg={C.orangeLight}
                        label="About"
                        sub="Overview & intro"
                      />
                      <SectionBtn
                        id="credentials"
                        icon={<ShieldCheck style={{ width: 15, height: 15, color: C.success }} />}
                        iconBg={C.successLight}
                        label="Credentials"
                        sub="Verified & endorsed"
                      />
                      <SectionBtn
                        id="portfolio"
                        icon={<LayoutGrid style={{ width: 15, height: 15, color: C.purple }} />}
                        iconBg={C.purpleLight}
                        label="Portfolio"
                        sub="Photos, reels & blog"
                      />
                      <SectionBtn
                        id="files"
                        icon={<FileText style={{ width: 15, height: 15, color: "#7060c0" }} />}
                        iconBg="#f0f0f8"
                        label="Files"
                        sub="CV & documents"
                      />

                      {/* Action bar */}
                      <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 10 }}>
                        {[
                          {
                            icon: <Share2 style={{ width: 14, height: 14 }} />,
                            label: "Share",
                            primary: true,
                            onClick: (e: React.MouseEvent) => {
                              e.stopPropagation();
                              copyLink();
                            },
                          },
                          {
                            icon: <span style={{ fontSize: 14 }}>💳</span>,
                            label: "Wallet",
                            primary: false,
                            onClick: (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setView("wallet");
                            },
                          },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            onClick={btn.onClick}
                            style={{
                              flex: 1,
                              padding: "8px 4px",
                              border: `1px solid ${C.border2}`,
                              background: btn.primary ? C.orange : C.bg2,
                              borderRadius: 8,
                              fontSize: 10,
                              color: btn.primary ? "#fff" : "#444",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 3,
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            {btn.icon} {btn.label}
                          </button>
                        ))}
                        <a
                          href={profileUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            padding: "8px 4px",
                            border: `1px solid ${C.border2}`,
                            background: C.bg2,
                            borderRadius: 8,
                            fontSize: 10,
                            color: "#444",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            fontWeight: 500,
                            textDecoration: "none",
                          }}
                        >
                          <Globe style={{ width: 14, height: 14 }} /> Profile
                        </a>
                      </div>
                    </div>

                    {/* Sliding detail panels */}
                    {DETAIL_PANELS.map((panelId) => (
                      <div
                        key={panelId}
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "#fff",
                          borderRadius: 18,
                          padding: "12px 12px 10px",
                          overflow: "hidden",
                          transform: detail === panelId ? "translateX(0)" : "translateX(100%)",
                          transition: "transform 0.3s ease",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "none",
                            border: "none",
                            fontSize: 11,
                            color: C.orange,
                            fontWeight: 600,
                            cursor: "pointer",
                            marginBottom: 10,
                            padding: 0,
                          }}
                        >
                          <ChevronLeft style={{ width: 13, height: 13 }} /> Back
                        </button>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#111",
                            marginBottom: 10,
                            paddingBottom: 8,
                            borderBottom: "1px solid #f0f0f4",
                          }}
                        >
                          {panelId!.charAt(0).toUpperCase() + panelId!.slice(1)}
                        </div>
                        <div style={{ flex: 1, overflowY: "auto" }}>{renderDetail(panelId)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p style={{ marginTop: 10, fontSize: 11, color: C.text3, textAlign: "center" }}>
                {flipped ? "Tap a section to open · tap card to flip back" : "Tap card to flip"}
              </p>
            </div>
          </div>

          {/* ── DESKTOP (hidden on mobile) ── */}
          <div className="hidden md:block">
            <div
              style={{
                maxWidth: 760,
                margin: "0 auto",
                padding: "24px 20px",
                display: "flex",
                gap: 16,
                minHeight: 420,
              }}
            >
              {/* Left identity column */}
              <div
                style={{
                  width: 210,
                  flexShrink: 0,
                  background: "#fff",
                  border: `1px solid ${C.border2}`,
                  borderRadius: 14,
                  padding: "20px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Avatar size={72} />
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#111",
                    margin: "10px 0 3px",
                    textAlign: "center",
                  }}
                >
                  {fullName}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 10, textAlign: "center" }}>
                  {freelancer.title || "Freelancer"}
                </div>
                <RatingPill />
                <div style={{ margin: "8px 0" }}>
                  <VerifiedBadge />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {skills.slice(0, 6).map((s) => (
                    <SkillPill key={s} label={s} />
                  ))}
                </div>
                <div
                  style={{ width: "100%", height: 1, background: "#f0f0f4", margin: "6px 0 10px" }}
                />
                <div
                  style={{
                    marginTop: "auto",
                    fontSize: 10,
                    color: "#bbb",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <MapPin style={{ width: 11, height: 11 }} />{" "}
                  {[freelancer.location, freelancer.country].filter(Boolean).join(", ") || "–"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.orange,
                    letterSpacing: "-0.3px",
                    marginTop: 8,
                  }}
                >
                  EventLink
                </div>
              </div>

              {/* Right tabbed panel */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {/* Tabs */}
                <div
                  style={{
                    display: "flex",
                    borderBottom: `1px solid ${C.border}`,
                    marginBottom: 14,
                  }}
                >
                  {(["about", "credentials", "portfolio", "files"] as RightTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      style={{
                        padding: "7px 14px",
                        fontSize: 12,
                        background: "none",
                        border: "none",
                        borderBottom: `2px solid ${rightTab === tab ? C.orange : "transparent"}`,
                        cursor: "pointer",
                        color: rightTab === tab ? C.orange : C.text2,
                        fontWeight: rightTab === tab ? 700 : 500,
                        marginBottom: -1,
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div>
                  {rightTab === "about" && (
                    <div>
                      <p
                        style={{
                          fontSize: 13,
                          color: C.text2,
                          lineHeight: 1.7,
                          paddingBottom: 12,
                        }}
                      >
                        {freelancer.bio || "No bio available."}
                      </p>
                      <DRow
                        iconBg={C.orangeLight}
                        icon={<MapPin style={{ width: 15, height: 15, color: C.orange }} />}
                        label={
                          [freelancer.location, freelancer.country].filter(Boolean).join(", ") ||
                          "–"
                        }
                        sub="Open to remote"
                      />
                      <DRow
                        iconBg={C.successLight}
                        icon={<User style={{ width: 15, height: 15, color: C.success }} />}
                        label={availLabel}
                        sub={
                          freelancer.experience_years
                            ? `${freelancer.experience_years} years experience`
                            : undefined
                        }
                      />
                    </div>
                  )}

                  {rightTab === "credentials" && (
                    <div>
                      {isVerified && (
                        <DRow
                          iconBg={C.successLight}
                          icon={<ShieldCheck style={{ width: 15, height: 15, color: C.success }} />}
                          label="EventLink verified"
                          sub={`${(references as any[]).length} reference${(references as any[]).length !== 1 ? "s" : ""} received`}
                        />
                      )}
                      {(references as any[]).slice(0, 4).map((ref: any, i: number) => (
                        <DRow
                          key={ref.id ?? i}
                          iconBg={C.purpleLight}
                          icon={<Award style={{ width: 15, height: 15, color: C.purple }} />}
                          label={ref.referee_name || "Reference"}
                          sub={ref.referee_organisation || ref.badge_result?.replace(/_/g, " ")}
                        />
                      ))}
                      {(references as any[]).length === 0 && !isVerified && (
                        <p style={{ fontSize: 13, color: C.text3 }}>No credentials yet.</p>
                      )}
                    </div>
                  )}

                  {rightTab === "portfolio" && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                      {(portfolio as any[]).length === 0 && (
                        <p style={{ fontSize: 13, color: C.text3, gridColumn: "1/-1" }}>
                          No portfolio items yet.
                        </p>
                      )}
                      {(portfolio as any[]).map((item: any) => {
                        const emoji =
                          item.type === "photo" ? "🖼️" : item.type === "video" ? "🎬" : "📝";
                        const bg =
                          item.type === "photo"
                            ? "#fef3e8"
                            : item.type === "video"
                              ? C.purpleLight
                              : "#edf7ed";
                        const typeColor =
                          item.type === "photo"
                            ? C.orange
                            : item.type === "video"
                              ? C.purple
                              : C.success;
                        return (
                          <div
                            key={item.id}
                            style={{
                              border: `1px solid ${C.border}`,
                              borderRadius: 8,
                              overflow: "hidden",
                            }}
                          >
                            {item.thumbnail_url ? (
                              <img
                                src={item.thumbnail_url}
                                alt={item.title}
                                style={{ width: "100%", height: 72, objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 72,
                                  background: bg,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 28,
                                }}
                              >
                                {emoji}
                              </div>
                            )}
                            <div style={{ padding: "6px 8px" }}>
                              <div
                                style={{
                                  fontSize: 9,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.6px",
                                  fontWeight: 700,
                                  color: typeColor,
                                  marginBottom: 2,
                                }}
                              >
                                {item.type}
                              </div>
                              <div style={{ fontSize: 11, color: "#333", fontWeight: 500 }}>
                                {item.title || "Untitled"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {rightTab === "files" && (
                    <div>
                      {freelancer.cv_file_url && (
                        <DRow
                          iconBg="#fee2e2"
                          icon={<FileText style={{ width: 15, height: 15, color: "#dc2626" }} />}
                          label={freelancer.cv_file_name || "CV"}
                          sub="CV"
                          href={`/api/cv/download/${uid}${pt}`}
                          action={<Download style={{ width: 14, height: 14, color: "#ccc" }} />}
                        />
                      )}
                      {(documents as any[]).map((doc: any) => (
                        <DRow
                          key={doc.id}
                          iconBg={C.purpleLight}
                          icon={<FileText style={{ width: 15, height: 15, color: C.purple }} />}
                          label={doc.file_name || doc.document_type || "Document"}
                          sub={doc.document_type?.replace(/_/g, " ")}
                          href={`/api/documents/${doc.id}/download${pt}`}
                          action={<Download style={{ width: 14, height: 14, color: "#ccc" }} />}
                        />
                      ))}
                      {!freelancer.cv_file_url && (documents as any[]).length === 0 && (
                        <p style={{ fontSize: 13, color: C.text3 }}>No files available.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ WALLET VIEW ══════════════ */}
      {view === "wallet" && (
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px" }}>
          <div
            style={{
              background: C.bg2,
              borderRadius: 14,
              padding: 20,
              border: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.text2,
                marginBottom: 14,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Digital pass preview
            </div>

            {/* Pass card */}
            <div
              style={{
                background: "#fff",
                borderRadius: 18,
                padding: 18,
                maxWidth: 360,
                margin: "0 auto 18px",
                border: "1px solid #e0e0e8",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 160,
                  height: "100%",
                  background:
                    "linear-gradient(135deg,rgba(120,80,220,0.07) 0%,rgba(255,140,0,0.06) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: C.orange }}>EventLink</span>
                <span style={{ fontSize: 10, color: "#bbb", fontWeight: 500 }}>
                  Professional Pass
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <Avatar size={52} />
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>{fullName}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 1 }}>
                    {freelancer.title || "Freelancer"}
                    {freelancer.location ? ` · ${freelancer.location}` : ""}
                  </div>
                  {avgRating && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: C.orangeLight,
                        borderRadius: 20,
                        padding: "2px 9px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.orange,
                        marginTop: 4,
                      }}
                    >
                      ★ {avgRating}
                      {isVerified ? " · ✓ Verified" : ""}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
                {skills.slice(0, 5).map((s) => (
                  <SkillPill key={s} label={s} style={{ fontSize: 9, padding: "2px 8px" }} />
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginBottom: 14,
                  paddingTop: 12,
                  borderTop: "1px solid #f0f0f4",
                }}
              >
                {[
                  {
                    label: "Rating",
                    value: avgRating ? `★ ${avgRating}` : "–",
                  },
                  {
                    label: "Available",
                    value: avail === "available" ? "Now" : avail === "busy" ? "Busy" : "No",
                  },
                  { label: "Verified", value: isVerified ? "✓ Yes" : "–" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <label
                      style={{
                        fontSize: 9,
                        textTransform: "uppercase",
                        color: "#bbb",
                        letterSpacing: "0.8px",
                        display: "block",
                        marginBottom: 3,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{value}</span>
                  </div>
                ))}
              </div>
              {/* Barcode strip */}
              <div
                style={{
                  height: 42,
                  background:
                    "repeating-linear-gradient(90deg,rgba(0,0,0,0.04) 0px,rgba(0,0,0,0.04) 2px,transparent 2px,transparent 8px)",
                  borderRadius: 6,
                  border: "1px solid #eee",
                }}
              />
            </div>

            {/* QR code — only shown on desktop (on mobile you can't scan your own screen) */}
            {qrUrl && (
              <div className="hidden md:block" style={{ textAlign: "center", marginBottom: 16 }}>
                <img
                  src={qrUrl}
                  alt="QR code"
                  style={{ width: 120, height: 120, borderRadius: 8, border: "1px solid #eee" }}
                />
              </div>
            )}

            {/* Action rows */}
            <div style={{ maxWidth: 360, margin: "0 auto" }}>
              {/* Save to device */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  margin: "14px 0 8px",
                }}
              >
                Save to device
              </div>
              {[
                {
                  emoji: "🍎",
                  bg: "#f3f4f6",
                  label: "Add to Apple Wallet",
                  sub: "Coming soon",
                },
                {
                  emoji: "🤖",
                  bg: "#e8f5e9",
                  label: "Add to Google Wallet",
                  sub: "Coming soon",
                },
              ].map(({ emoji, bg, label, sub }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    marginBottom: 8,
                    background: "#fafafa",
                    cursor: "default",
                    opacity: 0.6,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    {emoji}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{sub}</div>
                  </div>
                  <ChevronRight
                    style={{ marginLeft: "auto", width: 14, height: 14, color: "#ccc" }}
                  />
                </div>
              ))}

              {/* Offline export */}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  margin: "14px 0 8px",
                }}
              >
                Offline export
              </div>
              <div
                onClick={downloadQR}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  border: `1px solid ${C.border2}`,
                  borderRadius: 8,
                  marginBottom: 8,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: C.purpleLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Download style={{ width: 18, height: 18, color: C.purple }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                    Download QR code
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>
                    Links to your live profile
                  </div>
                </div>
                <Download style={{ marginLeft: "auto", width: 14, height: 14, color: "#ccc" }} />
              </div>
              <div
                onClick={copyLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  border: `1px solid ${C.border2}`,
                  borderRadius: 8,
                  marginBottom: 8,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: C.orangeLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Share2 style={{ width: 18, height: 18, color: C.orange }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                    Share profile link
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#888",
                      marginTop: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {profileUrl()}
                  </div>
                </div>
                {copied ? (
                  <Check style={{ marginLeft: "auto", width: 14, height: 14, color: C.success }} />
                ) : (
                  <Copy style={{ marginLeft: "auto", width: 14, height: 14, color: "#ccc" }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
