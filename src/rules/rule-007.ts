import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexHelper } from "../helpers/kardex.helper";

export class Rule007 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            const months = KardexHelper.getMonthlyBalances(product);
            for (const month of months) {
                // Aquí asumimos que el helper conserva los movimientos del mes.
                // Si no los devuelve, basta con recorrer product.movements filtrando por mes.
                const movements = product.movements.filter(
                    m => m.month === month.month
                );
                const totalEntriesQty = movements.reduce(
                    (sum, m) => sum + m.entryQuantity,
                    0
                );
                const totalExitsQty = movements.reduce(
                    (sum, m) => sum + m.exitQuantity,
                    0
                );
                const totalEntriesCost = movements.reduce(
                    (sum, m) => sum + m.entryTotalCost,
                    0
                );
                const totalExitsCost = movements.reduce(
                    (sum, m) => sum + m.exitTotalCost,
                    0
                );
                const expectedFinalQty =
                    month.initialQuantity +
                    totalEntriesQty -
                    totalExitsQty;

                const expectedFinalCost =
                    month.initialTotalCost +
                    totalEntriesCost -
                    totalExitsCost;

                const differences: string[] = [];

                if (!this.equals(expectedFinalQty, month.finalQuantity)) {
                    differences.push("Cantidad");
                }

                if (!this.equals(expectedFinalCost, month.finalTotalCost)) {
                    differences.push("Costo Total");
                }

                if (differences.length === 0) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_007",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "INVALID_SUM",
                    description:
                        `Las sumatorias del Kardex no cuadran para el mes ${month.month}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique los movimientos registrados y los saldos del Kardex.",
                    riskLevel: "CRITICO",
                    metadata: {
                        month: month.month,
                        expectedFinalQuantity: expectedFinalQty,
                        actualFinalQuantity: month.finalQuantity,
                        expectedFinalTotalCost: expectedFinalCost,
                        actualFinalTotalCost: month.finalTotalCost
                    }
                });
            }
        }
        return findings;
    }
}