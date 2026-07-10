import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders Markdown as React elements. Raw HTML in the source is NOT rendered
 * (no rehype-raw), which is the XSS boundary for user content.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-noto text-sm leading-relaxed break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
