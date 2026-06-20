// Ambient types for css-tree's lexer-free subpath entries. `scopeArticleCss` imports
// `parse`/`generate`/`walk` (parser/generator/walker) plus the CSS Syntax tokenizer
// (`tokenize`/`tokenTypes`) and identifier decoder (`ident.decode`, via `utils`) from these
// subpaths instead of the `css-tree` main entry, because the main entry constructs its
// default syntax WITH the lexer config at module init, which pulls ~0.8 MB of `mdn-data`
// into the bundle. The subpaths ship only the parser/generator/walker/tokenizer/utils — no
// lexer, no `mdn-data`. `@types/css-tree` types only the main module, so these map the
// subpath exports onto the main module's types (or declare the few it omits).

declare module "css-tree/parser" {
  import type { parse } from "css-tree";
  const parser: typeof parse;
  export default parser;
}

declare module "css-tree/generator" {
  import type { generate } from "css-tree";
  const generator: typeof generate;
  export default generator;
}

declare module "css-tree/walker" {
  import type { walk } from "css-tree";
  const walker: typeof walk;
  export default walker;
}

declare module "css-tree/utils" {
  export const ident: {
    decode(input: string): string;
    encode(input: string): string;
  };
}

// `@types/css-tree` does not type the tokenizer surface; declare only what we use. The
// CSS Syntax tokenizer feeds (token type, start offset, end offset) into the callback;
// `tokenTypes` maps token-name constants to their numeric type ids.
declare module "css-tree/tokenizer" {
  export const tokenTypes: Record<string, number>;
  export function tokenize(
    source: string,
    onToken: (type: number, start: number, end: number) => void
  ): void;
}
