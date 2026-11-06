import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const headerPath = join(root, "src/app/(app)/laboratorio/_components/dra-cleide-lab-header.tsx");
const labClientPath = join(root, "src/app/(app)/laboratorio/_components/lab-client.tsx");
const assetPath = join(root, "public/images/dra-cleide-lab-hero.png");

assert.ok(existsSync(headerPath), "the Dra. Cleide lab header component should exist");
assert.ok(existsSync(assetPath), "the Dra. Cleide artwork should be available as a local public asset");

const header = readFileSync(headerPath, "utf8");
const labClient = readFileSync(labClientPath, "utf8");

assert.match(header, /src="\/images\/dra-cleide-lab-hero\.png"/, "header should render the local Dra. Cleide artwork");
assert.match(header, /pointer-events-none/, "decorative artwork should not intercept interactions");
assert.match(header, /hidden\b[\s\S]*\bmd:block/, "artwork should be hidden on mobile layouts");
assert.match(header, /h-\[250px\]/, "artwork should fit fully inside the laboratory header");
assert.match(header, /Pesquisas, Misturas e análises/, "header should use the revised laboratory eyebrow text");
assert.match(header, /do Prof\. Enguiça/, "header should retain the crossed-out former laboratory owner");
assert.match(header, /da Dra\. Cleide Combustão/, "header should name Dra. Cleide as the laboratory owner");
assert.match(labClient, /DraCleideLabHeader/, "LabClient should render the themed header");
assert.match(labClient, /<DraCleideLabHeader dust=\{dust\}\s*\/>/, "the header should receive live dust state");

console.log("Dra. Cleide lab header wiring is present.");
