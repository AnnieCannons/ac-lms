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
 * If the text contains numbered questions (1. / 1) style), each numbered line
 * starts a new block regardless of blank lines — this keeps code blocks
 * (which may span blank lines) together with their question.
 *
 * If there are no numbered questions, falls back to blank-line splitting
 * (original behavior for the simple unlabeled format).
 *
 * Fenced code blocks are never split.
 */
function splitIntoBlocks(raw: string): string[][] {
  const lines = raw.split('\n')
  const hasNumberedQuestions = lines.some(l => /^\d+[.)]\s/.test(l.trim()))
  const blocks: string[][] = []
  let current: string[] = []
  let inFencedCode = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      inFencedCode = !inFencedCode
      current.push(line)
      continue
    }
    if (inFencedCode) {
      current.push(line)
      continue
    }

    if (hasNumberedQuestions) {
      // Split only on new numbered question lines — blank lines within a block are kept
      if (/^\d+[.)]\s/.test(trimmed) && current.length > 0) {
        blocks.push(current)
        current = []
      }
      current.push(line)
    } else {
      // Original behavior: split on blank lines
      if (trimmed === '') {
        if (current.length > 0) { blocks.push(current); current = [] }
        continue
      }
      if (/^\d+[.)]\s/.test(trimmed) && current.length > 0) {
        blocks.push(current)
        current = []
      }
      current.push(line)
    }
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

/**
 * Parse a single question block into a QuizQuestion.
 *
 * Supports two choice formats within a block:
 *   - Labeled:   "A) Choice" / "A. Choice" → uses the letter as the ident
 *   - Unlabeled: any other non-blank line after the question text
 *
 * In labeled mode:
 *   - An "Answer: B" line sets the correct response (otherwise first choice).
 *   - Any non-blank lines between the question text and the first choice are
 *     treated as an unfenced code block and extracted into code_snippet
 *     (indentation preserved).
 *
 * A fenced (```) code block is always extracted into code_snippet.
 * The first choice is correct by default (original behavior for unlabeled mode).
 * If the first choice text is "true" or "false" → question_type = 'true_false'.
 */
function parseBlock(lines: string[], index: number): QuizQuestion | null {
  // ── 1. Extract fenced code blocks ────────────────────────────────────────
  let codeSnippet: string | undefined
  let codeLang: string | undefined
  const processedLines: string[] = [] // original lines with fenced code removed
  let inFencedCode = false
  let fencedCodeLines: string[] = []
  let fencedLangHint = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (!inFencedCode) {
        inFencedCode = true
        fencedLangHint = trimmed.slice(3).trim()
        fencedCodeLines = []
      } else {
        inFencedCode = false
        codeSnippet = fencedCodeLines.join('\n').trimEnd()
        codeLang = detectLang(fencedLangHint)
      }
      continue
    }
    if (inFencedCode) { fencedCodeLines.push(line); continue }
    processedLines.push(line)
  }

  // ── 2. Check for labeled choices (A) / A. style) ─────────────────────────
  const hasLabels = processedLines.some(l => /^[a-dA-D][.)]\s/.test(l.trim()))

  if (hasLabels) {
    // Find where choices start
    const firstChoiceIdx = processedLines.findIndex(l => /^[a-dA-D][.)]\s/.test(l.trim()))
    const preChoiceLines = processedLines.slice(0, firstChoiceIdx)
    const choiceAndAfterLines = processedLines.slice(firstChoiceIdx)

    // Pre-choice non-blank entries: first = question text, rest = unfenced code block
    const nonBlankPre = preChoiceLines
      .map((line, idx) => ({ line, trimmed: line.trim(), idx }))
      .filter(x => x.trimmed !== '')

    if (nonBlankPre.length === 0) return null

    const questionText = processInlineCode(
      nonBlankPre[0].trimmed.replace(/^\d+[.)]\s+/, '')
    )

    // Extract unfenced code block (lines after question text, before first choice)
    if (!codeSnippet && nonBlankPre.length > 1) {
      const codeStartIdx = nonBlankPre[1].idx
      const rawCodeLines = preChoiceLines.slice(codeStartIdx)
      // Trim trailing blank lines
      let end = rawCodeLines.length
      while (end > 0 && rawCodeLines[end - 1].trim() === '') end--
      codeSnippet = rawCodeLines.slice(0, end).join('\n')
      codeLang = 'javascript'
    }

    // Parse choices and optional Answer: line
    const choices: Array<{ ident: string; text: string }> = []
    let answerLetter = ''

    for (const line of choiceAndAfterLines) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      const answerMatch = trimmed.match(/^Answer:\s*([A-Da-d])/i)
      const choiceMatch = trimmed.match(/^([a-dA-D])[.)]\s+(.+)/)
      if (answerMatch) {
        answerLetter = answerMatch[1].toLowerCase()
      } else if (choiceMatch) {
        choices.push({
          ident: `choice_${choiceMatch[1].toLowerCase()}`,
          text: processInlineCode(choiceMatch[2].trim()),
        })
      }
    }

    if (choices.length < 2) return null

    let correctIdent = choices[0].ident
    if (answerLetter) {
      const found = choices.find(c => c.ident === `choice_${answerLetter}`)
      if (found) correctIdent = found.ident
    }

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

  // ── 3. Unlabeled mode (original behavior) ────────────────────────────────
  const nonCodeLines = processedLines.map(l => l.trim()).filter(l => l !== '')
  if (nonCodeLines.length === 0) return null

  const [first, ...rest] = nonCodeLines
  const questionText = processInlineCode(first.replace(/^\d+[.)]\s+/, ''))
  const choices = rest
    .filter(l => l !== '')
    .map((text, i) => ({
      ident: `choice_${String.fromCharCode(97 + i)}`,
      text: processInlineCode(text),
    }))

  if (choices.length < 2) return null

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
