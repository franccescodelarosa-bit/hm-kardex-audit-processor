import { KardexParser } from "./src/parsers/kardex.parser";
import { CodeHelper } from "./src/helpers/code.helper";
import { DocumentHelper } from "./src/helpers/document.helper";
import fs from "fs";
import path from "path";

async function main() {
    const manifestPath = process.argv[2];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const target = CodeHelper.normalize("040750");

    for (const kardexPath of manifest.kardex) {
        const products = await KardexParser.parse(kardexPath);
        const match = products.find(p => CodeHelper.normalize(p.code) === target);
        if (match) {
            const fileName = path.basename(kardexPath);
            console.log(`\n=== ${fileName} ===`);
            console.log(`Codigo tal cual esta escrito: "${match.code}" - ${match.description}`);
            for (const m of match.movements) {
                console.log(`  ${m.date?.toISOString().slice(0,10)} | Documento: "${m.document}" | Op: ${m.operation} | Entrada: ${m.entryQuantity} | Costo: ${m.entryTotalCost} | Saldo: ${m.balanceQuantity}`);
            }
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
