import { cx } from "@/components/ui";

/**
 * Tiny, safe markdown renderer for copilot output: escapes all HTML first,
 * then supports headings, bold/italic/code, bullet lists, tables and <sub>.
 */
export function renderMarkdown(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/g, "<sub>$1</sub>");
  const lines = esc.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const cells = (l: string) =>
        l
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(":") ? ' class="r"' : ""));
      const head = cells(line)
        .map((c, j) => `<th${align[j] ?? ""}>${inline(c)}</th>`)
        .join("");
      i += 2;
      const body: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        body.push(
          `<tr>${cells(lines[i])
            .map((c, j) => `<td${align[j] ?? ""}>${inline(c)}</td>`)
            .join("")}</tr>`,
        );
        i++;
      }
      out.push(`<div class="scroll-thin overflow-x-auto"><table><thead><tr>${head}</tr></thead><tbody>${body.join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && /^\s*[-*] /.test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(/^\s*[-*] /, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\. /.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && /^\s*\d+\. /.test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(/^\s*\d+\. /, ""))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) out.push(`<h3>${inline(h[2])}</h3>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return out.join("");
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={cx("prose-lathe text-[13.5px] leading-relaxed", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}
