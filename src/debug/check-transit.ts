import { KardexParser } from "../parsers/kardex.parser";
import { TransitParser } from "../parsers/transit.parser";
import { DocumentHelper } from "../helpers/document.helper";
import { Rule004 } from "../rules/rule-004";
import { Rule012 } from "../rules/rule-012";
import { AuditData } from "../models/audit-data";

async function main() {
    const [facturaArg, transitoPath, ...kardexPaths] = process.argv.slice(2);

    if (!facturaArg || !transitoPath || kardexPaths.length === 0) {
        console.log('Uso: npx ts-node src/debug/check-transit.ts "<factura>" <transito.xlsx> <kardex1.xlsx> [<kardex2.xlsx> ...]');
        process.exit(1);
    }

    const facturaNormalizada = DocumentHelper.normalize(facturaArg);

    console.log(`\nBuscando factura "${facturaArg}" (normalizada: "${facturaNormalizada}")...\n`);

    const transit = await TransitParser.parse(transitoPath);

    let kardex: Awaited<ReturnType<typeof KardexParser.parse>> = [];
    for (const path of kardexPaths) {
        kardex = kardex.concat(await KardexParser.parse(path));
    }

    const data: AuditData = { year: 2024, initialInventory: [], finalInventory: [], transit, kardex };

    const factura = transit.find(t => DocumentHelper.normalize(t.document) === facturaNormalizada);

    console.log("========================================");
    console.log("LO QUE SE ENCONTRÓ PARA ESTA FACTURA");
    console.log("========================================");
    if (!factura) {
        console.log("NO aparece en el Excel de Mercadería en Tránsito con ese número.");
    } else {
        console.log(`Proveedor: ${factura.supplier}`);
        console.log(`Fecha de emisión: ${factura.issueDate}`);
        console.log(`Fecha de ingreso al almacén: ${factura.warehouseDate}`);
        console.log(`Códigos adquiridos: ${factura.acquiredCodes}`);
        console.log(`Costo esperado: ${factura.expectedCost}`);
        if (Number.isNaN(factura.expectedCost)) {
            console.log(
                "  (!) Sale NaN porque la columna COSTO ESPERADO es una fórmula de Excel " +
                "y TransitParser todavía no la sabe leer — bug conocido, ya identificado, " +
                "pendiente de arreglar (mismo patrón que ya se arregló en Inventario y Kardex)."
            );
        }
    }
    console.log("========================================\n");

    const f004 = Rule004.execute(data).filter(f => (f.metadata as any)?.normalizedDocument === facturaNormalizada);
    if (f004.length === 0) {
        console.log("RULE_004 (facturas no encontradas en Kardex): sin hallazgos — el documento SÍ se encontró directo en el Kardex (o no corresponde por año)");
    } else {
        console.log(`RULE_004 (facturas no encontradas en Kardex): ${f004.length} hallazgo(s)`);
        for (const f of f004) {
            console.log(`  -> ${f.description}`);
            console.log(`     Costo esperado: ${(f.metadata as any).expectedCost} | Costo encontrado: ${(f.metadata as any).foundCost}`);
        }
    }

    console.log("\n[RULE_012 aún no revisada contra el spec — se muestra su comportamiento actual, sin confirmar]");

    const logOriginal = console.log;
    console.log = () => {};
    const resultadosRule012 = Rule012.execute(data);
    console.log = logOriginal;

    const f012 = resultadosRule012.filter(f => DocumentHelper.normalize((f.metadata as any)?.document ?? "") === facturaNormalizada);
    if (f012.length === 0) {
        console.log("RULE_012 (validación de costo de mercadería en tránsito): sin hallazgos");
    } else {
        for (const f of f012) {
            console.log(`RULE_012: ${f.errorType} -> ${f.description}`);
        }
    }
}

main().catch(e => console.error("ERROR:", e.message));
