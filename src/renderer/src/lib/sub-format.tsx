import React from 'react';

/**
 * Render subtitle cue text (SRT/VTT inline markup) as React nodes for the
 * video overlay. Supports <i>, <b>, <u> and <font color="…">; converts \n to
 * line breaks; strips unknown tags and ASS override blocks ({\…}). Builds real
 * React elements — never dangerouslySetInnerHTML.
 */

type Tag = { name: 'i' | 'b' | 'u' | 'font'; color?: string };
type ElNode = { tag: Tag; children: Node[] };
type Node = string | ElNode | { br: true };

const SUPPORTED = new Set(['i', 'b', 'u', 'font']);
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d.,\s%]+\))$/;

function parseOpenTag(raw: string): Tag | null {
  const m = raw.match(/^([a-zA-Z]+)/);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (!SUPPORTED.has(name)) return null;
  if (name === 'font') {
    const cm = raw.match(/color\s*=\s*["']?([^"'\s>]+)/i);
    const color = cm?.[1];
    return { name: 'font', color: color && COLOR_RE.test(color) ? color : undefined };
  }
  return { name: name as Tag['name'] };
}

function buildTree(input: string): Node[] {
  // Drop ASS override blocks like {\an8} or {\i1}.
  const text = input.replace(/\{[^}]*\}/g, '');
  const root: Node[] = [];
  const stack: { tag: Tag | null; children: Node[] }[] = [{ tag: null, children: root }];
  const tagRe = /<(\/?)([^>]+)>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (s: string): void => {
    if (!s) return;
    const top = stack[stack.length - 1].children;
    const parts = s.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) top.push({ br: true });
      if (p) top.push(p);
    });
  };

  while ((m = tagRe.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === '/';
    if (closing) {
      const name = m[2]
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, '');
      // Pop to the nearest matching open tag (auto-close mismatches).
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag?.name === name) {
          stack.length = i;
          break;
        }
      }
    } else {
      const tag = parseOpenTag(m[2].trim());
      if (tag) {
        const node: ElNode = { tag, children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push({ tag, children: node.children });
      }
      // Unknown tags are stripped (no node, no stack push).
    }
  }
  pushText(text.slice(last));
  return root;
}

function toReact(nodes: Node[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((n, i) => {
    const key = `${keyPrefix}-${i}`;
    if (typeof n === 'string') return <React.Fragment key={key}>{n}</React.Fragment>;
    if ('br' in n) return <br key={key} />;
    const inner = toReact(n.children, key);
    switch (n.tag.name) {
      case 'i':
        return <em key={key}>{inner}</em>;
      case 'b':
        return <strong key={key}>{inner}</strong>;
      case 'u':
        return (
          <span key={key} style={{ textDecoration: 'underline' }}>
            {inner}
          </span>
        );
      case 'font':
        return (
          <span key={key} style={n.tag.color ? { color: n.tag.color } : undefined}>
            {inner}
          </span>
        );
    }
  });
}

export function renderCueText(text: string): React.ReactNode {
  if (!text) return null;
  return toReact(buildTree(text), 'c');
}
