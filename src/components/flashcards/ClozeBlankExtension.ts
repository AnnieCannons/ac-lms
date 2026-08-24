import { Node, mergeAttributes } from '@tiptap/core'

// Inline atom node representing a single cloze blank.
// Serializes to/from <span data-type="cloze-blank" data-word="WORD"> in HTML.
// The node view (pill + × button) is added in ClozeCardEditor via .extend().
export const ClozeBlankExtension = Node.create({
  name: 'clozeBlank',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      word: { default: '' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="cloze-blank"]',
        getAttrs: el => ({ word: (el as HTMLElement).getAttribute('data-word') }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'cloze-blank',
        'data-word': node.attrs.word,
      }),
      node.attrs.word,
    ]
  },
})
