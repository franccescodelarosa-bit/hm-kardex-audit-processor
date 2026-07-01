import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { CodeHelper } from "../helpers/code.helper";
import { DateHelper } from "../helpers/date.helper";

export class Rule007 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            if (product.movements.length < 2) {
                continue;
            }
            const normalizedCode = CodeHelper.normalize(product.code);
            // Empezamos desde el segundo movimiento
            for (let i = 1; i < product.movements.length; i++) {
                const previous = product.movements[i - 1];
                const current = product.movements[i];
                const expectedQuantity =
                    previous.balanceQuantity +
                    current.entryQuantity -
                    current.exitQuantity;

                const expectedTotalCost =
                    previous.balanceTotalCost +
                    current.entryTotalCost -
                    current.exitTotalCost;

                const differences: string[] = [];
                if (!this.equals(expectedQuantity, current.balanceQuantity)) {
                    differences.push("Cantidad");
                }
                /*if (!this.equals(expectedTotalCost, current.balanceTotalCost)) {
                    differences.push("Costo Total");
                }*/                
                if (differences.length === 0) {
                    continue;
                }
                findings.push({
                    ruleId: "RULE_007",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "INVALID_SUM",
                    description: `La operación ${current.operation} del ${DateHelper.toDateString(current.date)} no cumple la fórmula del Kardex: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique que el saldo anterior, las entradas y las salidas generen correctamente el saldo final.",
                    riskLevel: "CRITICO",
                    metadata: {
                        month: current.month,
                        movement: i + 1,
                        operation: current.operation,
                        document: current.document,
                        previousBalance: {
                            quantity: previous.balanceQuantity,
                            totalCost: previous.balanceTotalCost
                        },
                        movimientos: {
                            entryQuantity: current.entryQuantity,
                            exitQuantity: current.exitQuantity,
                            entryTotalCost: current.entryTotalCost,
                            exitTotalCost: current.exitTotalCost
                        },
                        expectedBalance: {
                            quantity: expectedQuantity,
                            totalCost: expectedTotalCost
                        },
                        actualBalance: {
                            quantity: current.balanceQuantity,
                            totalCost: current.balanceTotalCost
                        },
                        differences
                    }
                });

            }

        }

        return findings;

    }

}