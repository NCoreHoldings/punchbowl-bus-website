import { Fragment, type ReactNode } from "react";

/**
 * Renders the small Markdown subset used in content files — headings (##),
 * bullet lists (- item), paragraphs, **bold** and [links](url) — as React
 * elements. Raw HTML is shown as text, never injected.
 */
export function SimpleMarkdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      const Tag = heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={blocks.length}>{inline(heading[2])}</Tag>);
    } else if (bullet) {
      if (para.length) flush();
      list.push(bullet[1]);
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return <>{blocks}</>;
}

const SAFE_URL = /^(https:\/\/|mailto:|tel:|\/(?!\/))/;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={out.length}>{m[1]}</strong>);
    else if (SAFE_URL.test(m[3])) {
      const external = m[3].startsWith("https://");
      out.push(
        <a
          key={out.length}
          href={m[3]}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {m[2]}
        </a>,
      );
    } else out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}
