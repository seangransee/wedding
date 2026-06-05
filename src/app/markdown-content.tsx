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
  emphasizeHeadings?: boolean;
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
        className="font-semibold text-[#f1b3c6] underline decoration-dashed decoration-1 underline-offset-4 transition hover:text-[#ffd86e]"
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

function renderNodes(
  nodes: MarkdownNode[],
  lockedBlocks: boolean,
  emphasizeHeadings: boolean,
): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "heading":
        if (node.level === 1) {
          return (
            <h2
              key={index}
              className="text-center text-4xl font-semibold leading-tight text-[#ffd86e] sm:text-6xl"
            >
              {renderInlineMarkdown(node.text)}
            </h2>
          );
        }

        if (node.level === 2) {
          return (
            <h3
              key={index}
              className={
                emphasizeHeadings
                  ? "border-y border-[#b8860b]/55 bg-[#fff6fa]/8 px-3 py-3 text-center text-base font-bold uppercase tracking-[0.2em] text-[#f1b3c6] shadow-[inset_0_1px_0_rgba(255,246,250,0.12)] first:mt-0 sm:px-5 sm:py-4 sm:text-lg sm:tracking-[0.24em]"
                  : "border-t border-[#b8860b]/40 pt-7 text-base font-semibold uppercase tracking-[0.18em] text-[#f1b3c6] first:border-t-0 first:pt-0 sm:pt-8 sm:text-lg sm:tracking-[0.22em]"
              }
            >
              {renderInlineMarkdown(node.text)}
            </h3>
          );
        }

        return (
          <h4
            key={index}
            className={
              emphasizeHeadings
                ? "border-l-4 border-[#b8860b] bg-[#fff6fa]/8 py-3 pl-4 pr-3 text-[1.7rem] font-semibold leading-tight text-[#ffd86e] shadow-[inset_0_1px_0_rgba(255,246,250,0.12)] sm:pl-5 sm:text-3xl"
                : "border-t border-[#b8860b]/35 pt-4 text-2xl font-semibold leading-tight text-[#ffd86e] first:border-t-0 first:pt-0 sm:text-3xl"
            }
          >
            {renderInlineMarkdown(node.text)}
          </h4>
        );

      case "paragraph":
        return (
          <p key={index} className="text-lg leading-[1.85] text-[#f1b3c6] sm:text-xl">
            {renderInlineMarkdown(node.text)}
          </p>
        );

      case "list":
        return (
          <ul
            key={index}
            className="grid gap-2 pl-5 text-lg leading-[1.8] text-[#f1b3c6] sm:text-xl"
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
            {renderNodes(node.children, lockedBlocks, emphasizeHeadings)}
          </div>
        );
    }
  });
}

export function MarkdownContent({
  fileName,
  emphasizeHeadings = false,
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
      className="relative z-10 mx-auto mt-12 max-w-5xl scroll-mt-28 sm:mt-16 lg:mt-20"
    >
      <article className="guest-panel-surface grid gap-6 rounded-lg border border-[#b8860b]/60 p-5 text-[#f1b3c6] sm:gap-7 sm:p-8 lg:p-10">
        <header className="grid gap-3 border-b border-[#b8860b]/45 pb-5 text-center sm:pb-6">
          {subtitle ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f1b3c6] sm:text-base sm:tracking-[0.26em]">
              {renderInlineMarkdown(subtitle.text)}
            </p>
          ) : null}
          {firstNode
            ? renderNodes([firstNode], lockedBlocks, emphasizeHeadings)
            : null}
        </header>
        <div className="grid gap-6">
          {renderNodes(bodyNodes, lockedBlocks, emphasizeHeadings)}
        </div>
      </article>
    </section>
  );
}
