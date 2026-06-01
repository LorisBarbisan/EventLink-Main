const IR35_COLOURS: Record<string, { bg: string; text: string; label: string }> = {
  not_assessed: { bg: "#F3F4F6", text: "#6B7280", label: "Not assessed" },
  outside: { bg: "#D4EDDA", text: "#1A6B3C", label: "Outside IR35" },
  inside: { bg: "#FDECEA", text: "#DC2626", label: "Inside IR35" },
  undetermined: { bg: "#FFF3CD", text: "#856404", label: "Undetermined" },
};

interface Ir35StatusBadgeProps {
  status: string | null | undefined;
  showLabel?: boolean;
}

export function Ir35StatusBadge({ status, showLabel = true }: Ir35StatusBadgeProps) {
  if (!status || status === "not_assessed") return null;
  const colours = IR35_COLOURS[status] ?? IR35_COLOURS.not_assessed;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colours.bg, color: colours.text }}
    >
      {showLabel ? `IR35: ${colours.label}` : colours.label}
    </span>
  );
}

export { IR35_COLOURS };
