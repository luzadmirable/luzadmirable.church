const LONG_DATE = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function longDate(value: Date): string {
  return LONG_DATE.format(value);
}
