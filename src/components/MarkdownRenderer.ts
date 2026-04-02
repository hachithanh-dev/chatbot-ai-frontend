import { escapeHtml } from '../utils/formatter';

export function renderMarkdown(text: string): string {
  const parts: string[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderInlineMarkdown(text.slice(lastIndex, match.index)));
    }
    const lang = match[1] || 'text';
    const code = escapeHtml(match[2].trimEnd());
    const id = `code-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    parts.push(`
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-lang">${lang}</span>
          <button class="btn-copy" data-code-id="${id}" onclick="window.__copyCode('${id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
        </div>
        <pre><code id="${id}" class="lang-${lang}">${highlightSyntax(code, lang)}</code></pre>
      </div>
    `);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(renderInlineMarkdown(text.slice(lastIndex)));
  }

  return parts.join('');
}

function renderInlineMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      result.push(`<p>${inlineFormat(currentParagraph.join('<br>'))}</p>`);
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentListType) {
      result.push(`</${currentListType}>`);
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      flushList();
      const level = headerMatch[1].length;
      const content = headerMatch[2];
      result.push(`<h${level}>${inlineFormat(content)}</h${level}>`);
      continue;
    }

    // List items (Unordered)
    const ulMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (currentListType !== 'ul') {
        flushList();
        result.push('<ul>');
        currentListType = 'ul';
      }
      result.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // List items (Ordered)
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (currentListType !== 'ol') {
        flushList();
        result.push('<ol>');
        currentListType = 'ol';
      }
      result.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph line
    flushList();
    currentParagraph.push(line);
  }

  flushParagraph();
  flushList();

  return result.join('');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function highlightSyntax(code: string, lang: string): string {
  const keywords: Record<string, string[]> = {
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'String', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'null', 'true', 'false', 'var', 'record', 'enum', 'abstract', 'default', 'synchronized'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'default', 'from', 'class', 'extends', 'this', 'super', 'null', 'undefined', 'true', 'false', 'typeof', 'instanceof', 'async', 'await', 'yield', 'of', 'in', 'delete'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'default', 'from', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'this', 'super', 'null', 'undefined', 'true', 'false', 'typeof', 'instanceof', 'async', 'await', 'as', 'keyof', 'readonly'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'pass', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'del', 'global', 'nonlocal', 'assert', 'async', 'await', 'self'],
    html: ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'input', 'button', 'form', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', 'script', 'style', 'link', 'meta', 'title'],
    css: ['color', 'background', 'margin', 'padding', 'border', 'display', 'flex', 'grid', 'position', 'width', 'height', 'font', 'text', 'transform', 'transition', 'animation', 'opacity', 'overflow', 'z-index', 'box-shadow'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'SET', 'VALUES', 'INTO', 'NULL', 'IS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'],
  };

  const kws = keywords[lang] || keywords['javascript'] || [];
  let result = code;

  result = result.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="string">$&</span>');
  result = result.replace(/(\/\/[^\n]*)/g, '<span class="comment">$1</span>');
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');
  
  if (lang === 'python' || lang === 'bash' || lang === 'shell' || lang === 'sh') {
    result = result.replace(/(#[^\n]*)/g, '<span class="comment">$1</span>');
  }

  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>');

  if (kws.length > 0) {
    const kwRegex = new RegExp(`\\b(${kws.join('|')})\\b`, 'g');
    result = result.replace(kwRegex, (_, kw) => {
      return `<span class="keyword">${kw}</span>`;
    });
  }

  return result;
}

(window as any).__copyCode = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(`[data-code-id="${id}"]`);
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    }
  });
};
