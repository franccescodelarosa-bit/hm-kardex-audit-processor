import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexHelper } from "../helpers/kardex.helper";

export class Rule003 {

    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }

    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            const months = KardexHelper.getMonthlyBalances(product);
            if (months.length < 2) {
                continue;
            }
            for (let i = 0; i < months.length - 1; i++) {
                const current = months[i];
                const next = months[i + 1];
                const differences: string[] = [];

                // Costo Unitario
                if (!this.equals(current.finalUnitCost, next.finalUnitCost)) {
                    differences.push("Costo Unitario");
                }

                // Costo Total
                if (!this.equals(current.finalTotalCost, next.initialTotalCost)) {
                    differences.push("Costo Total");
                }

                if (differences.length === 0) {
                    continue;
                }

                findings.push({
                    ruleId: "RULE_003",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "MONTHLY_COST_CONTINUITY_ERROR",
                    description:
                        `No existe continuidad de costos entre los meses ${current.month} y ${next.month}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique la continuidad de los costos entre ambos períodos.",
                    riskLevel: "ALTO",
                    metadata: {
                        currentMonth: current.month,
                        nextMonth: next.month,
                        current,
                        next
                    }
                });
            }
        }
        return findings;
    }
}