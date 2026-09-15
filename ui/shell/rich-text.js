import { escapeHtml } from '../utils/escape-html.js';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'subheading', 'quote', 'list-item']);
const MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'code']);
const EMOJIS = ['😀','🙂','😊','😉','😍','🥰','😘','😎','🤍','❤️','👍','🙏','👏','✨','🔥','🎉','✅','💬','📌','✂️'];

function text(value = '') {
  return escapeHtml(String(value ?? ''));
}

function normalizeMarks(value) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item || '').trim().toLowerCase()).filter((item) => MARKS.has(item)))];
}

function normalizeSpans(value) {
  const source = Array.isArray(value) ? value : [];
  const spans = [];
  for (const raw of source) {
    const spanText = String(raw?.text ?? '').slice(0, 12000);
    if (!spanText) continue;
    const marks = normalizeMarks(raw?.marks);
    const previous = spans[spans.length - 1];
    if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) previous.text += spanText;
    else spans.push({ text: spanText, marks });
  }
  return spans;
}

export function normalizeRichText(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const blocks = [];
  for (const raw of Array.isArray(source.blocks) ? source.blocks.slice(0, 120) : []) {
    const type = BLOCK_TYPES.has(String(raw?.type || '')) ? String(raw.type) : 'paragraph';
    const spans = normalizeSpans(raw?.spans);
    if (!spans.length) continue;
    blocks.push({ type, spans });
  }
  return { version: 1, blocks };
}

export function richTextPlainText(value) {
  return normalizeRichText(value).blocks.map((block) => block.spans.map((span) => span.text).join('')).join('\n').trim();
}

function markedSpan(span = {}) {
  let value = text(span.text || '').replaceAll('\n', '<br>');
  const marks = normalizeMarks(span.marks);
  if (marks.includes('code')) value = `<code>${value}</code>`;
  if (marks.includes('strike')) value = `<s>${value}</s>`;
  if (marks.includes('underline')) value = `<u>${value}</u>`;
  if (marks.includes('italic')) value = `<em>${value}</em>`;
  if (marks.includes('bold')) value = `<strong>${value}</strong>`;
  return value;
}

export function renderRichText(value, fallback = '') {
  const documentValue = normalizeRichText(value);
  if (!documentValue.blocks.length) return text(fallback).replaceAll('\n', '<br>');
  return documentValue.blocks.map((block) => {
    const body = block.spans.map(markedSpan).join('');
    if (block.type === 'heading') return `<h3 class="message-rich__heading">${body}</h3>`;
    if (block.type === 'subheading') return `<h4 class="message-rich__subheading">${body}</h4>`;
    if (block.type === 'quote') return `<blockquote class="message-rich__quote">${body}</blockquote>`;
    if (block.type === 'list-item') return `<div class="message-rich__list-item"><span aria-hidden="true">•</span><div>${body}</div></div>`;
    return `<p class="message-rich__paragraph">${body}</p>`;
  }).join('');
}

export function richTextEditorMarkup({ placeholder = 'Написать сообщение...', value = null } = {}) {
  const initial = renderRichText(value || {}, '');
  return `<div class="message-rich-editor" data-rich-message-editor>
    <div class="message-rich-toolbar" role="toolbar" aria-label="Форматирование сообщения">
      <button type="button" data-rich-block="paragraph" aria-label="Обычный текст">Aa</button>
      <button type="button" data-rich-block="heading" aria-label="Заголовок">H1</button>
      <button type="button" data-rich-block="subheading" aria-label="Подзаголовок">H2</button>
      <button type="button" data-rich-mark="bold" aria-label="Жирный"><strong>B</strong></button>
      <button type="button" data-rich-mark="italic" aria-label="Курсив"><em>I</em></button>
      <button type="button" data-rich-mark="underline" aria-label="Подчеркнутый"><u>U</u></button>
      <button type="button" data-rich-mark="strike" aria-label="Зачеркнутый"><s>S</s></button>
      <button type="button" data-rich-block="quote" aria-label="Цитата">❞</button>
      <button type="button" data-rich-block="list-item" aria-label="Список">•</button>
      <button type="button" data-rich-emoji-toggle aria-label="Эмодзи">😊</button>
    </div>
    <div class="message-rich-emoji" data-rich-emoji-panel hidden>${EMOJIS.map((emoji) => `<button type="button" data-rich-emoji="${text(emoji)}" aria-label="${text(emoji)}">${text(emoji)}</button>`).join('')}</div>
    <div class="message-rich-editor__surface" contenteditable="true" role="textbox" aria-multiline="true" data-rich-surface data-placeholder="${text(placeholder)}">${initial}</div>
  </div>`;
}

function closestBlock(node, root) {
  let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (current && current !== root) {
    if (/^(P|DIV|H2|H3|H4|BLOCKQUOTE|LI)$/.test(current.tagName)) return current;
    current = current.parentElement;
  }
  return null;
}

function replaceBlockTag(block, tagName, root) {
  if (!block || block === root || block.tagName === tagName.toUpperCase()) return block;
  const replacement = document.createElement(tagName);
  while (block.firstChild) replacement.appendChild(block.firstChild);
  block.replaceWith(replacement);
  return replacement;
}

function blockTag(type) {
  if (type === 'heading') return 'h2';
  if (type === 'subheading') return 'h3';
  if (type === 'quote') return 'blockquote';
  if (type === 'list-item') return 'div';
  return 'p';
}

function markTag(mark) {
  if (mark === 'bold') return 'strong';
  if (mark === 'italic') return 'em';
  if (mark === 'underline') return 'u';
  if (mark === 'strike') return 's';
  if (mark === 'code') return 'code';
  return '';
}

function applyInlineMark(surface, mark) {
  const tagName = markTag(mark);
  if (!tagName) return;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!surface.contains(range.commonAncestorContainer)) return;
  if (range.collapsed) {
    const wrapper = document.createElement(tagName);
    const marker = document.createTextNode('\u200b');
    wrapper.appendChild(marker);
    range.insertNode(wrapper);
    const next = document.createRange();
    next.setStart(marker, 1);
    next.collapse(true);
    selection.removeAllRanges();
    selection.addRange(next);
    return;
  }
  const wrapper = document.createElement(tagName);
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
  const next = document.createRange();
  next.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(next);
}

function setBlock(surface, type) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!surface.contains(range.commonAncestorContainer)) return;
  const block = closestBlock(range.startContainer, surface);
  if (block) {
    const replacement = replaceBlockTag(block, blockTag(type), surface);
    replacement.dataset.richBlock = type;
    return;
  }
  const wrapper = document.createElement(blockTag(type));
  wrapper.dataset.richBlock = type;
  if (range.collapsed) wrapper.appendChild(document.createElement('br'));
  else wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);
}

function insertTextAtSelection(surface, value) {
  surface.focus();
  const selection = window.getSelection();
  if (!selection?.rangeCount || !surface.contains(selection.anchorNode)) {
    surface.appendChild(document.createTextNode(value));
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(value);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function marksForNode(node, surface) {
  const marks = [];
  let current = node.parentElement;
  while (current && current !== surface) {
    const tag = current.tagName;
    if ((tag === 'STRONG' || tag === 'B') && !marks.includes('bold')) marks.push('bold');
    if ((tag === 'EM' || tag === 'I') && !marks.includes('italic')) marks.push('italic');
    if (tag === 'U' && !marks.includes('underline')) marks.push('underline');
    if ((tag === 'S' || tag === 'STRIKE' || tag === 'DEL') && !marks.includes('strike')) marks.push('strike');
    if (tag === 'CODE' && !marks.includes('code')) marks.push('code');
    current = current.parentElement;
  }
  return marks;
}

function spansFromNode(root, surface) {
  const spans = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const spanText = String(node.nodeValue || '').replaceAll('\u200b', '');
      if (spanText) {
        const marks = marksForNode(node, surface);
        const previous = spans[spans.length - 1];
        if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) previous.text += spanText;
        else spans.push({ text: spanText, marks });
      }
    } else if (node !== root && node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      const previous = spans[spans.length - 1];
      if (previous) previous.text += '\n';
      else spans.push({ text: '\n', marks: [] });
    }
    node = walker.nextNode();
  }
  return normalizeSpans(spans);
}

function typeForBlock(node) {
  const explicit = String(node?.dataset?.richBlock || '');
  if (BLOCK_TYPES.has(explicit)) return explicit;
  const tag = node?.tagName || '';
  if (tag === 'H2') return 'heading';
  if (tag === 'H3' || tag === 'H4') return 'subheading';
  if (tag === 'BLOCKQUOTE') return 'quote';
  if (tag === 'LI') return 'list-item';
  return 'paragraph';
}

function documentFromSurface(surface) {
  const blocks = [];
  let inlineBuffer = [];
  const flushInline = () => {
    if (!inlineBuffer.length) return;
    const holder = document.createElement('div');
    inlineBuffer.forEach((node) => holder.appendChild(node.cloneNode(true)));
    const spans = spansFromNode(holder, surface);
    if (spans.length) blocks.push({ type: 'paragraph', spans });
    inlineBuffer = [];
  };
  for (const node of [...surface.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE || (node.nodeType === Node.ELEMENT_NODE && /^(STRONG|B|EM|I|U|S|STRIKE|DEL|CODE|SPAN|BR)$/.test(node.tagName))) {
      inlineBuffer.push(node);
      continue;
    }
    flushInline();
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const spans = spansFromNode(node, surface);
    if (spans.length) blocks.push({ type: typeForBlock(node), spans });
  }
  flushInline();
  return normalizeRichText({ version: 1, blocks });
}

export function bindRichTextEditor(form, { value = null } = {}) {
  const root = form?.querySelector('[data-rich-message-editor]');
  const surface = root?.querySelector('[data-rich-surface]');
  const emojiPanel = root?.querySelector('[data-rich-emoji-panel]');
  if (!root || !surface) return {
    getValue: () => ({ body: '', content: normalizeRichText(value || {}) }),
    focus: () => {},
  };

  if (value && normalizeRichText(value).blocks.length) surface.innerHTML = renderRichText(value);
  root.querySelectorAll('[data-rich-mark]').forEach((button) => button.addEventListener('click', () => {
    surface.focus();
    applyInlineMark(surface, String(button.dataset.richMark || ''));
  }));
  root.querySelectorAll('[data-rich-block]').forEach((button) => button.addEventListener('click', () => {
    surface.focus();
    setBlock(surface, String(button.dataset.richBlock || 'paragraph'));
  }));
  root.querySelector('[data-rich-emoji-toggle]')?.addEventListener('click', () => {
    if (emojiPanel) emojiPanel.hidden = !emojiPanel.hidden;
  });
  root.querySelectorAll('[data-rich-emoji]').forEach((button) => button.addEventListener('click', () => {
    insertTextAtSelection(surface, String(button.dataset.richEmoji || button.textContent || ''));
    if (emojiPanel) emojiPanel.hidden = true;
  }));
  surface.addEventListener('paste', (event) => {
    event.preventDefault();
    const valueText = event.clipboardData?.getData('text/plain') || '';
    insertTextAtSelection(surface, valueText);
  });

  return {
    getValue: () => {
      const content = documentFromSurface(surface);
      return { body: richTextPlainText(content), content };
    },
    setValue: (next) => { surface.innerHTML = renderRichText(next || {}); },
    focus: () => surface.focus(),
  };
}
