import { MarkdownRenderer } from './feishu_docx/index.ts';
import { Block, DocMetaInfo, CommonBlock } from './feishu_docx/types.ts';

export function docxBlocksToMarkdown(
  input: { document: { document_id: string }; blocks: Block[] }): {
    markdown: string; fileTokens: Record<string, CommonBlock>; meta: DocMetaInfo;
  } {
  const render = new MarkdownRenderer(input)
  const content = render.parse()
  return { markdown: content, fileTokens: render.fileTokens, meta: render.meta };
}
