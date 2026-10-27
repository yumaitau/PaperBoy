import { DecodingMode, EntityDecoder, htmlDecodeTree } from "entities/decode";
import { Tokenizer, type Token } from "parse5";

type Edit = { start: number; end: number; value: string };
type Range = { start: number; end: number };
type Span = {
  start: number;
  end: number;
  from: number;
  to: number;
  literal: boolean;
};

/**
 * Reconstruct a foreign style element's semantic CSS and map edits to raw HTML.
 * source is the element's inner HTML; textRanges are parse5's ordered,
 * nonoverlapping direct-text-child ranges, relative to that slice. All offsets
 * use half-open UTF-16 code units. Foreign DATA tokenization omits markup and
 * preserves CDATA text; entity decoding, CR/CRLF folding, and null replacement
 * reproduce parsed text. The caller must compare css with parse5's selected text
 * before applying edits, since malformed tree recovery may select other text.
 */
export function foreignCssSource(source: string, textRanges: Range[]) {
  const omitted: Range[] = [];
  let cursor = 0;
  for (const range of textRanges) {
    if (cursor < range.start) omitted.push({ start: cursor, end: range.start });
    cursor = range.end;
  }
  if (cursor < source.length)
    omitted.push({ start: cursor, end: source.length });
  /** Record located markup for omission; locationless tokens contribute no range. */
  const ignore = (token: Token.Token) => {
    if (token.location)
      omitted.push({
        start: token.location.startOffset,
        end: token.location.endOffset,
      });
  };
  /** Ignore text/EOF events; the source scan below reconstructs text spans. */
  const noop = () => {};
  // The tokenizer stays in foreign DATA mode: tags/comments are markup and
  // CDATA is text. Tree selection and the final semantic check belong to parse5.
  const tokenizer = new Tokenizer(
    { sourceCodeLocationInfo: true },
    {
      onStartTag: ignore,
      onEndTag: ignore,
      onComment: ignore,
      onDoctype: ignore,
      onCharacter: noop,
      onWhitespaceCharacter: noop,
      onNullCharacter: noop,
      onEof: noop,
    },
  );
  tokenizer.inForeignNode = true;
  tokenizer.write(source, true);
  // Ignore both tokenizer markup and descendants that are not direct style
  // text children. Ranges can overlap (e.g. a nested element's opening tag).
  const markup: Range[] = [];
  for (const range of omitted.sort((a, b) => a.start - b.start)) {
    const previous = markup.at(-1);
    if (previous && range.start <= previous.end)
      previous.end = Math.max(previous.end, range.end);
    else markup.push({ ...range });
  }

  const spans: Span[] = [];
  let css = "";
  /**
   * Append decoded text and its raw source span. literal marks a one-to-one
   * UTF-16 mapping; transformed spans such as entities must be replaced whole.
   */
  function append(start: number, end: number, text: string, literal = false) {
    spans.push({
      start,
      end,
      from: css.length,
      to: css.length + text.length,
      literal,
    });
    css += text;
  }
  let decoded = "";
  const decoder = new EntityDecoder(htmlDecodeTree, (cp) => {
    decoded += String.fromCodePoint(cp);
  });
  let cdata = false;
  let position = 0;
  let markupIndex = 0;
  let run = 0;
  /** Append the pending unchanged source run before a boundary or transformation. */
  const flush = () => {
    if (run < position)
      append(run, position, source.slice(run, position), true);
  };
  while (position < source.length) {
    const omitted = markup[markupIndex];
    if (omitted?.start === position) {
      flush();
      position = omitted.end;
      markupIndex++;
    } else if (!cdata && source.startsWith("<![CDATA[", position)) {
      flush();
      position += 9;
      cdata = true;
    } else if (cdata && source.startsWith("]]>", position)) {
      flush();
      position += 3;
      cdata = false;
    } else if (!cdata && source[position] === "&") {
      decoded = "";
      decoder.startEntity(DecodingMode.Legacy);
      let consumed = decoder.write(source, position + 1);
      if (consumed < 0) consumed = decoder.end();
      if (consumed === 0) {
        position++;
        continue;
      }
      flush();
      append(position, position + consumed, decoded);
      position += consumed;
    } else if (source[position] === "\r" || source[position] === "\0") {
      flush();
      const end =
        position +
        (source[position] === "\r" && source[position + 1] === "\n" ? 2 : 1);
      append(position, end, source[position] === "\r" ? "\n" : "\ufffd");
      position = end;
    } else {
      position++;
      continue;
    }
    run = position;
  }
  flush();

  return {
    css,
    /**
     * Project ordered, nonoverlapping, nonempty edits in css back to source.
     * Changes must be within css, and separate changes must not touch the same transformed source span.
     * Replacement values must be safe verbatim in both parsed text and CDATA
     * (the caller supplies generated ASCII CID URLs). Split edits across text
     * spans, insert each replacement once, and retain intervening markup/CDATA
     * delimiters. Re-encode any untouched portion of a transformed span, including
     * a multi-codepoint entity; callers apply the returned raw ranges to source.
     */
    edits(changes: Edit[]): Edit[] {
      const result: Edit[] = [];
      let index = 0;
      for (const change of changes) {
        while (index < spans.length && spans[index].to <= change.start) index++;
        let first = true;
        for (
          let i = index;
          i < spans.length && spans[i].from < change.end;
          i++
        ) {
          const span = spans[i];
          const from = Math.max(change.start, span.from);
          const to = Math.min(change.end, span.to);
          // A reference may span entities, CDATA, or ignored markup. Only text
          // spans are replaced; delimiters and untouched raw source stay intact.
          // Multi-codepoint entities must retain any semantic prefix/suffix.
          /** Encode retained semantic entity text without introducing HTML markup. */
          const escape = (text: string) =>
            text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
          result.push({
            start: span.start + (span.literal ? from - span.from : 0),
            end: span.literal ? span.start + to - span.from : span.end,
            value:
              (span.literal ? "" : escape(css.slice(span.from, from))) +
              (first ? change.value : "") +
              (span.literal ? "" : escape(css.slice(to, span.to))),
          });
          first = false;
        }
      }
      return result;
    },
  };
}
