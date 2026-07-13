import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { CodeHelper } from "../helpers/code.helper";

interface MonthlySummary {
    month: number;

    initialQuantity: number;
    initialTotalCost: number;

    totalEntryQuantity: number;
    totalEntryCost: number;

    totalExitQuantity: number;
    totalExitCost: number;

    expectedFinalQuantity: number;
    expectedFinalTotalCost: number;

    finalQuantity: number;
    finalTotalCost: number;

    movementCount: number;

    quantityDifference: number;
    totalCostDifference: number;

    quantityIsValid: boolean;
    totalCostIsValid: boolean;
}

export class Rule013 {

    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }

    private static round(value: number): number {
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        console.log("==========================================");
        console.log("RULE_013 - INICIO");
        console.log(`Productos recibidos: ${data.kardex.length}`);
        console.log("==========================================");

        for (const product of data.kardex) {

            if (product.movements.length === 0) {
                continue;
            }

            const normalizedCode = CodeHelper.normalize(product.code);

            /*
             * Agrupamos movimientos por mes.
             */
            const movementsByMonth =
                new Map<number, typeof product.movements>();

            for (const movement of product.movements) {

                if (movement.month === null) {
                    continue;
                }

                if (!movementsByMonth.has(movement.month)) {
                    movementsByMonth.set(movement.month, []);
                }

                movementsByMonth
                    .get(movement.month)!
                    .push(movement);
            }

            /*
             * Validamos cada mes.
             */
            for (const [month, movements] of movementsByMonth) {

                if (movements.length === 0) {
                    continue;
                }

                const firstMovement = movements[0];
                const lastMovement =
                    movements[movements.length - 1];

                /*
                 * Reconstrucción del saldo inicial:
                 *
                 * Inicial + Entrada - Salida = Saldo
                 *
                 * Inicial = Saldo - Entrada + Salida
                 */
                const initialQuantity =
                    firstMovement.balanceQuantity
                    - firstMovement.entryQuantity
                    + firstMovement.exitQuantity;

                const initialTotalCost =
                    firstMovement.balanceTotalCost
                    - firstMovement.entryTotalCost
                    + firstMovement.exitTotalCost;

                /*
                 * Sumatorias mensuales.
                 */
                const totalEntryQuantity = movements.reduce(
                    (sum, movement) =>
                        sum + movement.entryQuantity,
                    0
                );

                const totalEntryCost = movements.reduce(
                    (sum, movement) =>
                        sum + movement.entryTotalCost,
                    0
                );

                const totalExitQuantity = movements.reduce(
                    (sum, movement) =>
                        sum + movement.exitQuantity,
                    0
                );

                const totalExitCost = movements.reduce(
                    (sum, movement) =>
                        sum + movement.exitTotalCost,
                    0
                );

                /*
                 * Saldo final real.
                 */
                const finalQuantity =
                    lastMovement.balanceQuantity;

                const finalTotalCost =
                    lastMovement.balanceTotalCost;

                /*
                 * Saldo final calculado.
                 */
                const expectedFinalQuantity =
                    initialQuantity
                    + totalEntryQuantity
                    - totalExitQuantity;

                const expectedFinalTotalCost =
                    initialTotalCost
                    + totalEntryCost
                    - totalExitCost;

                /*
                 * Diferencias reales.
                 */
                const quantityDifference =
                    expectedFinalQuantity - finalQuantity;

                const totalCostDifference =
                    expectedFinalTotalCost - finalTotalCost;

                const quantityIsValid =
                    this.equals(
                        expectedFinalQuantity,
                        finalQuantity
                    );

                const totalCostIsValid =
                    this.equals(
                        expectedFinalTotalCost,
                        finalTotalCost
                    );

                const summary: MonthlySummary = {
                    month,

                    initialQuantity:
                        this.round(initialQuantity),

                    initialTotalCost:
                        this.round(initialTotalCost),

                    totalEntryQuantity:
                        this.round(totalEntryQuantity),

                    totalEntryCost:
                        this.round(totalEntryCost),

                    totalExitQuantity:
                        this.round(totalExitQuantity),

                    totalExitCost:
                        this.round(totalExitCost),

                    expectedFinalQuantity:
                        this.round(expectedFinalQuantity),

                    expectedFinalTotalCost:
                        this.round(expectedFinalTotalCost),

                    finalQuantity:
                        this.round(finalQuantity),

                    finalTotalCost:
                        this.round(finalTotalCost),

                    movementCount:
                        movements.length,

                    quantityDifference:
                        this.round(quantityDifference),

                    totalCostDifference:
                        this.round(totalCostDifference),

                    quantityIsValid,
                    totalCostIsValid
                };
               

                /*
                 * Construcción de diferencias.
                 */
                const differences: string[] = [];

                if (!quantityIsValid) {
                    differences.push("Cantidad");
                }

                if (!totalCostIsValid) {
                    differences.push("Costo valorizado");
                }

                /*
                 * Si todo cuadra, no generamos finding.
                 */
                if (differences.length === 0) {
                    continue;
                }

                findings.push({
                    ruleId: "RULE_013",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "INVALID_MONTHLY_SUM",

                    description:
                        `Las sumatorias mensuales del producto ` +
                        `${product.code} no cumplen la fórmula ` +
                        `Saldo Inicial + Entradas - Salidas = Saldo Final ` +
                        `para el mes ${month}. Diferencias: ` +
                        `${differences.join(", ")}.`,

                    recommendation:
                        "Verifique las sumatorias mensuales de entradas, " +
                        "salidas y saldos finales del producto.",

                    riskLevel: "CRITICO",

                    metadata: {
                        month,
                        normalizedCode,

                        totals: {
                            entry: {
                                quantity:
                                    summary.totalEntryQuantity,
                                totalCost:
                                    summary.totalEntryCost
                            },

                            exit: {
                                quantity:
                                    summary.totalExitQuantity,
                                totalCost:
                                    summary.totalExitCost
                            }
                        },

                        initialBalance: {
                            quantity:
                                summary.initialQuantity,
                            totalCost:
                                summary.initialTotalCost
                        },

                        expectedFinalBalance: {
                            quantity:
                                summary.expectedFinalQuantity,
                            totalCost:
                                summary.expectedFinalTotalCost
                        },

                        actualFinalBalance: {
                            quantity:
                                summary.finalQuantity,
                            totalCost:
                                summary.finalTotalCost
                        },

                        difference: {
                            quantity:
                                summary.quantityDifference,
                            totalCost:
                                summary.totalCostDifference
                        },

                        movementCount:
                            summary.movementCount,

                        differences
                    }
                });
            }
        }

        console.log("");
        console.log("==========================================");
        console.log("RULE_013 - FIN");
        console.log(`Findings encontrados: ${findings.length}`);
        console.log("==========================================");

        return findings;
    }
}