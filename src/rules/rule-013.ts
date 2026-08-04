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

    lowerCostLimit: number;
    upperCostLimit: number;

    finalQuantity: number;
    finalTotalCost: number;

    movementCount: number;

    quantityDifference: number;
    totalCostDifference: number;

    quantityIsValid: boolean;
    totalCostIsValid: boolean;
}

export class Rule013 {

    /*
     * Tolerancia para comparación exacta de cantidades.
     */
    private static readonly QUANTITY_TOLERANCE = 0.01;

    /*
     * Tolerancia contable del costo valorizado:
     * ±2.5%
     */
    private static readonly COST_TOLERANCE_PERCENT = 0.025;

    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < this.QUANTITY_TOLERANCE;
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

            const normalizedCode =
                CodeHelper.normalize(product.code);

            /*
             * =========================================================
             * AGRUPAR MOVIMIENTOS POR MES
             * =========================================================
             */
            const movementsByMonth =
                new Map<number, typeof product.movements>();

            for (const movement of product.movements) {

                if (movement.month === null) {
                    continue;
                }

                if (!movementsByMonth.has(movement.month)) {
                    movementsByMonth.set(
                        movement.month,
                        []
                    );
                }

                movementsByMonth
                    .get(movement.month)!
                    .push(movement);
            }

            /*
             * =========================================================
             * VALIDAR CADA MES
             * =========================================================
             */
            for (const [month, movements] of movementsByMonth) {

                if (movements.length === 0) {
                    continue;
                }

                const firstMovement = movements[0];

                const lastMovement =
                    movements[movements.length - 1];

                /*
                 * =====================================================
                 * SALDO INICIAL
                 * =====================================================
                 *
                 * El saldo inicial NO se mezcla con las entradas.
                 *
                 * Se reconstruye usando el saldo resultante del primer
                 * movimiento:
                 *
                 * Saldo Inicial
                 * + Entrada
                 * - Salida
                 * = Saldo Final del movimiento
                 *
                 * Por tanto:
                 *
                 * Saldo Inicial
                 * = Saldo Final
                 * - Entrada
                 * + Salida
                 *
                 * Esto permite separar:
                 *
                 * - Saldo inicial
                 * - Entradas reales del período
                 * - Salidas reales del período
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
                 * =====================================================
                 * SUMA DE ENTRADAS DEL MES
                 * =====================================================
                 *
                 * Aquí se imprimen únicamente las columnas ENTRADAS
                 * del Kardex.
                 */
                const totalEntryQuantity =
                    movements.reduce(
                        (sum, movement) =>
                            sum + movement.entryQuantity,
                        0
                    );

                const totalEntryCost =
                    movements.reduce(
                        (sum, movement) =>
                            sum + movement.entryTotalCost,
                        0
                    );

                /*
                 * =====================================================
                 * SUMA DE SALIDAS DEL MES
                 * =====================================================
                 */
                const totalExitQuantity =
                    movements.reduce(
                        (sum, movement) =>
                            sum + movement.exitQuantity,
                        0
                    );

                const totalExitCost =
                    movements.reduce(
                        (sum, movement) =>
                            sum + movement.exitTotalCost,
                        0
                    );

                /*
                 * =====================================================
                 * SALDO FINAL REAL
                 * =====================================================
                 *
                 * Se toma del último movimiento del mes.
                 */
                const finalQuantity =
                    lastMovement.balanceQuantity;

                const finalTotalCost =
                    lastMovement.balanceTotalCost;

                /*
                 * =====================================================
                 * CANTIDAD ESPERADA
                 * =====================================================
                 *
                 * La cantidad debe cumplir:
                 *
                 * Saldo Inicial
                 * + Entradas
                 * - Salidas
                 * = Saldo Final
                 */
                const expectedFinalQuantity =
                    initialQuantity
                    + totalEntryQuantity
                    - totalExitQuantity;

                /*
                 * =====================================================
                 * COSTO VALORIZADO CALCULADO
                 * =====================================================
                 *
                 * Este valor NO se compara por igualdad exacta.
                 *
                 * Se utiliza como base para calcular el rango
                 * permitido de ±2.5%.
                 */
                const expectedFinalTotalCost =
                    initialTotalCost
                    + totalEntryCost
                    - totalExitCost;

                /*
                 * =====================================================
                 * RANGO PERMITIDO DEL COSTO
                 * =====================================================
                 *
                 * Mínimo = resultado × 97.5%
                 * Máximo = resultado × 102.5%
                 */
                const lowerCostLimit =
                    expectedFinalTotalCost
                    * (
                        1
                        - this.COST_TOLERANCE_PERCENT
                    );

                const upperCostLimit =
                    expectedFinalTotalCost
                    * (
                        1
                        + this.COST_TOLERANCE_PERCENT
                    );

                /*
                 * =====================================================
                 * DIFERENCIAS
                 * =====================================================
                 */
                const quantityDifference =
                    expectedFinalQuantity
                    - finalQuantity;

                const totalCostDifference =
                    expectedFinalTotalCost
                    - finalTotalCost;

                /*
                 * =====================================================
                 * VALIDACIÓN DE CANTIDAD
                 * =====================================================
                 *
                 * Debe ser prácticamente exacta.
                 */
                const quantityIsValid =
                    this.equals(
                        expectedFinalQuantity,
                        finalQuantity
                    );

                /*
                 * =====================================================
                 * VALIDACIÓN DE COSTO
                 * =====================================================
                 *
                 * El saldo final real debe encontrarse dentro de:
                 *
                 * 97.5% <= Saldo Final Real <= 102.5%
                 *
                 * del costo valorizado calculado.
                 */
                const totalCostIsValid =
                    finalTotalCost >= lowerCostLimit
                    &&
                    finalTotalCost <= upperCostLimit;

                /*
                 * =====================================================
                 * RESUMEN
                 * =====================================================
                 */
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

                    lowerCostLimit:
                        this.round(lowerCostLimit),

                    upperCostLimit:
                        this.round(upperCostLimit),

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
                 * =====================================================
                 * CONSTRUCCIÓN DE DIFERENCIAS
                 * =====================================================
                 */
                const differences: string[] = [];

                if (!quantityIsValid) {
                    differences.push("Cantidad");
                }

                if (!totalCostIsValid) {
                    differences.push(
                        "Costo valorizado fuera del rango permitido"
                    );
                }

                /*
                 * Si cantidad y costo cumplen, no existe observación.
                 */
                if (differences.length === 0) {
                    continue;
                }

                /*
                 * =====================================================
                 * FINDING
                 * =====================================================
                 */
                findings.push({

                    ruleId: "RULE_013",

                    productCode:
                        product.code,

                    productName:
                        product.description,

                    errorType:
                        "INVALID_MONTHLY_SUM",

                    description:
                        `Las sumatorias mensuales del producto ` +
                        `${product.code} presentan diferencias ` +
                        `para el mes ${month}. ` +
                        `La cantidad debe cumplir la fórmula ` +
                        `Saldo Inicial + Entradas - Salidas = Saldo Final. ` +
                        `El costo valorizado final debe encontrarse ` +
                        `entre el 97.5% y el 102.5% del costo calculado. ` +
                        `Diferencias: ${differences.join(", ")}.`,

                    recommendation:
                        "Verifique el saldo inicial, las sumatorias " +
                        "mensuales de entradas y salidas, y confirme " +
                        "que el costo valorizado final se encuentre " +
                        "dentro del rango permitido de ±2.5%.",

                    riskLevel:
                        "CRITICO",

                    metadata: {

                        month,

                        normalizedCode,

                        /*
                         * SALDO INICIAL
                         *
                         * Se mantiene separado de las entradas.
                         */
                        initialBalance: {
                            quantity:
                                summary.initialQuantity,

                            totalCost:
                                summary.initialTotalCost
                        },

                        /*
                         * SUMATORIAS REALES DEL KARDEX
                         */
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

                        /*
                         * RESULTADO CALCULADO
                         */
                        expectedFinalBalance: {

                            quantity:
                                summary.expectedFinalQuantity,

                            totalCost:
                                summary.expectedFinalTotalCost
                        },

                        /*
                         * RANGO DE TOLERANCIA DEL COSTO
                         */
                        costTolerance: {

                            percentage: 2.5,

                            lowerLimit:
                                summary.lowerCostLimit,

                            upperLimit:
                                summary.upperCostLimit
                        },

                        /*
                         * SALDO FINAL REAL DEL KARDEX
                         */
                        actualFinalBalance: {

                            quantity:
                                summary.finalQuantity,

                            totalCost:
                                summary.finalTotalCost
                        },

                        /*
                         * DIFERENCIAS INFORMATIVAS
                         */
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
        console.log(
            `Findings encontrados: ${findings.length}`
        );
        console.log("==========================================");

        return findings;
    }
}