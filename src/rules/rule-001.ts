import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";

export class Rule001 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        const kardex = new Map<string, KardexProduct>();
        for (const product of data.kardex) {
            kardex.set(product.code.trim().toUpperCase(), product);
        }
        for (const inventory of data.finalInventory) {
            const product = kardex.get(inventory.code);
            if (!product) {
                findings.push({
                    ruleId: "RULE_001",
                    productCode: inventory.code,
                    productName: inventory.product,
                    errorType: "PRODUCT_NOT_FOUND",
                    description: "El producto no existe en el Kardex.",
                    recommendation: "Verifique que el producto exista en ambos archivos.",
                    riskLevel: "CRITICO",
                    metadata: {}
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
                    metadata: {}
                });
                continue;
            }

            const balance = product.movements[product.movements.length - 1];
            const differences = [];
            if (inventory.stock !== balance.balanceQuantity) {
                differences.push("Cantidad");
            }
            if (!this.equals(inventory.unitCost, balance.balanceUnitCost)) {
                differences.push("Costo Unitario");
            }
            if (!this.equals(inventory.totalCost, balance.balanceTotalCost)) {
                differences.push("Costo Total");
            }
            if (differences.length === 0) {
                continue;
            }
            findings.push({
                ruleId: "RULE_001",
                productCode: inventory.code,
                productName: inventory.product,
                errorType: "INVENTORY_MISMATCH",
                description: `El inventario final no coincide con el saldo del Kardex (${differences.join(", ")}).`,
                recommendation: "Verifique los movimientos del Kardex y el inventario final.",
                riskLevel: "CRITICO",
                metadata: {
                    inventoryStock: inventory.stock,
                    kardexStock: balance.balanceQuantity,
                    inventoryUnitCost: inventory.unitCost,
                    kardexUnitCost: balance.balanceUnitCost,
                    inventoryTotalCost: inventory.totalCost,
                    kardexTotalCost: balance.balanceTotalCost
                }
            });
        }
        return findings;
    }
}