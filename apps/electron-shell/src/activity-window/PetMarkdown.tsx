import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer" draggable={false}>{children}</a>
    : <span>{children}</span>,
  // Markdown 图片不属于用户主动交付的附件，不能触发隐式资源读取。
  img: ({ alt }) => <span>{alt || "图片"}</span>,
};

function webURL(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export const PetMarkdown = memo(function PetMarkdown({ text }: { text: string }) {
  return <Markdown remarkPlugins={plugins} components={components} urlTransform={webURL}>{text}</Markdown>;
});
