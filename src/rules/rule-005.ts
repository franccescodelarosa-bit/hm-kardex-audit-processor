import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { InventoryItem } from "../models/inventory-item";
import { KardexProduct } from "../models/kardex-product";
export class Rule005 {
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        this.validateInventory(data.initialInventory, "Inventario Inicial", findings);
        this.validateInventory(data.finalInventory, "Inventario Final", findings);
        this.validateKardex(data.kardex,findings);
        return findings;
    }

    private static validateInventory(inventory: InventoryItem[],source: string,findings: Finding[]) {
        for (const item of inventory) {
            if ( item.stock < 0 || item.unitCost < 0 || item.totalCost < 0) {
                findings.push({
                    ruleId: "RULE_005",
                    productCode: item.code,
                    productName: item.product,
                    errorType: "NEGATIVE_BALANCE",
                    description: `${source}: el producto presenta valores negativos.`,
                    recommendation: "Verifique los movimientos del Kardex y los ajustes de inventario.",
                    riskLevel: "CRITICO",
                    metadata: {
                        source,
                        stock: item.stock,
                        unitCost: item.unitCost,
                        totalCost: item.totalCost
                    }
                });
            }
        }
    }

    private static validateKardex(kardex: KardexProduct[],findings: Finding[]) {
        for (const product of kardex) {
            for (const movement of product.movements) {
                const hasNegative =
                    movement.entryQuantity < 0 ||
                    movement.entryUnitCost < 0 ||
                    movement.entryTotalCost < 0 ||
                    movement.exitQuantity < 0 ||
                    movement.exitUnitCost < 0 ||
                    movement.exitTotalCost < 0 ||
                    movement.balanceQuantity < 0 ||
                    movement.balanceUnitCost < 0 ||
                    movement.balanceTotalCost < 0;
                
                if (hasNegative) {
                    findings.push({
                        ruleId: "RULE_005",
                        productCode: product.code,
                        productName: product.description,
                        errorType: "NEGATIVE_BALANCE",
                        description: "El Kardex presenta un saldo negativo.",
                        recommendation:"Revise los movimientos anteriores, ajustes de inventario y valorización del producto.",
                        riskLevel: "CRITICO",
                        metadata: {
                            source: "KARDEX",
                            date: movement.date,
                            month: movement.month,
                            document: movement.document,
                            operation: movement.operation,
                            balanceQuantity: movement.balanceQuantity,
                            balanceUnitCost: movement.balanceUnitCost,
                            balanceTotalCost: movement.balanceTotalCost,
                            entryQuantity: movement.entryQuantity,
                            entryUnitCost: movement.entryUnitCost,
                            entryTotalCost: movement.entryTotalCost,
                            exitQuantity: movement.exitQuantity,
                            exitUnitCost: movement.exitUnitCost,
                            exitTotalCost: movement.exitTotalCost
                        }
                    });
                }
            }
        }
    }
}