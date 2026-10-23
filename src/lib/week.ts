// Monday of the week containing `now`, as YYYY-MM-DD in LOCAL time.
// (The old version called toISOString(), which converts to UTC and returned
// the previous Sunday for anyone ahead of UTC, such as IST.)
export function weekStart(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
