import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";

export class Rule003 {

    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        // Agrupar productos por código.
        // El orden ya corresponde a Enero -> Diciembre
        const history = new Map<string, KardexProduct[]>();

        for (const product of data.kardex) {

            const code = CodeHelper.normalize(product.code);

            if (!history.has(code)) {
                history.set(code, []);
            }

            history.get(code)!.push(product);
        }

        for (const [code, months] of history) {            

            if (months.length < 2) {
                continue;
            }

            for (let i = 0; i < months.length - 1; i++) {

                const current = months[i];
                const next = months[i + 1];

                const currentLast = current.movements[current.movements.length - 1];
                const nextFirst = next.movements[0];

                if (!currentLast || !nextFirst) {
                    continue;
                }

                const differences: string[] = [];

                // Costo Unitario
                if (!this.equals(
                    currentLast.balanceUnitCost,
                    nextFirst.balanceUnitCost
                )) {
                    differences.push("Costo Unitario");
                }

                // Costo Total
                if (!this.equals(
                    currentLast.balanceTotalCost,
                    nextFirst.balanceTotalCost
                )) {
                    differences.push("Costo Total");
                }

                if (differences.length === 0) {
                    continue;
                }

                findings.push({
                    ruleId: "RULE_003",
                    productCode: current.code,
                    productName: current.description,
                    errorType: "MONTHLY_COST_CONTINUITY_ERROR",
                    description: `No existe continuidad de costos entre el cierre del mes ${i + 1} y el inicio del mes ${i + 2}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique que el costo unitario y el costo total del saldo final coincidan con el saldo inicial del siguiente período.",
                    riskLevel: "ALTO",
                    metadata: {
                        fromIndex: i + 1,
                        toIndex: i + 2,
                        finalBalance: {
                            quantity: currentLast.balanceQuantity,
                            unitCost: currentLast.balanceUnitCost,
                            totalCost: currentLast.balanceTotalCost
                        },
                        initialBalance: {
                            quantity: nextFirst.balanceQuantity,
                            unitCost: nextFirst.balanceUnitCost,
                            totalCost: nextFirst.balanceTotalCost
                        },
                        differences
                    }
                });
            }
        }

        return findings;
    }
}