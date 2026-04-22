import type * as Monaco from 'monaco-editor'

interface EditorRef {
  current: Monaco.editor.IStandaloneCodeEditor | null
}

export const editorRef: EditorRef = { current: null }

export function applyToEditor(latex: string, mode: 'insert' | 'append' = 'insert') {
  const editor = editorRef.current
  if (!editor) return false

  const model = editor.getModel()
  if (!model) return false

  if (mode === 'append') {
    const lastLine = model.getLineCount()
    const lastCol = model.getLineMaxColumn(lastLine)
    const text = '\n\n' + latex
    editor.executeEdits('chat-apply', [{
      range: { startLineNumber: lastLine, startColumn: lastCol, endLineNumber: lastLine, endColumn: lastCol },
      text,
    }])
    editor.revealLine(model.getLineCount())
    return true
  }

  // Insert at current cursor position
  const selection = editor.getSelection()
  if (!selection) return false

  editor.executeEdits('chat-apply', [{
    range: selection,
    text: latex,
  }])
  editor.focus()
  return true
}
