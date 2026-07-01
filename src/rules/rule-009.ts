import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DateHelper } from "../helpers/date.helper";
export class Rule009 {
    private static readonly ADJUSTMENT_OPERATION = "28";
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            for (const movement of product.movements) {
                // Solo aplica a movimientos tipo 28
                if (!this.isAdjustmentOperation(movement.operation)) {
                    continue;
                }
                // Solo ingresos (sobrantes)
                if (movement.entryQuantity <= 0) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_009",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "INVENTORY_SURPLUS",
                    description: "Se detectó un ingreso por ajuste de diferencia de inventario (Tipo 28).",
                    recommendation: "Verifique el sustento documentario del ajuste por sobrante.",
                    riskLevel: "ALTO",
                    metadata: {
                        date: DateHelper.toDateString(movement.date),
                        month: movement.month,
                        document: movement.document,
                        operation: movement.operation,
                        entryQuantity: movement.entryQuantity,
                        entryUnitCost: movement.entryUnitCost,
                        entryTotalCost: movement.entryTotalCost,
                        balanceQuantity: movement.balanceQuantity,
                        balanceUnitCost: movement.balanceUnitCost,
                        balanceTotalCost: movement.balanceTotalCost
                    }
                });
            }
        }
        return findings;
    }
    private static isAdjustmentOperation(operation: string): boolean {
        const value = (operation ?? "").trim().toUpperCase();
        return value === this.ADJUSTMENT_OPERATION || value.startsWith(this.ADJUSTMENT_OPERATION);
    }
}