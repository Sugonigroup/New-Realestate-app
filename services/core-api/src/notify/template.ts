/** Template rendering — strict {{var}} substitution; missing variables are errors, never blank. */

const VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function templateVariables(body: string): string[] {
  return [...body.matchAll(VAR_PATTERN)].map((m) => m[1]!);
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function renderTemplate(body: string, vars: Record<string, string | number>): string {
  const required = templateVariables(body);
  const missing = required.filter((k) => vars[k] === undefined);
  if (missing.length) {
    throw new TemplateError(`missing template variables: ${missing.join(", ")}`);
  }
  return body.replace(VAR_PATTERN, (_, key: string) => String(vars[key]));
}
