import { MarkdownContent, MarkdownCopy } from "./markdown-content";
import { RegistryOptions } from "./registry-options";

export function RegistrySection() {
  return (
    <MarkdownContent id="registry" fileName="registry.md">
      <RegistryOptions
        amazonCopy={<MarkdownCopy fileName="registry-amazon.md" />}
        fundCopy={<MarkdownCopy fileName="registry-fund.md" />}
      />
    </MarkdownContent>
  );
}
