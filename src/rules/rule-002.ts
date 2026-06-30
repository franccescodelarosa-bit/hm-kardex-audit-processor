import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";

export class Rule002 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        // Agrupar productos por código.
        // El orden de inserción ya corresponde a Enero -> Diciembre
        const history = new Map<string, KardexProduct[]>();
        for (const product of data.kardex) {
            const code = CodeHelper.normalize(product.code);
            if (!history.has(code)) {
                history.set(code, []);
            }
            history.get(code)!.push(product);
        }

        // Procesar cada producto
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
                if (!this.equals(currentLast.balanceQuantity, nextFirst.balanceQuantity)) {
                    differences.push("Cantidad");
                }
                if (!this.equals(currentLast.balanceUnitCost, nextFirst.balanceUnitCost)) {
                    differences.push("Costo Unitario");
                }
                if (!this.equals(currentLast.balanceTotalCost, nextFirst.balanceTotalCost)) {
                    differences.push("Costo Total");
                }
                
                if (differences.length === 0) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_002",
                    productCode: current.code,
                    productName: current.description,
                    errorType: "MONTHLY_CONTINUITY_ERROR",
                    description: `No existe continuidad entre el saldo final del mes ${i + 1} y el saldo inicial del mes ${i + 2}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique que el saldo final del período coincida con el saldo inicial del siguiente.",
                    riskLevel: "ALTO",
                    metadata: {
                        "fromMonth": i + 1,
                        "toMonth": i + 2,
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