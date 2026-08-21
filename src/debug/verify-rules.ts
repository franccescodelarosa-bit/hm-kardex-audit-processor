import { InventoryParser } from "../parsers/inventory.parser";
import { KardexParser } from "../parsers/kardex.parser";
import { Rule001 } from "../rules/rule-001";
import { Rule013 } from "../rules/rule-013";
import { AuditData } from "../models/audit-data";
import { CodeHelper } from "../helpers/code.helper";

const INVENTARIO_INICIAL_PATH = process.argv[2] || "";
const KARDEX_PATH = process.argv[3] || "";

async function main() {
    if (!INVENTARIO_INICIAL_PATH || !KARDEX_PATH) {
        console.log("Uso: npx ts-node src/debug/verify-rules.ts \"<inventario inicial.xlsx>\" \"<kardex.xlsx>\"");
        process.exit(1);
    }

    console.log("Parseando Inventario Inicial...");
    const initialInventory = await InventoryParser.parse(INVENTARIO_INICIAL_PATH);
    console.log(`  -> ${initialInventory.length} productos leidos`);

    console.log("Parseando Kardex...");
    const kardex = await KardexParser.parse(KARDEX_PATH);
    console.log(`  -> ${kardex.length} productos leidos`);

    const auditData: AuditData = {
        initialInventory,
        finalInventory: [],
        transit: [],
        kardex
    };

    console.log("\n================ RULE_001 (codigo actual, tal cual esta hoy) ================");
    const findings001 = Rule001.execute(auditData);
    console.log(`Findings generados: ${findings001.length}`);
    console.log("Primeros 3 findings:");
    console.log(JSON.stringify(findings001.slice(0, 3), null, 2));

    console.log("\n================ Que DEBERIA pasar segun el spec de ================");
    console.log("(Inventario Inicial vs Saldo Inicial del Kardex, TipoOp=16, quedandose con el PRIMER duplicado)");

    const kardexByCode = new Map<string, (typeof kardex)[number]>();
    for (const product of kardex) {
        const code = CodeHelper.normalize(product.code);
        if (kardexByCode.has(code)) continue; // nos quedamos con el PRIMERO
        kardexByCode.set(code, product);
    }

    let matches = 0;
    let mismatches = 0;
    let notFound = 0;
    let withoutSaldoInicial = 0;
    const sampleMismatches: unknown[] = [];

    for (const inv of initialInventory) {
        const code = CodeHelper.normalize(inv.code);
        const product = kardexByCode.get(code);
        if (!product) {
            notFound++;
            continue;
        }
        const saldoInicial = product.movements.find(
            m => String(m.operation).trim() === "16"
        );
        if (!saldoInicial) {
            withoutSaldoInicial++;
            continue;
        }
        const diff = Math.abs(inv.stock - saldoInicial.balanceQuantity);
        if (diff < 0.01) {
            matches++;
        } else {
            mismatches++;
            if (sampleMismatches.length < 3) {
                sampleMismatches.push({
                    code: inv.code,
                    product: inv.product,
                    stockInventarioInicial: inv.stock,
                    saldoInicialKardex: saldoInicial.balanceQuantity
                });
            }
        }
    }

    console.log(`Productos del Inventario Inicial NO encontrados en el Kardex: ${notFound}`);
    console.log(`Productos encontrados pero sin fila TipoOp=16 (Saldo Inicial): ${withoutSaldoInicial}`);
    console.log(`Coinciden (Inventario vs Saldo Inicial Kardex): ${matches}`);
    console.log(`NO coinciden: ${mismatches}`);
    console.log("Ejemplos de mismatches reales:");
    console.log(JSON.stringify(sampleMismatches, null, 2));

    console.log("\n================ RULE_013 (codigo actual) ================");
    const findings013 = Rule013.execute(auditData);
    console.log(`Findings generados: ${findings013.length}`);
    console.log("Primeros 3 findings:");
    console.log(JSON.stringify(findings013.slice(0, 3), null, 2));
}

main().catch(err => {
    console.error("ERROR:", err);
    process.exit(1);
});
