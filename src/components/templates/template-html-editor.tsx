"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { templateBrowserPreviewDocument } from "@/lib/template-browser-preview";
import type { VisualEmailContent } from "./visual-email-editor";

const VisualEmailEditor = dynamic(
  () => import("./visual-email-editor").then((module) => module.VisualEmailEditor),
  {
    loading: () => <p className="field-help">Loading visual editor…</p>,
    ssr: false,
  },
);

type EditorMode = "html" | "visual";

type TemplateHtmlEditorProps = {
  defaultValue?: string;
  id: string;
  label?: string;
  placeholder?: string;
};

export function TemplateHtmlEditor({
  defaultValue = "",
  id,
  label = "HTML",
  placeholder,
}: TemplateHtmlEditorProps) {
  const [html, setHtml] = useState(defaultValue);
  // Existing HTML opens as source: the visual editor rebuilds markup and can
  // drop layout it does not model, so switching is an explicit choice.
  const [mode, setMode] = useState<EditorMode>(defaultValue ? "html" : "visual");
  const [visualContent, setVisualContent] = useState<string | VisualEmailContent>(defaultValue);
  const [visualKey, setVisualKey] = useState(0);
  // Re-parsing exported email HTML nests its wrapper tables, so reuse the
  // editor document while the HTML is still exactly what the editor produced.
  const lastVisual = useRef<{ html: string; json: VisualEmailContent } | null>(null);

  function switchMode(next: EditorMode) {
    if (next === mode) return;
    if (next === "visual") {
      setVisualContent(lastVisual.current?.html === html ? lastVisual.current.json : html);
      setVisualKey((key) => key + 1);
    }
    setMode(next);
  }

  function updateFromVisual(nextHtml: string, json: VisualEmailContent) {
    lastVisual.current = { html: nextHtml, json };
    setHtml(nextHtml);
  }

  return (
    <section className="template-html-workbench" aria-label={`${label} editor and live preview`}>
      <div className="field template-html-source">
        <div className="template-html-mode">
          <label htmlFor={mode === "html" ? id : undefined}>{label}</label>
          <div role="group" aria-label={`${label} editor mode`}>
            <button
              aria-pressed={mode === "visual"}
              className="btn btn-compact"
              onClick={() => switchMode("visual")}
              type="button"
            >
              Visual
            </button>
            <button
              aria-pressed={mode === "html"}
              className="btn btn-compact"
              onClick={() => switchMode("html")}
              type="button"
            >
              HTML
            </button>
          </div>
        </div>
        <input name="html" type="hidden" value={html} />
        {mode === "visual" ? (
          <>
            <VisualEmailEditor
              content={visualContent}
              key={visualKey}
              label={label}
              onChange={updateFromVisual}
            />
            <p className="field-help">
              Type <kbd>/</kbd> for blocks or drag them in. Variables such as{" "}
              <code>{"{{reader.name}}"}</code> work in text. Editing here
              replaces the HTML with the editor&apos;s email markup.
            </p>
          </>
        ) : (
          <>
            <textarea
              id={id}
              maxLength={2 * 1024 * 1024}
              onChange={(event) => setHtml(event.currentTarget.value)}
              placeholder={placeholder}
              rows={12}
              spellCheck={false}
              value={html}
            />
            <p className="field-help">
              Paste a complete email document or an HTML fragment. Inline styles and
              data images render; external requests and scripts stay blocked.
            </p>
          </>
        )}
      </div>

      <div className="template-html-preview">
        <header>
          <div>
            <strong>Browser preview</strong>
            <small>Sandboxed and updated as you type</small>
          </div>
          <span aria-label="Preview updates live">Live</span>
        </header>
        <iframe
          referrerPolicy="no-referrer"
          sandbox=""
          srcDoc={templateBrowserPreviewDocument(html, { showEmptyState: true })}
          title={`${label} browser preview`}
        />
      </div>
    </section>
  );
}
