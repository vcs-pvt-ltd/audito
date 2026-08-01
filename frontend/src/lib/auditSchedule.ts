function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function dateValueKey(value?: string | Date | null) {
  if (!value) return "";

  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}

export function isPastAuditEndDate(endDate?: string | Date | null, today = new Date()) {
  const endDateKey = dateValueKey(endDate);
  return Boolean(endDateKey) && endDateKey < localDateKey(today);
}
