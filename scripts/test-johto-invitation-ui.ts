import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { JOHTO_INVITATION_COPY, JOHTO_VOTE_QUESTIONS } from "../src/lib/johto-invitation-copy";

const file = "src/app/(app)/_components/johto-invitation-letter.tsx";
const source = readFileSync(join(process.cwd(), file), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const module = { exports: {} as Record<string, unknown> };
let hookIndex = 0;
let hookOverrides: Record<number, unknown> = {};
let hookUpdates: { index: number; value: unknown }[] = [];
let playerOpens = 0;
let previewCloses = 0;
const testReact = {
  ...React,
  useState(initial: unknown) {
    const index = hookIndex++;
    return [index in hookOverrides ? hookOverrides[index] : initial, (value: unknown) => hookUpdates.push({ index, value })];
  },
  useEffect() { /* Effects are exercised in the browser, not during static rendering. */ },
  useRef() { return { current: null }; },
};
const requireMock = (name: string) => {
  if (name === "react") return testReact;
  if (name === "react/jsx-runtime") return require("react/jsx-runtime");
  if (name === "@/lib/johto-invitation-copy") return { JOHTO_INVITATION_COPY, JOHTO_VOTE_QUESTIONS };
  if (name.includes("invitation-actions")) return {
    openJohtoInvitationAction: async () => { playerOpens++; return { ok: true }; },
    skipJohtoInvitationVoteAction: () => { throw new Error("Preview called player skip action"); },
    submitJohtoInvitationVoteAction: () => { throw new Error("Preview called player vote action"); },
  };
  throw new Error(`Unexpected UI dependency: ${name}`);
};
runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(requireMock, module, module.exports);
const Letter = module.exports.JohtoInvitationLetter as (props: {
  mode: "preview" | "player";
  onClose?: () => void;
  candidates?: { id: string; displayName: string }[];
}) => React.ReactElement;
assert.equal(typeof Letter, "function", "letter component is exported");
function render(mode: "preview" | "player", overrides: Record<number, unknown> = {}) {
  hookIndex = 0;
  hookOverrides = overrides;
  hookUpdates = [];
  const tree = Letter({ mode, onClose: () => { previewCloses++; }, candidates: [{ id: "player-1", displayName: "Treinadora" }] }) as React.ReactElement;
  return { tree, html: renderToStaticMarkup(tree) };
}
function findButton(node: unknown, label: string): { props: { onClick: () => Promise<void> } } | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) return node.map((item) => findButton(item, label)).find(Boolean) ?? null;
  const element = node as { type?: string; props?: Record<string, unknown> };
  if (element.type === "button" && (element.props?.["aria-label"] === label || element.props?.children === label)) return element as never;
  return findButton(element.props?.children, label);
}
export const johtoInvitationUiHarness = (async () => {
const { html: preview, tree: previewTree } = render("preview");
assert.match(preview, /role="dialog"[^>]*aria-modal="true"/, "invitation is an accessible modal");
assert.match(preview, /Abrir convite de Johto/, "initial envelope has a named button");
assert.match(preview, /johto-envelope-left/, "left envelope segment is present");
assert.match(preview, /johto-envelope-right/, "right envelope segment is present");
assert.match(preview, /Fechar prévia/, "admin can leave preview without persistence");
const { html: finalPage, tree: finalTree } = render("preview", { 0: "reading", 1: JOHTO_INVITATION_COPY.pages.length - 1 });
assert.match(finalPage, /Participar da votação/, "last letter page offers the secret vote");
assert.match(finalPage, /Continuar para os Ginásios/, "last letter page lets the player skip the vote");
await findButton(finalTree, "Continuar para os Ginásios")!.props.onClick();
assert.equal(previewCloses, 1, "preview continuation closes without calling the player skip action");
const previewSubmitted = render("preview", { 0: "submitted" }).html;
assert.match(previewSubmitted, /Prévia concluída/, "preview completion is clearly illustrative");
assert.doesNotMatch(previewSubmitted, /votos foram registrados/, "preview never claims to have saved votes");
(globalThis as unknown as { window: unknown }).window = {
  matchMedia: () => ({ matches: true }),
  setTimeout: (callback: () => void) => { callback(); return 1; },
};
await findButton(previewTree, "Abrir convite de Johto")!.props.onClick();
assert.equal(playerOpens, 0, "preview opening never calls a persistent player action");
assert.ok(hookUpdates.some(({ index, value }) => index === 0 && value === "opening"));
const playerTree = render("player").tree;
await findButton(playerTree, "Abrir convite de Johto")!.props.onClick();
assert.equal(playerOpens, 1, "player opening calls its action once");
console.log("ok UI do convite: diálogo, envelope bilateral, abertura acessível e prévia isolada");
})().catch((error) => { console.error(error); process.exitCode = 1; throw error; });
