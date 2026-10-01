export function assignBatchWindow(job: { event_date?: string | null }): {
  window: "morning" | "afternoon" | null;
  isUrgent: boolean;
} {
  const nowUK = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
  const hour = nowUK.getHours();

  let window: "morning" | "afternoon" | null;
  if (hour >= 0 && hour < 9) {
    window = "morning";
  } else if (hour >= 9 && hour < 13) {
    window = "afternoon";
  } else {
    window = "morning"; // next day morning
  }

  let isUrgent = false;
  if (job.event_date) {
    const eventMs = new Date(job.event_date).getTime();
    const hoursUntilEvent = (eventMs - Date.now()) / 3_600_000;
    if (hoursUntilEvent >= 0 && hoursUntilEvent <= 48) {
      isUrgent = true;
      window = null;
    }
  }

  return { window, isUrgent };
}
