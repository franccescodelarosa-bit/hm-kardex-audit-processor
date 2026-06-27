import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";

export class Rule011 {

    private static readonly ADJUSTMENT_OPERATION = "28";
    // Pendiente de validación funcional con el cliente.
    // Actualmente se considera una variación mayor al 50%.
    private static readonly COST_VARIATION_THRESHOLD = 0.50;
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            if (product.movements.length < 2) {
                continue;
            }
            for (let i = 1; i < product.movements.length; i++) {
                const previous = product.movements[i - 1];
                const current = product.movements[i];
                // Solo aplica a movimientos tipo 28
                if (!this.isAdjustmentOperation(current.operation)) {
                    continue;
                }
                if (previous.balanceUnitCost <= 0) {
                    continue;
                }
                const variation =
                    Math.abs(
                        current.balanceUnitCost - previous.balanceUnitCost
                    ) / previous.balanceUnitCost;

                if (variation <= this.COST_VARIATION_THRESHOLD) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_011",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "UNUSUAL_UNIT_COST_VARIATION",
                    description:
                        "Se detectó una variación inusual del costo unitario en un ajuste de inventario (Tipo 28).",
                    recommendation:
                        "Verifique la valorización del ajuste y su sustento documentario.",
                    riskLevel: "MEDIO",
                    metadata: {
                        date: current.date,
                        month: current.month,
                        document: current.document,
                        operation: current.operation,
                        previousCost: previous.balanceUnitCost,
                        currentCost: current.balanceUnitCost,
                        variationPercent:
                            Number((variation * 100).toFixed(2))
                    }
                });
            }
        }
        return findings;
    }

    private static isAdjustmentOperation(operation: string): boolean {
        const value = (operation ?? "").trim().toUpperCase();
        return (
            value === this.ADJUSTMENT_OPERATION ||
            value.startsWith(this.ADJUSTMENT_OPERATION)
        );
    }
}