"use client";

import "@react-email/editor/themes/default.css";
import { EmailEditor, type EmailEditorRef } from "@react-email/editor";
import { defaultSlashCommands, type SlashCommandItem } from "@react-email/editor/ui";
import { useRef, useState, type DragEvent } from "react";

type Editor = NonNullable<EmailEditorRef["editor"]>;

const blockMimeType = "application/x-paperboy-block";

export type VisualEmailContent = ReturnType<EmailEditorRef["getJSON"]>;

type VisualEmailEditorProps = {
  content: string | VisualEmailContent;
  label: string;
  onChange: (html: string, json: VisualEmailContent) => void;
};

// Exported <style> blocks use minified CSS such as `{color:#c4c4c4}}`, which
// PaperBoy template syntax would read as a variable delimiter.
function separateCssBraces(html: string) {
  return html.replace(/<style\b[\s\S]*?<\/style>/gi, (style) =>
    style.replace(/{(?={)/g, "{ ").replace(/}(?=})/g, "} "),
  );
}

// Exported documents wrap the editor's container table in a body table. Drop
// that outer layer on import so the container is not nested inside itself.
function unwrapEmailDocument(html: string) {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const wrapper = body.firstElementChild;
  if (body.childElementCount !== 1 || !wrapper?.matches('table[role="presentation"]')) {
    return html;
  }
  const cell = wrapper.querySelector(":scope > tbody > tr > td");
  const container = cell?.firstElementChild;
  if (cell?.childElementCount !== 1 || !container?.matches('table[role="presentation"]')) {
    return html;
  }
  return cell.innerHTML;
}

// Slash commands turn the current line into a block. For the palette, reuse an
// empty line or open a new one before/after the target line so existing text
// is never split or converted. Returns the position inside that empty line.
function emptyLineAt(editor: Editor, position: number, clientY?: number) {
  const $pos = editor.state.doc.resolve(position);
  let depth = $pos.depth;
  while (depth > 0 && !$pos.node(depth).isTextblock) depth--;

  let at = position;
  if (depth > 0) {
    if ($pos.node(depth).content.size === 0) return $pos.start(depth);
    let after = true;
    const dom = editor.view.nodeDOM($pos.before(depth));
    if (clientY !== undefined && dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      after = clientY > rect.top + rect.height / 2;
    }
    at = after ? $pos.after(depth) : $pos.before(depth);
  }
  editor.chain().insertContentAt(at, { type: "paragraph" }).run();
  return at + 1;
}

function insertBlock(
  editor: Editor,
  item: SlashCommandItem,
  drop?: { clientY: number; position: number },
) {
  const at = emptyLineAt(
    editor,
    drop?.position ?? editor.state.selection.from,
    drop?.clientY,
  );
  editor.chain().focus().setTextSelection(at).run();
  item.command({ editor, range: { from: at, to: at } });
  // Tiptap restores focus on a later frame; focus now so fast typing lands here.
  editor.view.focus();
}

export function VisualEmailEditor({ content, label, onChange }: VisualEmailEditorProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const exportVersion = useRef(0);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(blockMimeType)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const index = event.dataTransfer.getData(blockMimeType);
    const item = defaultSlashCommands[Number(index)];
    if (!index || !item || !editor) return;
    event.preventDefault();
    event.stopPropagation();
    const position = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })?.pos;
    insertBlock(
      editor,
      item,
      position === undefined ? undefined : { clientY: event.clientY, position },
    );
  }

  return (
    <div className="visual-email-editor">
      <aside aria-label={`${label} blocks`} className="visual-email-blocks">
        <strong>Blocks</strong>
        <small>Drag into the email, or click to insert at the cursor.</small>
        <ul>
          {defaultSlashCommands.map((item, index) => (
            <li key={item.title}>
              <button
                disabled={!editor}
                draggable={Boolean(editor)}
                onClick={() => editor && insertBlock(editor, item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(blockMimeType, String(index));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                title={item.description}
                type="button"
              >
                {item.icon}
                <span>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div
        className="visual-email-canvas"
        onDragOverCapture={handleDragOver}
        onDropCapture={handleDrop}
      >
        <EmailEditor
          content={typeof content === "string" ? unwrapEmailDocument(content) : content}
          onReady={(ref) => setEditor(ref.editor)}
          onUpdate={async (ref) => {
            const version = ++exportVersion.current;
            const json = ref.getJSON();
            const html = separateCssBraces(await ref.getEmailHTML());
            if (version === exportVersion.current) onChange(html, json);
          }}
        />
      </div>
    </div>
  );
}
