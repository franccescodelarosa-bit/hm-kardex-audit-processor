import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";

export class Rule001 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    private static debugCount = 0;
    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        console.log("========================================");
        console.log("RULE001 START");
        console.log("KARDEX PRODUCTS:", data.kardex.length);
        console.log("FINAL INVENTORY:", data.initialInventory.length);
        console.log("========================================");

        const kardex = new Map<string, KardexProduct>();

        let index = 0;

        for (const product of data.kardex) {

            const normalized = CodeHelper.normalize(product.code);

            if (index < 10) {
                console.log(
                    `[KARDEX ${index}] original='${product.code}' normalized='${normalized}' movements=${product.movements.length}`
                );
            }

            kardex.set(normalized, product);

            index++;
        }

        console.log("========================================");
        console.log("MAP SIZE:", kardex.size);
        console.log("FIRST MAP KEYS:");
        console.log([...kardex.keys()].slice(0, 20));
        console.log("========================================");

        index = 0;

        for (const inventory of data.initialInventory) {

            const code = CodeHelper.normalize(inventory.code);            
            const product = kardex.get(code);            
            
            if (!product) {

                findings.push({
                    ruleId: "RULE_001",
                    productCode: inventory.code,
                    productName: inventory.product,
                    errorType: "PRODUCT_NOT_FOUND",
                    description: "El producto no existe en el Kardex.",
                    recommendation: "Verifique que el producto exista en ambos archivos.",
                    riskLevel: "CRITICO",
                    metadata: {
                        month: 0,
                    }
                });

                continue;
            }

            if (product.movements.length === 0) {

                findings.push({
                    ruleId: "RULE_001",
                    productCode: inventory.code,
                    productName: inventory.product,
                    errorType: "WITHOUT_MOVEMENTS",
                    description: "El producto no posee movimientos en el Kardex.",
                    recommendation: "Revise el Kardex del producto.",
                    riskLevel: "ALTO",
                    metadata: {
                        month: 0,
                    }
                });

                continue;
            }

            const validMovements = product.movements.filter(
                movement =>
                    Number(movement.entryQuantity || 0) > 0 ||
                    Number(movement.exitQuantity || 0) > 0
            );
            if (validMovements.length === 0) {
                continue;
            }

            const balance = validMovements[validMovements.length - 1];
            const differences: string[] = [];

            if (!this.equals(inventory.stock, balance.balanceQuantity))
                differences.push("Cantidad");

            if (!this.equals(inventory.unitCost, balance.balanceUnitCost))
                differences.push("Costo Unitario");

            if (!this.equals(inventory.totalCost, balance.balanceTotalCost))
                differences.push("Costo Total");

            if (differences.length === 0)
                continue;

            findings.push({
                ruleId: "RULE_001",
                productCode: inventory.code,
                productName: inventory.product,
                errorType: "INVENTORY_MISMATCH",
                description: `El inventario final no coincide con el saldo del Kardex (${differences.join(", ")}).`,
                recommendation: "Verifique los movimientos del Kardex y el inventario final.",
                riskLevel: "CRITICO",
                metadata: {
                    month: balance.month,
                    inventoryCode: inventory.code,
                    normalizedCode: code,
                    inventoryStock: inventory.stock,
                    kardexStock: balance.balanceQuantity,
                    inventoryUnitCost: inventory.unitCost,
                    kardexUnitCost: balance.balanceUnitCost,
                    inventoryTotalCost: inventory.totalCost,
                    kardexTotalCost: balance.balanceTotalCost,
                    kardexMovements: product.movements.length
                }
            });

        }

        return findings;
    }
}