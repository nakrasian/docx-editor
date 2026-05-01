import { createNodeExtension } from '../create';

export interface CitationAttrs {
  highlightId: string;
  pdfUrl: string;
  text: string | null;
  image: string | null;
  pageNumber: number;
  pdfLabel: string;
}

// Invisible inline atom that stores PDF highlight metadata alongside display text.
// The paged renderer skips it; the renderOverlay plugin renders clickable overlays above
// the adjacent plain-text node instead.
export const CitationExtension = createNodeExtension({
  name: 'citation',
  schemaNodeName: 'citation',
  nodeSpec: {
    group: 'inline',
    inline: true,
    atom: true,
    content: '',
    draggable: false,
    attrs: {
      highlightId: {},
      pdfUrl: {},
      text: { default: null },
      image: { default: null },
      pageNumber: { default: 1 },
      pdfLabel: { default: '' },
    },
    parseDOM: [
      {
        tag: 'span[data-citation-id]',
        getAttrs(dom): CitationAttrs {
          const el = dom as HTMLElement;
          return {
            highlightId: el.getAttribute('data-citation-id') || '',
            pdfUrl: el.getAttribute('data-citation-url') || '',
            text: el.getAttribute('data-citation-text') || null,
            image: el.getAttribute('data-citation-image') || null,
            pageNumber: Number(el.getAttribute('data-citation-page') || 1),
            pdfLabel: el.getAttribute('data-citation-label') || '',
          };
        },
      },
    ],
    toDOM(node) {
      const attrs = node.attrs as CitationAttrs;
      return [
        'span',
        {
          'data-citation-id': attrs.highlightId,
          'data-citation-url': attrs.pdfUrl,
          style: 'display:none',
        },
      ];
    },
  },
});
