export const formatRelativeTime = (dateString: string | Date) => {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  let diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) diffMs = 0;

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  if (diffYears < 5) return `${diffYears}y ago`;

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
