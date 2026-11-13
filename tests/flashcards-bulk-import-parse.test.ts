import { describe, it, expect } from 'vitest'
import { parseCardsFromHtml } from '@/lib/flashcards/bulk-import-parse'

describe('parseCardsFromHtml', () => {
  it('splits on an empty paragraph', () => {
    expect(parseCardsFromHtml('<p>Q1</p><p>A1</p><p></p><p>Q2</p><p>A2</p>')).toEqual([
      { front: '<p>Q1</p>', back: '<p>A1</p>' },
      { front: '<p>Q2</p>', back: '<p>A2</p>' },
    ])
  })

  it('treats paragraphs holding only a <br>, &nbsp; or an empty span as blank lines', () => {
    const html = '<p>Q1</p><p>A1</p><p><br></p><p>Q2</p><p>A2</p><p>&nbsp;</p><p>Q3</p><p><span> </span></p><p dir="ltr">Q4</p>'
    expect(parseCardsFromHtml(html).map(c => c.front)).toEqual(['<p>Q1</p>', '<p>Q2</p>', '<p>Q3</p>', '<p dir="ltr">Q4</p>'])
  })

  it('treats two line breaks in a row inside a paragraph as a blank line', () => {
    expect(parseCardsFromHtml('<p>Q1<br>A1<br><br>Q2<br>A2</p>')).toEqual([
      { front: '<p>Q1<br>A1</p>', back: '' },
      { front: '<p>Q2<br>A2</p>', back: '' },
    ])
  })

  it('keeps a code block on the back intact', () => {
    const html = '<p>What prints?</p><pre><code>a\n\nb</code></pre>'
    expect(parseCardsFromHtml(html)).toEqual([{ front: '<p>What prints?</p>', back: '<pre><code>a\n\nb</code></pre>' }])
  })

  it('ignores leading and trailing blank lines', () => {
    expect(parseCardsFromHtml('<p></p><p>Q</p><p>A</p><p></p><p></p>')).toHaveLength(1)
  })
})
