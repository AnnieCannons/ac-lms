import type { QuizQuestion } from '@/data/quizzes'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Convert `inline code` to <code> tags, escaping the inner content */
function processInlineCode(text: string): string {
  return text.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
}

function detectLang(hint: string): string {
  const h = hint.trim().toLowerCase()
  if (['js', 'javascript', 'ts', 'typescript'].includes(h)) return 'javascript'
  if (h === 'jsx') return 'jsx'
  if (h === 'html') return 'html'
  if (h === 'css') return 'css'
  if (h === 'sql') return 'sql'
  return 'javascript'
}

/**
 * Split raw text into question blocks.
 *
 * A new block begins when:
 *   1. A blank line appears (and the current block has content), OR
 *   2. A numbered question line (\d+[.)]) appears after content has already
 *      accumulated in the current block (handles no-blank-line numbered lists).
 *
 * Fenced code blocks are never split.
 */
function splitIntoBlocks(raw: string): string[][] {
  const lines = raw.split('\n')
  const blocks: string[][] = []
  let current: string[] = []
  let inCode = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inCode = !inCode
      current.push(line)
      continue
    }
    if (inCode) {
      current.push(line)
      continue
    }

    if (trimmed === '') {
      if (current.length > 0) { blocks.push(current); current = [] }
      continue
    }

    // Numbered question ("1. " / "1) ") while current block already has content
    if (/^\d+[.)]\s/.test(trimmed) && current.length > 0) {
      blocks.push(current)
      current = []
    }

    current.push(line)
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

/**
 * Parse a single question block into a QuizQuestion.
 *
 * Supports two choice formats within a block:
 *   - Labeled:   "a) Choice" / "a. Choice" → uses the letter as the ident
 *   - Unlabeled: any other non-blank line after the question text
 *
 * The first choice is ALWAYS the correct answer (choice_a).
 * If the first choice text is "true" or "false" → question_type = 'true_false'.
 * A fenced code block in the question text is extracted into code_snippet.
 */
function parseBlock(lines: string[], index: number): QuizQuestion | null {
  // ── 1. Extract fenced code blocks ────────────────────────────────────────
  let codeSnippet: string | undefined
  let codeLang: string | undefined
  const nonCodeLines: string[] = []
  let inCode = false
  let codeLines: string[] = []
  let codeLangHint = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (!inCode) {
        inCode = true
        codeLangHint = trimmed.slice(3).trim()
        codeLines = []
      } else {
        inCode = false
        codeSnippet = codeLines.join('\n').trimEnd()
        codeLang = detectLang(codeLangHint)
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }
    if (trimmed !== '') nonCodeLines.push(trimmed)
  }

  if (nonCodeLines.length === 0) return null

  // ── 2. Check for labeled choices (a) / a. style) ────────────────────────
  const hasLabels = nonCodeLines.some(l => /^[a-dA-D][.)]\s/.test(l))

  let questionLines: string[] = []
  let choices: Array<{ ident: string; text: string }> = []

  if (hasLabels) {
    // Labeled mode: question text = all lines before the first label
    for (const line of nonCodeLines) {
      const m = line.match(/^([a-dA-D])[.)]\s+(.+)/)
      if (m) {
        choices.push({ ident: `choice_${m[1].toLowerCase()}`, text: processInlineCode(m[2].trim()) })
      } else if (choices.length === 0) {
        // Strip leading question number if present
        questionLines.push(line.replace(/^\d+[.)]\s+/, ''))
      }
    }
  } else {
    // Unlabeled mode: first line = question (strip number if present), rest = choices
    const [first, ...rest] = nonCodeLines
    questionLines = [first.replace(/^\d+[.)]\s+/, '')]
    choices = rest
      .filter(l => l !== '')
      .map((text, i) => ({
        ident: `choice_${String.fromCharCode(97 + i)}`, // a, b, c, d…
        text: processInlineCode(text),
      }))
  }

  if (choices.length < 2) return null

  const questionText = processInlineCode(
    questionLines.join(' ').replace(/\s+/g, ' ').trim()
  )

  // First choice is always correct
  const correctIdent = choices[0].ident
  const firstChoiceText = choices[0].text.replace(/<[^>]*>/g, '').trim()
  const isTrueFalse = /^(true|false)$/i.test(firstChoiceText)

  const result: QuizQuestion = {
    ident: `q_${index}`,
    question_text: questionText,
    choices,
    correct_response_ident: correctIdent,
    question_type: isTrueFalse ? 'true_false' : 'multiple_choice',
  }

  if (codeSnippet !== undefined) {
    result.code_snippet = codeSnippet
    result.code_language = (codeLang ?? 'javascript') as QuizQuestion['code_language']
  }

  return result
}

export function parseQuizText(raw: string): QuizQuestion[] {
  const blocks = splitIntoBlocks(raw.trim())
  return blocks
    .map((block, i) => parseBlock(block, i + 1))
    .filter((q): q is QuizQuestion => q !== null)
}
