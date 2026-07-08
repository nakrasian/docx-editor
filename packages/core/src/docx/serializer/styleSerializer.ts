/**
 * Style Serializer — serialize StyleDefinitions into styles.xml
 *
 * Mirrors the parser in styleParser.ts for round-trip fidelity.
 * Handles: docDefaults, paragraph/character/table/numbering styles,
 * with full formatting property serialization.
 *
 * OOXML Reference: ECMA-376 Part 1, §17.7 Styles
 */

import type {
  Style,
  StyleDefinitions,
  DocDefaults,
  TextFormatting,
  ParagraphFormatting,
  ColorValue,
  UnderlineStyle,
  BorderSpec,
  ShadingProperties,
  TabStop,
} from '../../types/document';
import { escapeXml } from './xmlUtils';

// ============================================================================
// XML HELPERS
// ============================================================================

function tag(name: string, attrs: Record<string, string>, content?: string): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');
  if (content === undefined) return `<${name}${attrStr}/>`;
  return `<${name}${attrStr}>${content}</${name}>`;
}

function optNumTag(name: string, value: number | undefined): string {
  if (value === undefined) return '';
  return tag(name, { 'w:val': String(value) });
}

// ============================================================================
// COLOR SERIALIZATION
// ============================================================================

function serializeColor(color: ColorValue | undefined): string {
  if (!color || color.auto) return '';
  const attrs: Record<string, string> = {};

  if (color.rgb) {
    attrs['w:val'] = color.rgb;
  }
  if (color.themeColor) {
    attrs['w:themeColor'] = color.themeColor;
  }
  if (color.themeTint !== undefined) {
    attrs['w:themeTint'] = color.themeTint;
  }
  if (color.themeShade !== undefined) {
    attrs['w:themeShade'] = color.themeShade;
  }

  if (Object.keys(attrs).length === 0) return '';
  return tag('w:color', attrs);
}

function serializeUnderline(
  underline: { style: UnderlineStyle; color?: ColorValue } | undefined
): string {
  if (!underline || underline.style === 'none') return '';
  const attrs: Record<string, string> = { 'w:val': underline.style };
  if (underline.color?.rgb) {
    attrs['w:color'] = underline.color.rgb;
  }
  return tag('w:u', attrs);
}

function serializeBorders(
  borders:
    | {
        top?: BorderSpec;
        bottom?: BorderSpec;
        left?: BorderSpec;
        right?: BorderSpec;
        between?: BorderSpec;
        bar?: BorderSpec;
      }
    | undefined
): string {
  if (!borders) return '';
  const parts: string[] = [];
  const borderNames: Array<keyof typeof borders> = [
    'top',
    'bottom',
    'left',
    'right',
    'between',
    'bar',
  ];
  for (const name of borderNames) {
    const border = borders[name];
    if (!border || border.style === 'none' || border.style === 'nil') continue;
    const attrs: Record<string, string> = { 'w:val': border.style };
    if (border.color?.rgb) attrs['w:color'] = border.color.rgb;
    if (border.color?.themeColor) attrs['w:themeColor'] = border.color.themeColor;
    if (border.size !== undefined) attrs['w:sz'] = String(border.size);
    if (border.space !== undefined) attrs['w:space'] = String(border.space);
    parts.push(tag(`w:${name}`, attrs));
  }
  if (parts.length === 0) return '';
  return `<w:pBdr>${parts.join('')}</w:pBdr>`;
}

function serializeShading(shd: ShadingProperties | undefined): string {
  if (!shd) return '';
  const attrs: Record<string, string> = {};

  // ColorValue can be direct RGB or theme-based — extract RGB if available
  if (shd.fill) {
    if (shd.fill.rgb) attrs['w:fill'] = shd.fill.rgb;
    if (shd.fill.themeColor) attrs['w:themeFill'] = shd.fill.themeColor;
    if (shd.fill.themeTint) attrs['w:themeFillTint'] = shd.fill.themeTint;
    if (shd.fill.themeShade) attrs['w:themeFillShade'] = shd.fill.themeShade;
  }
  if (shd.color) {
    if (shd.color.rgb) attrs['w:color'] = shd.color.rgb;
    if (shd.color.themeColor) attrs['w:themeColor'] = shd.color.themeColor;
    if (shd.color.themeTint) attrs['w:themeColorTint'] = shd.color.themeTint;
    if (shd.color.themeShade) attrs['w:themeColorShade'] = shd.color.themeShade;
  }
  if (shd.pattern) attrs['w:val'] = shd.pattern;

  if (Object.keys(attrs).length === 0) return '';
  return tag('w:shd', attrs);
}

// ============================================================================
// RUN PROPERTIES SERIALIZATION
// ============================================================================

function serializeRunProperties(rPr: TextFormatting | undefined): string {
  if (!rPr) return '';
  const parts: string[] = [];

  if (rPr.bold) parts.push(tag('w:b', {}));
  if (rPr.boldCs) parts.push(tag('w:bCs', {}));
  if (rPr.italic) parts.push(tag('w:i', {}));
  if (rPr.italicCs) parts.push(tag('w:iCs', {}));
  if (rPr.strike) parts.push(tag('w:strike', {}));
  if (rPr.doubleStrike) parts.push(tag('w:dstrike', {}));
  if (rPr.smallCaps) parts.push(tag('w:smallCaps', {}));
  if (rPr.allCaps) parts.push(tag('w:caps', {}));
  if (rPr.hidden) parts.push(tag('w:vanish', {}));

  if (rPr.underline) {
    parts.push(serializeUnderline(rPr.underline));
  }

  if (rPr.vertAlign && rPr.vertAlign !== 'baseline') {
    parts.push(tag('w:vertAlign', { 'w:val': rPr.vertAlign }));
  }

  parts.push(optNumTag('w:sz', rPr.fontSize));
  parts.push(optNumTag('w:szCs', rPr.fontSizeCs));

  if (rPr.fontFamily) {
    const ffAttrs: Record<string, string> = {};
    if (rPr.fontFamily.ascii) ffAttrs['w:ascii'] = rPr.fontFamily.ascii;
    if (rPr.fontFamily.hAnsi) ffAttrs['w:hAnsi'] = rPr.fontFamily.hAnsi;
    if (rPr.fontFamily.eastAsia) ffAttrs['w:eastAsia'] = rPr.fontFamily.eastAsia;
    if (rPr.fontFamily.cs) ffAttrs['w:cs'] = rPr.fontFamily.cs;
    if (rPr.fontFamily.asciiTheme) ffAttrs['w:asciiTheme'] = rPr.fontFamily.asciiTheme;
    if (rPr.fontFamily.hAnsiTheme) ffAttrs['w:hAnsiTheme'] = rPr.fontFamily.hAnsiTheme;
    if (rPr.fontFamily.eastAsiaTheme) ffAttrs['w:eastAsiaTheme'] = rPr.fontFamily.eastAsiaTheme;
    if (rPr.fontFamily.csTheme) ffAttrs['w:csTheme'] = rPr.fontFamily.csTheme;
    if (Object.keys(ffAttrs).length > 0) {
      parts.push(tag('w:rFonts', ffAttrs));
    }
  }

  parts.push(serializeColor(rPr.color));

  if (rPr.highlight && rPr.highlight !== 'none') {
    parts.push(tag('w:highlight', { 'w:val': rPr.highlight }));
  }

  parts.push(serializeShading(rPr.shading));
  parts.push(optNumTag('w:spacing', rPr.spacing));
  parts.push(optNumTag('w:position', rPr.position));
  parts.push(optNumTag('w:w', rPr.scale));
  parts.push(optNumTag('w:kern', rPr.kerning));

  if (rPr.rtl) parts.push(tag('w:rtl', {}));
  if (rPr.cs) parts.push(tag('w:cs', {}));

  if (parts.length === 0) return '';
  return `<w:rPr>${parts.join('')}</w:rPr>`;
}

// ============================================================================
// PARAGRAPH PROPERTIES SERIALIZATION
// ============================================================================

function serializeParagraphProperties(pPr: ParagraphFormatting | undefined): string {
  if (!pPr) return '';
  const parts: string[] = [];

  if (pPr.alignment) {
    parts.push(tag('w:jc', { 'w:val': pPr.alignment }));
  }
  if (pPr.bidi) parts.push(tag('w:bidi', {}));

  // Spacing
  const spacingAttrs: Record<string, string> = {};
  if (pPr.spaceBefore !== undefined) spacingAttrs['w:before'] = String(pPr.spaceBefore);
  if (pPr.spaceAfter !== undefined) spacingAttrs['w:after'] = String(pPr.spaceAfter);
  if (pPr.lineSpacing !== undefined) spacingAttrs['w:line'] = String(pPr.lineSpacing);
  if (pPr.lineSpacingRule) spacingAttrs['w:lineRule'] = pPr.lineSpacingRule;
  if (pPr.beforeAutospacing) spacingAttrs['w:beforeAutospacing'] = '1';
  if (pPr.afterAutospacing) spacingAttrs['w:afterAutospacing'] = '1';
  if (Object.keys(spacingAttrs).length > 0) {
    parts.push(tag('w:spacing', spacingAttrs));
  }

  // Indentation
  const indentAttrs: Record<string, string> = {};
  if (pPr.indentLeft !== undefined) indentAttrs['w:left'] = String(pPr.indentLeft);
  if (pPr.indentRight !== undefined) indentAttrs['w:right'] = String(pPr.indentRight);
  if (pPr.indentFirstLine !== undefined) {
    if (pPr.hangingIndent) {
      indentAttrs['w:hanging'] = String(pPr.indentFirstLine);
    } else {
      indentAttrs['w:firstLine'] = String(pPr.indentFirstLine);
    }
  }
  if (Object.keys(indentAttrs).length > 0) {
    parts.push(tag('w:ind', indentAttrs));
  }

  parts.push(serializeBorders(pPr.borders));
  parts.push(serializeShading(pPr.shading));

  // Tab stops
  if (pPr.tabs && pPr.tabs.length > 0) {
    const tabParts = pPr.tabs.map((t: TabStop) => {
      const attrs: Record<string, string> = {
        'w:val': t.alignment,
        'w:pos': String(t.position),
      };
      if (t.leader && t.leader !== 'none') attrs['w:leader'] = t.leader;
      return tag('w:tab', attrs);
    });
    parts.push(`<w:tabs>${tabParts.join('')}</w:tabs>`);
  }

  // Page break control
  if (pPr.keepNext) parts.push(tag('w:keepNext', {}));
  if (pPr.keepLines) parts.push(tag('w:keepLines', {}));
  if (pPr.pageBreakBefore) parts.push(tag('w:pageBreakBefore', {}));
  if (pPr.contextualSpacing) parts.push(tag('w:contextualSpacing', {}));

  // Outline level
  if (pPr.outlineLevel !== undefined) {
    parts.push(tag('w:outlineLvl', { 'w:val': String(pPr.outlineLevel) }));
  }

  // Numbering properties
  if (pPr.numPr) {
    const numParts: string[] = [];
    if (pPr.numPr.numId !== undefined) {
      numParts.push(tag('w:numId', { 'w:val': String(pPr.numPr.numId) }));
    }
    if (pPr.numPr.ilvl !== undefined) {
      numParts.push(tag('w:ilvl', { 'w:val': String(pPr.numPr.ilvl) }));
    }
    if (numParts.length > 0) {
      parts.push(`<w:numPr>${numParts.join('')}</w:numPr>`);
    }
  }

  if (pPr.suppressLineNumbers) parts.push(tag('w:suppressLineNumbers', {}));
  if (pPr.suppressAutoHyphens) parts.push(tag('w:suppressAutoHyphens', {}));

  if (parts.length === 0) return '';
  return `<w:pPr>${parts.join('')}</w:pPr>`;
}

// ============================================================================
// DOC DEFAULTS SERIALIZATION
// ============================================================================

function serializeDocDefaults(docDefaults: DocDefaults | undefined): string {
  if (!docDefaults) return '';
  const parts: string[] = [];

  if (docDefaults.rPr) {
    parts.push(`<w:rPrDefault>${serializeRunProperties(docDefaults.rPr)}</w:rPrDefault>`);
  }
  if (docDefaults.pPr) {
    parts.push(`<w:pPrDefault>${serializeParagraphProperties(docDefaults.pPr)}</w:pPrDefault>`);
  }

  if (parts.length === 0) return '';
  return `<w:docDefaults>${parts.join('')}</w:docDefaults>`;
}

// ============================================================================
// STYLE SERIALIZATION
// ============================================================================

function serializeStyle(style: Style): string {
  const attrs: Record<string, string> = {
    'w:type': style.type,
    'w:styleId': style.styleId,
  };

  if (style.default) attrs['w:default'] = '1';

  const parts: string[] = [];

  // Name
  if (style.name) {
    parts.push(tag('w:name', { 'w:val': style.name }));
  }

  // Inheritance
  if (style.basedOn) {
    parts.push(tag('w:basedOn', { 'w:val': style.basedOn }));
  }
  if (style.next) {
    parts.push(tag('w:next', { 'w:val': style.next }));
  }
  if (style.link) {
    parts.push(tag('w:link', { 'w:val': style.link }));
  }

  // UI metadata
  if (style.uiPriority !== undefined) {
    parts.push(tag('w:uiPriority', { 'w:val': String(style.uiPriority) }));
  }
  if (style.hidden) parts.push(tag('w:hidden', {}));
  if (style.semiHidden) parts.push(tag('w:semiHidden', {}));
  if (style.unhideWhenUsed) parts.push(tag('w:unhideWhenUsed', {}));
  if (style.qFormat) parts.push(tag('w:qFormat', {}));
  if (style.personal) parts.push(tag('w:personal', {}));

  // Formatting properties
  parts.push(serializeParagraphProperties(style.pPr));
  parts.push(serializeRunProperties(style.rPr));

  // Remove empty strings
  const nonEmpty = parts.filter(Boolean);

  return tag('w:style', attrs, nonEmpty.join(''));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Serialize StyleDefinitions to a complete styles.xml string.
 *
 * @param styleDefinitions - The style definitions to serialize
 * @returns Complete styles.xml as a string
 */
export function serializeStyles(styleDefinitions: StyleDefinitions | undefined): string {
  if (!styleDefinitions) return '';

  const parts: string[] = [];

  // Doc defaults
  parts.push(serializeDocDefaults(styleDefinitions.docDefaults));

  // Styles
  if (styleDefinitions.styles && styleDefinitions.styles.length > 0) {
    for (const style of styleDefinitions.styles) {
      parts.push(serializeStyle(style));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${parts.filter(Boolean).join('\n')}
</w:styles>`;
}
