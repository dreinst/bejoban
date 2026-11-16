// Pengisi templat pesan: {variabel} diganti dari daftar. Variabel yang tidak dikenal menjadi kosong.
export const renderTemplate = (tpl: string, vars: Record<string, string | number | null | undefined>) =>
  tpl
    .replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const templateVars = (tpl: string) => [...new Set([...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
