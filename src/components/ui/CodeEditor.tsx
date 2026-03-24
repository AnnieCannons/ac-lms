"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { sql } from "@codemirror/lang-sql";
import type { CodeLanguage } from "@/data/quizzes";

const LANG_EXTENSIONS: Record<CodeLanguage, ReturnType<typeof javascript | typeof html | typeof css | typeof sql>[]> = {
  javascript: [javascript()],
  jsx: [javascript({ jsx: true })],
  html: [html()],
  css: [css()],
  sql: [sql()],
};

const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  jsx: "JSX",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
};

interface Props {
  value: string;
  onChange?: (val: string) => void;
  language?: CodeLanguage;
  editable?: boolean;
  className?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language = "javascript",
  editable = true,
  className,
}: Props) {
  const extensions = LANG_EXTENSIONS[language] ?? LANG_EXTENSIONS.javascript;
  const langLabel = LANG_LABELS[language] ?? language;

  if (!editable) {
    return (
      <figure
        aria-label={`Code example in ${langLabel}`}
        className={`rounded-lg overflow-hidden border border-border text-sm ${className ?? ""}`}
      >
        <div aria-hidden="true">
          <CodeMirror
            value={value}
            extensions={extensions}
            editable={false}
            theme="dark"
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              dropCursor: false,
              allowMultipleSelections: false,
              indentOnInput: false,
            }}
          />
        </div>
        <pre className="sr-only"><code>{value}</code></pre>
      </figure>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border border-border text-sm ${className ?? ""}`}>
      <CodeMirror
        value={value}
        extensions={extensions}
        editable={editable}
        onChange={editable ? onChange : undefined}
        theme="dark"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
        }}
      />
    </div>
  );
}
