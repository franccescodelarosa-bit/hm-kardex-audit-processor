
import { InventoryParser } from "../parsers/inventory.parser";
import { KardexParser } from "../parsers/kardex.parser";
import { CodeHelper } from "../helpers/code.helper";
import { Rule001 } from "../rules/rule-001";
import { Rule002 } from "../rules/rule-002";
import { Rule003 } from "../rules/rule-003";
import { Rule005 } from "../rules/rule-005";
import { Rule006 } from "../rules/rule-006";
import { Rule007 } from "../rules/rule-007";
import { Rule008 } from "../rules/rule-008";
import { Rule009 } from "../rules/rule-009";
import { Rule010 } from "../rules/rule-010";
import { Rule011 } from "../rules/rule-011";
import { Rule013 } from "../rules/rule-013";
import { Rule014 } from "../rules/rule-014";
import { AuditData } from "../models/audit-data";

async function main() {
    const [codigoArg, inventarioPath, ...kardexPaths] = process.argv.slice(2);

    if (!codigoArg || !inventarioPath || kardexPaths.length === 0) {
        console.log("Uso: npx ts-node src/debug/check-product.ts <codigo> <inventario-inicial.xlsx> <kardex1.xlsx> [<kardex2.xlsx> ...]");
        process.exit(1);
    }

    const codigo = CodeHelper.normalize(codigoArg);

    console.log(`\nBuscando producto "${codigoArg}" (normalizado: "${codigo}")...\n`);

    const initialInventory = await InventoryParser.parse(inventarioPath);

    let kardex: Awaited<ReturnType<typeof KardexParser.parse>> = [];
    for (const path of kardexPaths) {
        const productos = await KardexParser.parse(path);
        kardex = kardex.concat(productos);
    }

    const data: AuditData = { year: 2024, initialInventory, finalInventory: [], transit: [], kardex };

    const enInventario = initialInventory.find(i => CodeHelper.normalize(i.code) === codigo);
    const bloquesKardex = kardex.filter(p => CodeHelper.normalize(p.code) === codigo);

    console.log("========================================");
    console.log("LO QUE SE ENCONTRÓ PARA ESTE PRODUCTO");
    console.log("========================================");
    console.log("En el Inventario Inicial:", enInventario
        ? `stock=${enInventario.stock}, costoUnit=${enInventario.unitCost}, costoTotal=${enInventario.totalCost}`
        : "NO aparece (no tenía stock al cierre del año anterior)");
    console.log(`En el Kardex: ${bloquesKardex.length} bloque(s) de movimientos encontrados`);
    for (const b of bloquesKardex) {
        const mes = b.movements.find(m => m.month !== null)?.month;
        const saldoInicial = b.movements.find(m => String(m.operation).trim() === "16");
        console.log(`  - ${b.movements.length} movimientos, mes ${mes}`);
        if (saldoInicial) {
            console.log(`    Saldo Inicial (TipOp 16): cantidad=${saldoInicial.balanceQuantity}, costoUnit=${saldoInicial.balanceUnitCost}, costoTotal=${saldoInicial.balanceTotalCost}`);
        }
        const ultimo = b.movements[b.movements.length - 1];
        if (ultimo) {
            console.log(`    Saldo Final del mes (última fila): cantidad=${ultimo.balanceQuantity}, costoUnit=${ultimo.balanceUnitCost}, costoTotal=${ultimo.balanceTotalCost}`);
        }
    }
    console.log("========================================\n");

    const reglas: [string, () => any[]][] = [
        ["RULE_001 (Inventario vs Saldo Inicial Kardex)", () => Rule001.execute(data)],
        ["RULE_002 (continuidad mensual - cantidad)", () => Rule002.execute(data)],
        ["RULE_003 (continuidad mensual - costo)", () => Rule003.execute(data)],
        ["RULE_005 (saldos negativos)", () => Rule005.execute(data)],
        ["RULE_006 (códigos duplicados)", () => Rule006.execute(data)],
        ["RULE_007 (sumatorias por movimiento)", () => Rule007.execute(data)],
        ["RULE_008 (código en Kardex sin inventario)", () => Rule008.execute(data)],
        ["RULE_009 (ajustes por sobrante)", () => Rule009.execute(data)],
        ["RULE_010 (ajustes por faltante)", () => Rule010.execute(data)],
        ["RULE_011 (variación inusual de costo)", () => Rule011.execute(data)],
        ["RULE_013 (sumatorias mensuales por producto)", () => Rule013.execute(data)],
        ["RULE_014 (sumatorias mensuales consolidadas)", () => Rule014.execute(data)]
    ];

    for (const [nombre, ejecutar] of reglas) {
        const todos = ejecutar();
        const delProducto = todos.filter((f: any) => CodeHelper.normalize(f.productCode) === codigo);
        if (delProducto.length === 0) {
            console.log(`${nombre}: sin hallazgos`);
        } else {
            console.log(`${nombre}: ${delProducto.length} hallazgo(s)`);
            for (const f of delProducto) {
                console.log(`  -> ${f.description}`);
            }
        }
    }

    console.log("\n(RULE_004 y RULE_012 no se corrieron acá — son de mercadería en tránsito, necesitan ese Excel aparte.)");
}

main().catch(e => console.error("ERROR:", e.message));
