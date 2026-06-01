import type { ReactNode } from "react";
import { readFileSync } from "fs";
import path from "path";
import { LockedNotice } from "./locked-notice";

type MarkdownNode =
  | {
      type: "heading";
      level: number;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    }
  | {
      type: "rule";
    }
  | {
      type: "invitationOnly";
      title: string;
      children: MarkdownNode[];
    };

type MarkdownContentProps = {
  fileName: string;
  id: string;
  lockedBlocks?: boolean;
  subtitleFromFirstParagraph?: boolean;
};

const inviteOnlyStartPattern =
  /^<!--\s*invitation-only-start(?:\s+title="([^"]+)")?\s*-->\s*$/;
const inviteOnlyEndPattern = /^<!--\s*invitation-only-end\s*-->\s*$/;
const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

function readContentFile(fileName: string) {
  return readFileSync(path.join(process.cwd(), "content", fileName), "utf8");
}

function parseMarkdown(markdown: string): MarkdownNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const [nodes] = parseLines(lines, 0);

  return nodes;
}

function parseLines(
  lines: string[],
  startIndex: number,
): [MarkdownNode[], number] {
  const nodes: MarkdownNode[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (inviteOnlyEndPattern.test(line)) {
      return [nodes, index + 1];
    }

    const inviteOnlyStart = line.match(inviteOnlyStartPattern);

    if (inviteOnlyStart) {
      const [children, nextIndex] = parseLines(lines, index + 1);

      nodes.push({
        type: "invitationOnly",
        title: inviteOnlyStart[1] ?? "Invitation Details",
        children,
      });
      index = nextIndex;
      continue;
    }

    if (line === "---") {
      nodes.push({ type: "rule" });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      nodes.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      nodes.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const nextLine = lines[index].trim();

      if (
        !nextLine ||
        nextLine === "---" ||
        nextLine.startsWith("#") ||
        /^[-*]\s+/.test(nextLine) ||
        inviteOnlyStartPattern.test(nextLine) ||
        inviteOnlyEndPattern.test(nextLine)
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    nodes.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return [nodes, index];
}

function renderInlineMarkdown(text: string) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(linkPattern)) {
    const [fullMatch, label, url] = match;
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    parts.push(
      <a
        key={`${url}-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#054f2d] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#8f2448]"
      >
        {label}
      </a>,
    );

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderNodes(nodes: MarkdownNode[], lockedBlocks: boolean): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "heading":
        if (node.level === 1) {
          return (
            <h2
              key={index}
              className="text-center text-3xl font-semibold leading-tight text-[#054f2d] sm:text-5xl"
            >
              {renderInlineMarkdown(node.text)}
            </h2>
          );
        }

        if (node.level === 2) {
          return (
            <h3
              key={index}
              className="border-t border-[#b8860b]/35 pt-7 text-sm font-semibold uppercase tracking-[0.24em] text-[#8f2448] first:border-t-0 first:pt-0 sm:pt-8"
            >
              {renderInlineMarkdown(node.text)}
            </h3>
          );
        }

        return (
          <h4
            key={index}
            className="border-t border-[#b8860b]/30 pt-4 text-xl font-semibold leading-tight text-[#054f2d] first:border-t-0 first:pt-0 sm:text-2xl"
          >
            {renderInlineMarkdown(node.text)}
          </h4>
        );

      case "paragraph":
        return (
          <p key={index} className="text-base leading-relaxed text-[#4a1f2e]/78">
            {renderInlineMarkdown(node.text)}
          </p>
        );

      case "list":
        return (
          <ul
            key={index}
            className="grid gap-1.5 pl-5 text-base leading-relaxed text-[#4a1f2e]/78"
          >
            {node.items.map((item) => (
              <li key={item} className="list-disc">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );

      case "rule":
        return (
          <hr key={index} className="border-t border-[#b8860b]/35" />
        );

      case "invitationOnly":
        if (lockedBlocks) {
          return (
            <div key={index} className="mt-1">
              <LockedNotice title={node.title}>
                Click the invitation link we sent you to view booking details.
              </LockedNotice>
            </div>
          );
        }

        return (
          <div key={index} className="grid gap-3">
            {renderNodes(node.children, lockedBlocks)}
          </div>
        );
    }
  });
}

export function MarkdownContent({
  fileName,
  id,
  lockedBlocks = false,
  subtitleFromFirstParagraph = false,
}: MarkdownContentProps) {
  const nodes = parseMarkdown(readContentFile(fileName));
  const [firstNode, ...remainingNodes] = nodes;
  const subtitle =
    subtitleFromFirstParagraph && remainingNodes[0]?.type === "paragraph"
      ? remainingNodes[0]
      : null;
  const bodyNodes = subtitle ? remainingNodes.slice(1) : remainingNodes;

  return (
    <section
      id={id}
      className="relative z-10 mx-auto mt-5 max-w-4xl scroll-mt-28 sm:mt-8"
    >
      <article className="grid gap-5 rounded-lg border border-[#b8860b]/45 bg-[#fff6fa]/90 p-5 text-[#4a1f2e] shadow-[0_24px_65px_-42px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:p-7 lg:p-9">
        <header className="grid gap-2 border-b border-[#b8860b]/35 pb-5 text-center">
          {subtitle ? (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8f2448] sm:text-sm">
              {renderInlineMarkdown(subtitle.text)}
            </p>
          ) : null}
          {firstNode ? renderNodes([firstNode], lockedBlocks) : null}
        </header>
        <div className="grid gap-5">{renderNodes(bodyNodes, lockedBlocks)}</div>
      </article>
    </section>
  );
}
