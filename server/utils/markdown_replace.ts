export function replaceLinks(content: string, nodeToken: string, newLink?: string): string {
  if (!newLink) return content;

  const htmlRe = new RegExp(
    `((src|href)=["|'])(http[s]?:\\/\\/[\\w]+\\.(feishu\\.cn|larksuite\\.com)\\/.*)?(${nodeToken}[^"']*)("|')`,
    "gm",
  );
  content = content.replace(htmlRe, `$1${newLink}$6`);

  const mdRe = new RegExp(
    `(\\]\\()(http[s]?:\\/\\/[\\w]+\\.(feishu\\.cn|larksuite\\.com)\\/.*)?(${nodeToken}[^\\)]*)(\\))`,
    "gm",
  );
  content = content.replace(mdRe, `$1${newLink}$5`);

  return content;
}

export type UrlMapping = { from: string; to: string };

export function applyUrlMappings(markdown: string, mappings: UrlMapping[]): string {
  const sorted = mappings.slice().sort((a, b) => b.from.length - a.from.length);
  let replaced = markdown ?? "";
  for (const m of sorted) {
    replaced = replaceLinks(replaced, m.from, m.to);
  }
  return replaced;
}
