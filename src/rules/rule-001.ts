import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";

export class Rule001 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }

    /** TipoOP 16 = Saldo Inicial (misma convención que Rule002/Rule003). */
    private static readonly INITIAL_BALANCE_OPERATION = "16";

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        console.log("========================================");
        console.log("RULE001 START");
        console.log("KARDEX PRODUCTS:", data.kardex.length);
        console.log("INITIAL INVENTORY:", data.initialInventory.length);
        console.log("========================================");

        const kardex = new Map<string, KardexProduct>();

        for (const product of data.kardex) {

            const normalized = CodeHelper.normalize(product.code);

            if (!kardex.has(normalized)) {
                kardex.set(normalized, product);
            }
        }

        console.log("MAP SIZE (productos unicos):", kardex.size);
        console.log("========================================");

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

            const balance = product.movements.find(
                movement =>
                    String(movement.operation).trim() ===
                    this.INITIAL_BALANCE_OPERATION
            );

            if (!balance) {
                continue;
            }

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
                description: `El inventario inicial no coincide con el Saldo Inicial del Kardex (${differences.join(", ")}).`,
                recommendation: "Verifique el inventario inicial y el Saldo Inicial (TipoOp 16) del Kardex.",
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