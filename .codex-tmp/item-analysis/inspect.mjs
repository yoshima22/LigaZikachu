import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "C:/Users/LuizAguiar/Downloads/itensZikachu.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,formula",
  maxChars: 30000,
  tableMaxRows: 100,
  tableMaxCols: 30,
  tableMaxCellChars: 500,
});
console.log(summary.ndjson);

const sheets = (await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 10000 })).ndjson
  .trim().split(/\r?\n/).map((line) => JSON.parse(line).name).filter(Boolean);

await fs.mkdir("previews", { recursive: true });
for (const name of sheets) {
  const sheet = workbook.worksheets.getItem(name);
  const used = sheet.getUsedRange();
  console.log(`USED_RANGE ${name}:`, used?.address ?? "unknown");
  const region = await workbook.inspect({ kind: "region", sheetId: name, range: used?.address, maxChars: 30000, tableMaxRows: 200, tableMaxCols: 30, tableMaxCellChars: 500 });
  console.log(region.ndjson);
  const preview = await workbook.render({ sheetName: name, autoCrop: "all", scale: 1.5, format: "png" });
  await fs.writeFile(`previews/${name.replace(/[^a-z0-9]+/gi, "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}
