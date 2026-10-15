/**
 * The answer an auditor gave, as text. Choice answers arrive as option labels
 * (`selected_option_texts`); written answers as `answer_text`.
 */
export function responseText(item: { answer_text?: string | null; selected_option_texts?: string[] | null } | null | undefined): string {
  if (!item) return "";
  const parts = [...(item.selected_option_texts || []).filter(Boolean)];
  const written = item.answer_text?.trim();
  return [parts.join(", "), written].filter(Boolean).join(" — ");
}
