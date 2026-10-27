import { createHash } from "node:crypto";
import {
  isTokenCloseParen,
  isTokenFunction,
  isTokenString,
  isTokenURL,
  isTokenWhiteSpaceOrComment,
  tokenize,
} from "@csstools/css-tokenizer";
import { parse, type DefaultTreeAdapterTypes as Html } from "parse5";
import { foreignCssSource } from "./mime-css-source";

type Edit = { start: number; end: number; value: string };
const htmlSpace = /[\t\n\f\r ]/;
const nonAscii = /[^\x00-\x7f]/;

/** Logical labels stay in storage. Only MIME uses this per-message mapping. */
export function mimeContentIds(labels: readonly (string | null | undefined)[]) {
  const originals = new Set(labels.filter((label): label is string => !!label));
  const occupied = new Set(originals);
  const mapping = new Map<string, string>();
  // Sorting also makes the (exceptionally unlikely) hash collision case independent
  // of attachment order. Duplicated logical labels intentionally share one ID.
  for (const label of [...originals]
    .filter((value) => nonAscii.test(value))
    .sort()) {
    let wireId: string;
    let attempt = 0;
    do {
      // UTF-16 also preserves distinct unpaired surrogates in internal/legacy input;
      // hashing UTF-8 would collapse them to the same replacement character.
      const digest = createHash("sha256")
        .update(`paperboy-cid-v1:${attempt++}:`)
        .update(Buffer.from(label, "utf16le"))
        .digest("hex");
      wireId = `pb-${digest}@cid.paperboy.invalid`;
    } while (occupied.has(wireId));
    occupied.add(wireId);
    mapping.set(label, wireId);
  }
  return mapping;
}

function applyEdits(source: string, edits: Edit[]): string {
  let result = "";
  let offset = 0;
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    // HTML error recovery may expose the same source node more than once.
    if (edit.start < offset) continue;
    result += source.slice(offset, edit.start) + edit.value;
    offset = edit.end;
  }
  return result + source.slice(offset);
}

function mappedUrl(
  url: string,
  mapping: ReadonlyMap<string, string>,
): string | undefined {
  // URL input preprocessing precedes scheme recognition and percent decoding.
  // This is URL syntax; it does not normalize or validate attachment labels.
  url = url
    .replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, "")
    .replace(/[\t\n\r]/g, "");
  if (url.slice(0, 4).toLowerCase() !== "cid:") return;
  try {
    // RFC 2392: decode exactly once; '+' is a literal plus, not a space.
    const id = mapping.get(decodeURIComponent(url.slice(4)));
    return id === undefined ? undefined : `cid:${id}`;
  } catch {
    // Broken percent encodings must not bind to a different attachment.
    return;
  }
}

function rewriteUrl(
  value: string,
  mapping: ReadonlyMap<string, string>,
): string {
  const start = value.search(/[^\t\n\f\r ]/);
  if (start < 0) return value;
  let end = value.length;
  while (end > start && htmlSpace.test(value[end - 1])) end--;
  const replacement = mappedUrl(value.slice(start, end), mapping);
  return replacement === undefined
    ? value
    : value.slice(0, start) + replacement + value.slice(end);
}

function cssEdits(css: string, mapping: ReadonlyMap<string, string>): Edit[] {
  const edits: Edit[] = [];
  // Keep malformed tokens intact without losing valid URLs elsewhere in a block.
  const errors: { sourceStart: number; sourceEnd: number }[] = [];
  const tokens = tokenize(
    { css },
    {
      onParseError: (error) => {
        errors.push(error);
      },
    },
  );
  const malformed: { start: number; end: number }[] = [];
  for (const error of errors.sort((a, b) => a.sourceStart - b.sourceStart)) {
    const previous = malformed.at(-1);
    if (previous && error.sourceStart <= previous.end) {
      previous.end = Math.max(previous.end, error.sourceEnd);
    } else malformed.push({ start: error.sourceStart, end: error.sourceEnd });
  }
  let errorIndex = 0;
  function hasError(start: number, end: number): boolean {
    while (errorIndex < malformed.length && malformed[errorIndex].end < start)
      errorIndex++;
    return errorIndex < malformed.length && malformed[errorIndex].start <= end;
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (isTokenURL(token)) {
      if (hasError(token[2], token[3])) continue;
      const url = mappedUrl(token[4].value, mapping);
      if (url !== undefined)
        edits.push({
          start: token[2],
          end: token[3] + 1,
          value: `url(${url})`,
        });
    } else if (
      isTokenFunction(token) &&
      token[4].value.toLowerCase() === "url"
    ) {
      let valueIndex = index + 1;
      while (isTokenWhiteSpaceOrComment(tokens[valueIndex])) valueIndex++;
      const value = tokens[valueIndex];
      let closeIndex = valueIndex + 1;
      while (isTokenWhiteSpaceOrComment(tokens[closeIndex])) closeIndex++;
      if (!isTokenString(value) || !isTokenCloseParen(tokens[closeIndex]))
        continue;
      if (hasError(token[2], tokens[closeIndex][3])) continue;
      const url = mappedUrl(value[4].value, mapping);
      if (url !== undefined)
        edits.push({ start: value[2], end: value[3] + 1, value: `"${url}"` });
    }
  }
  return edits;
}

function rewriteCss(css: string, mapping: ReadonlyMap<string, string>): string {
  return applyEdits(css, cssEdits(css, mapping));
}

function validDescriptors(descriptors: string[]): boolean {
  let width = false;
  let density = false;
  let height = false;
  for (const descriptor of descriptors) {
    if (
      /^[0-9]+w$/.test(descriptor) &&
      parseInt(descriptor) > 0 &&
      !width &&
      !density
    )
      width = true;
    else if (
      /^[0-9]+h$/.test(descriptor) &&
      parseInt(descriptor) > 0 &&
      !height &&
      !density
    )
      height = true;
    else if (
      /^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?x$/.test(
        descriptor,
      ) &&
      Number.isFinite(Number(descriptor.slice(0, -1))) &&
      Number(descriptor.slice(0, -1)) >= 0 &&
      !density &&
      !width &&
      !height
    )
      density = true;
    else return false;
  }
  return !height || width;
}

// WHATWG "parsing a srcset attribute", retaining URL source spans. In particular,
// commas inside a URL (e.g. data:) are not candidate separators, and parentheses
// in descriptors must be consumed before looking for the next candidate.
function rewriteSrcset(
  value: string,
  mapping: ReadonlyMap<string, string>,
): string {
  const edits: Edit[] = [];
  let position = 0;
  while (position < value.length) {
    while (
      position < value.length &&
      (htmlSpace.test(value[position]) || value[position] === ",")
    )
      position++;
    const start = position;
    while (position < value.length && !htmlSpace.test(value[position]))
      position++;
    let end = position;
    const descriptors: string[] = [];
    if (value[end - 1] === ",") {
      while (value[end - 1] === ",") end--;
    } else {
      let descriptor = "";
      let inParens = false;
      while (position < value.length) {
        const char = value[position++];
        if (char === "," && !inParens) break;
        if (htmlSpace.test(char) && !inParens) {
          if (descriptor) descriptors.push(descriptor);
          descriptor = "";
        } else {
          descriptor += char;
          if (char === "(") inParens = true;
          if (char === ")") inParens = false;
        }
      }
      if (descriptor) descriptors.push(descriptor);
    }
    if (!validDescriptors(descriptors)) continue;
    const url = mappedUrl(value.slice(start, end), mapping);
    if (url !== undefined) edits.push({ start, end, value: url });
  }
  return applyEdits(value, edits);
}

const urlAttributes = new Map<string, readonly string[]>(
  Object.entries({
    a: ["href"],
    area: ["href"],
    audio: ["src"],
    base: ["href"],
    blockquote: ["cite"],
    body: ["background"],
    button: ["formaction"],
    del: ["cite"],
    embed: ["src"],
    form: ["action"],
    iframe: ["src"],
    img: ["src", "longdesc"],
    input: ["src", "formaction"],
    ins: ["cite"],
    link: ["href"],
    object: ["data"],
    q: ["cite"],
    source: ["src"],
    table: ["background"],
    td: ["background"],
    th: ["background"],
    track: ["src"],
    video: ["src", "poster"],
  }),
);
const svgUrlAttributes = new Set([
  "clip-path",
  "color-profile",
  "cursor",
  "fill",
  "filter",
  "marker",
  "marker-start",
  "marker-mid",
  "marker-end",
  "mask",
  "stroke",
]);

function attributeEdit(
  source: string,
  start: number,
  end: number,
  value: string,
): Edit | undefined {
  // Locations cover the whole attribute. Retain its spelling, spaces and quote
  // style, escaping the changed semantic value (entities were decoded by parse5).
  const raw = source.slice(start, end);
  const equals = raw.indexOf("=");
  if (equals < 0) return;
  let valueStart = equals + 1;
  while (htmlSpace.test(raw[valueStart] ?? "")) valueStart++;
  const quote =
    raw[valueStart] === '"' || raw[valueStart] === "'" ? raw[valueStart] : "";
  const selectedQuote = quote || (/[\t\n\f\r "'`=<>]/.test(value) ? '"' : "");
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(
      selectedQuote || '"',
      selectedQuote === "'" ? "&#39;" : "&quot;",
    );
  return {
    start: start + valueStart,
    end,
    value: selectedQuote + escaped + selectedQuote,
  };
}

/** Rewrite only parsed URL contexts; all unedited source bytes are retained. */
export function rewriteMimeCidReferences(
  html: string,
  mapping: ReadonlyMap<string, string>,
): string {
  if (mapping.size === 0) return html;
  // Email renders noscript fallbacks; keep head/body HTML recovery consistent
  // with scripting disabled while script contents remain raw text.
  const document = parse(html, {
    sourceCodeLocationInfo: true,
    scriptingEnabled: false,
  });
  const edits: Edit[] = [];
  const pending: Html.Node[] = [document];
  while (pending.length) {
    const node = pending.pop()!;
    if (!("tagName" in node)) {
      if ("childNodes" in node)
        for (const child of node.childNodes) pending.push(child);
      continue;
    }
    if (node.tagName === "script") continue;
    if (
      node.tagName === "style" &&
      node.attrs.some(
        (attr) =>
          attr.name === "type" &&
          attr.value.trim() !== "" &&
          attr.value.trim().toLowerCase() !== "text/css",
      )
    )
      continue;
    const svg = node.namespaceURI === "http://www.w3.org/2000/svg";
    for (const attr of node.attrs) {
      const name = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
      const location = node.sourceCodeLocation?.attrs?.[name];
      if (!location) continue;
      let value = attr.value;
      if (name === "style" || (svg && svgUrlAttributes.has(name)))
        value = rewriteCss(value, mapping);
      else if (
        ((node.tagName === "img" || node.tagName === "source") &&
          name === "srcset") ||
        (node.tagName === "link" && name === "imagesrcset")
      )
        value = rewriteSrcset(value, mapping);
      else if (
        (svg && (name === "href" || name === "xlink:href")) ||
        urlAttributes.get(node.tagName)?.includes(name)
      )
        value = rewriteUrl(value, mapping);
      if (value !== attr.value) {
        const edit = attributeEdit(
          html,
          location.startOffset,
          location.endOffset,
          value,
        );
        if (edit) edits.push(edit);
      }
    }
    if (node.tagName === "style") {
      if (node.namespaceURI !== "http://www.w3.org/1999/xhtml") {
        // Foreign style is parsed text, unlike HTML's raw-text style content.
        // Tokenize the semantic CSS first, then map only actual edits to source.
        const css = node.childNodes
          .filter((child): child is Html.TextNode => child.nodeName === "#text")
          .map((child) => child.value)
          .join("");
        const changes = cssEdits(css, mapping);
        const location = node.sourceCodeLocation;
        if (changes.length && location?.startTag) {
          const start = location.startTag.endOffset;
          const end = location.endTag?.startOffset ?? location.endOffset;
          const textRanges = node.childNodes.flatMap((child) =>
            child.nodeName === "#text" && child.sourceCodeLocation
              ? [
                  {
                    start: child.sourceCodeLocation.startOffset - start,
                    end: child.sourceCodeLocation.endOffset - start,
                  },
                ]
              : [],
          );
          const source = foreignCssSource(html.slice(start, end), textRanges);
          // Fail closed if malformed tree recovery selected different text.
          if (source.css === css)
            for (const change of source.edits(changes))
              edits.push({
                start: start + change.start,
                end: start + change.end,
                value: change.value,
              });
        }
        continue;
      }
      for (const child of node.childNodes) {
        const location = child.sourceCodeLocation;
        if (child.nodeName !== "#text" || !location) continue;
        const original = html.slice(location.startOffset, location.endOffset);
        const value = rewriteCss(original, mapping);
        if (value !== original)
          edits.push({
            start: location.startOffset,
            end: location.endOffset,
            value,
          });
      }
    } else {
      for (const child of node.childNodes) pending.push(child);
      if ("content" in node) pending.push((node as Html.Template).content);
    }
  }
  return applyEdits(html, edits);
}
