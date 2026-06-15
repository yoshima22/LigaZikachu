import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  const key = match[1];
  let value = match[2].trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    process.env[key] ??= value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const [rawCommand, ...args] = process.argv.slice(2);
if (!rawCommand) {
  console.error("Uso: node scripts/run-with-env-local.mjs <comando> [...args]");
  process.exit(1);
}

function resolveLocalCommand(command) {
  if (command === "prisma") {
    return {
      command: process.execPath,
      argsPrefix: [resolve(process.cwd(), "node_modules", "prisma", "build", "index.js")],
    };
  }

  const extension = process.platform === "win32" ? ".cmd" : "";
  const localBin = resolve(process.cwd(), "node_modules", ".bin", `${command}${extension}`);
  if (existsSync(localBin)) return { command: localBin, argsPrefix: [] };
  const fallback = process.platform === "win32" && !command.includes(".") ? `${command}.cmd` : command;
  return { command: fallback, argsPrefix: [] };
}

const resolved = resolveLocalCommand(rawCommand);

const child = spawn(resolved.command, [...resolved.argsPrefix, ...args], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Comando encerrado por sinal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
