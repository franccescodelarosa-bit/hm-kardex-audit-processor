import { KardexParser } from "./src/parsers/kardex.parser";
import { CodeHelper } from "./src/helpers/code.helper";
import fs from "fs";

async function main() {
    const manifestPath = process.argv[2];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const kardex: any[] = [];
    for (const kardexPath of manifest.kardex) {
        const products = await KardexParser.parse(kardexPath);
        kardex.push(...products);
    }

    const targetCodes = ["00002525", "00007894", "00362541"].map(c => CodeHelper.normalize(c));

    for (const target of targetCodes) {
        console.log(`\n=== Código ${target} ===`);
        const matches = kardex.filter(p => CodeHelper.normalize(p.code) === target);
        if (matches.length === 0) {
            console.log("NO existe ningún producto con este código en TODO el Kardex del año.");
            continue;
        }
        for (const product of matches) {
            console.log(`Producto: ${product.code} - ${product.description}`);
            for (const m of product.movements) {
                if (Number(m.entryQuantity || 0) > 0) {
                    console.log(`   Mes ${m.month} | Documento: "${m.document}" | Entrada: ${m.entryQuantity} u. | Costo: ${m.entryTotalCost}`);
                }
            }
        }
    }
}

main().catch(e => { console.error(e); process.exit(1); });
