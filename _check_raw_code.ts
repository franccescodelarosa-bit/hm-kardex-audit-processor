import { KardexParser } from "./src/parsers/kardex.parser";
import { CodeHelper } from "./src/helpers/code.helper";
import fs from "fs";
import path from "path";

async function main() {
    const manifestPath = process.argv[2];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const target = CodeHelper.normalize("00002525");

    for (const kardexPath of manifest.kardex) {
        const products = await KardexParser.parse(kardexPath);
        const match = products.find(p => CodeHelper.normalize(p.code) === target);
        const fileName = path.basename(kardexPath);
        if (match) {
            console.log(`${fileName} -> codigo tal cual esta escrito: "${match.code}" | movimientos: ${match.movements.length}`);
        } else {
            console.log(`${fileName} -> no aparece este producto en este archivo`);
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
