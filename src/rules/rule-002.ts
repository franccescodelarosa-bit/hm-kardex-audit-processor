import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexHelper } from "../helpers/kardex.helper";

export class Rule002 {

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
                // Cantidad
                if (!this.equals(current.finalQuantity, next.initialQuantity)) {
                    differences.push("Cantidad");
                }
                // Costo Unitario
                if (!this.equals(current.finalUnitCost, next.finalUnitCost)) {
                    differences.push("Costo Unitario");
                }
                // Importe Total
                if (!this.equals(current.finalTotalCost, next.initialTotalCost)) {
                    differences.push("Costo Total");
                }
                if (differences.length === 0) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_002",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "MONTHLY_CONTINUITY_ERROR",
                    description:
                        `No existe continuidad entre los meses ${current.month} y ${next.month}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique que el saldo final del período coincida con el saldo inicial del siguiente.",
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