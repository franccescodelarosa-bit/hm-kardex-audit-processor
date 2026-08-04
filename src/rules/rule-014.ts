import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";

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

    productCount: number;
    movementCount: number;

    quantityDifference: number;
    totalCostDifference: number;

    quantityIsValid: boolean;
    totalCostIsValid: boolean;
}

interface ProductMonthlySummary {
    initialQuantity: number;
    initialTotalCost: number;

    totalEntryQuantity: number;
    totalEntryCost: number;

    totalExitQuantity: number;
    totalExitCost: number;

    finalQuantity: number;
    finalTotalCost: number;

    movementCount: number;
}

export class Rule014 {

    /*
     * Tolerancia para cantidad.
     */
    private static readonly QUANTITY_TOLERANCE = 0.01;

    /*
     * Tolerancia del costo valorizado:
     * ±2.5%
     */
    private static readonly COST_TOLERANCE_PERCENT = 0.025;

    private static equals(
        a: number,
        b: number
    ): boolean {

        return Math.abs(a - b)
            < this.QUANTITY_TOLERANCE;
    }

    private static round(
        value: number
    ): number {

        return Math.round(
            (value + Number.EPSILON) * 100
        ) / 100;
    }

    static execute(
        data: AuditData
    ): Finding[] {

        const findings: Finding[] = [];

        /*
         * ============================================================
         * CONSOLIDADO GENERAL POR MES
         * ============================================================
         *
         * Mes
         *   ├── Producto A
         *   ├── Producto B
         *   ├── Producto C
         *   └── ...
         */
        const monthlySummary =
            new Map<number, MonthlySummary>();

        console.log("==========================================");
        console.log("RULE_014 - INICIO");
        console.log(
            `Productos recibidos: ${data.kardex.length}`
        );
        console.log("==========================================");

        /*
         * ============================================================
         * RECORREMOS TODOS LOS PRODUCTOS
         * ============================================================
         */
        for (const product of data.kardex) {

            if (product.movements.length === 0) {
                continue;
            }

            /*
             * Agrupamos los movimientos del producto por mes.
             */
            const movementsByMonth =
                new Map<
                    number,
                    typeof product.movements
                >();

            for (const movement of product.movements) {

                if (movement.month === null) {
                    continue;
                }

                if (
                    !movementsByMonth.has(
                        movement.month
                    )
                ) {
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
             * ========================================================
             * CALCULAMOS EL RESUMEN DE CADA PRODUCTO POR MES
             * ========================================================
             */
            for (
                const [month, movements]
                of movementsByMonth
            ) {

                if (movements.length === 0) {
                    continue;
                }

                const firstMovement =
                    movements[0];

                const lastMovement =
                    movements[
                        movements.length - 1
                    ];

                /*
                 * ----------------------------------------------------
                 * SALDO INICIAL DEL PRODUCTO
                 * ----------------------------------------------------
                 *
                 * Inicial
                 * + Entrada
                 * - Salida
                 * = Saldo después del primer movimiento
                 *
                 * Entonces:
                 *
                 * Inicial
                 * = Saldo
                 * - Entrada
                 * + Salida
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
                 * ----------------------------------------------------
                 * ENTRADAS DEL PRODUCTO
                 * ----------------------------------------------------
                 */
                const totalEntryQuantity =
                    movements.reduce(
                        (sum, movement) =>
                            sum
                            + movement.entryQuantity,
                        0
                    );

                const totalEntryCost =
                    movements.reduce(
                        (sum, movement) =>
                            sum
                            + movement.entryTotalCost,
                        0
                    );

                /*
                 * ----------------------------------------------------
                 * SALIDAS DEL PRODUCTO
                 * ----------------------------------------------------
                 */
                const totalExitQuantity =
                    movements.reduce(
                        (sum, movement) =>
                            sum
                            + movement.exitQuantity,
                        0
                    );

                const totalExitCost =
                    movements.reduce(
                        (sum, movement) =>
                            sum
                            + movement.exitTotalCost,
                        0
                    );

                /*
                 * ----------------------------------------------------
                 * SALDO FINAL REAL DEL PRODUCTO
                 * ----------------------------------------------------
                 */
                const finalQuantity =
                    lastMovement.balanceQuantity;

                const finalTotalCost =
                    lastMovement.balanceTotalCost;

                const productSummary:
                    ProductMonthlySummary = {

                    initialQuantity,
                    initialTotalCost,

                    totalEntryQuantity,
                    totalEntryCost,

                    totalExitQuantity,
                    totalExitCost,

                    finalQuantity,
                    finalTotalCost,

                    movementCount:
                        movements.length
                };

                /*
                 * ====================================================
                 * CREAR MES SI TODAVÍA NO EXISTE
                 * ====================================================
                 */
                if (
                    !monthlySummary.has(month)
                ) {

                    monthlySummary.set(
                        month,
                        {
                            month,

                            initialQuantity: 0,
                            initialTotalCost: 0,

                            totalEntryQuantity: 0,
                            totalEntryCost: 0,

                            totalExitQuantity: 0,
                            totalExitCost: 0,

                            expectedFinalQuantity: 0,
                            expectedFinalTotalCost: 0,

                            lowerCostLimit: 0,
                            upperCostLimit: 0,

                            finalQuantity: 0,
                            finalTotalCost: 0,

                            productCount: 0,
                            movementCount: 0,

                            quantityDifference: 0,
                            totalCostDifference: 0,

                            quantityIsValid: true,
                            totalCostIsValid: true
                        }
                    );
                }

                /*
                 * ====================================================
                 * ACUMULAR PRODUCTO EN EL MES
                 * ====================================================
                 */
                const monthSummary =
                    monthlySummary.get(month)!;

                monthSummary.initialQuantity +=
                    productSummary.initialQuantity;

                monthSummary.initialTotalCost +=
                    productSummary.initialTotalCost;

                monthSummary.totalEntryQuantity +=
                    productSummary.totalEntryQuantity;

                monthSummary.totalEntryCost +=
                    productSummary.totalEntryCost;

                monthSummary.totalExitQuantity +=
                    productSummary.totalExitQuantity;

                monthSummary.totalExitCost +=
                    productSummary.totalExitCost;

                monthSummary.finalQuantity +=
                    productSummary.finalQuantity;

                monthSummary.finalTotalCost +=
                    productSummary.finalTotalCost;

                monthSummary.productCount += 1;

                monthSummary.movementCount +=
                    productSummary.movementCount;
            }
        }

        /*
         * ============================================================
         * VALIDAR CADA MES CONSOLIDADO
         * ============================================================
         */
        for (
            const [month, summary]
            of monthlySummary
        ) {

            /*
             * ========================================================
             * CANTIDAD ESPERADA CONSOLIDADA
             * ========================================================
             */
            const expectedFinalQuantity =
                summary.initialQuantity
                + summary.totalEntryQuantity
                - summary.totalExitQuantity;

            /*
             * ========================================================
             * COSTO ESPERADO CONSOLIDADO
             * ========================================================
             */
            const expectedFinalTotalCost =
                summary.initialTotalCost
                + summary.totalEntryCost
                - summary.totalExitCost;

            /*
             * ========================================================
             * RANGO DEL COSTO ±2.5%
             * ========================================================
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
             * ========================================================
             * DIFERENCIAS
             * ========================================================
             */
            const quantityDifference =
                expectedFinalQuantity
                - summary.finalQuantity;

            const totalCostDifference =
                expectedFinalTotalCost
                - summary.finalTotalCost;

            /*
             * ========================================================
             * VALIDACIONES
             * ========================================================
             */
            const quantityIsValid =
                this.equals(
                    expectedFinalQuantity,
                    summary.finalQuantity
                );

            const totalCostIsValid =
                summary.finalTotalCost
                    >= lowerCostLimit
                &&
                summary.finalTotalCost
                    <= upperCostLimit;

            /*
             * ========================================================
             * DIFERENCIAS ENCONTRADAS
             * ========================================================
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
             * Si el consolidado mensual cuadra,
             * no generamos finding.
             */
            if (differences.length === 0) {
                continue;
            }

            /*
             * ========================================================
             * FINDING MENSUAL
             * ========================================================
             *
             * IMPORTANTE:
             *
             * Aquí ya NO tenemos producto.
             * Es un finding consolidado de todo el mes.
             */
            findings.push({

                ruleId: "RULE_014",

                productCode: "",

                productName:
                    `Consolidado mensual - Mes ${month}`,

                errorType:
                    "INVALID_MONTHLY_CONSOLIDATED_SUM",

                description:
                    `El consolidado general del Kardex ` +
                    `para el mes ${month} no cumple la validación ` +
                    `mensual. La cantidad debe cumplir la fórmula ` +
                    `Saldo Inicial + Entradas - Salidas = Saldo Final. ` +
                    `El costo valorizado final debe encontrarse ` +
                    `entre el 97.5% y el 102.5% del costo calculado. ` +
                    `Diferencias: ${differences.join(", ")}.`,

                recommendation:
                    "Verifique las sumatorias consolidadas " +
                    "del mes, incluyendo saldos iniciales, " +
                    "entradas, salidas y saldos finales.",

                riskLevel:
                    "CRITICO",

                metadata: {

                    month,

                    /*
                     * SALDO INICIAL CONSOLIDADO
                     */
                    initialBalance: {

                        quantity:
                            this.round(
                                summary.initialQuantity
                            ),

                        totalCost:
                            this.round(
                                summary.initialTotalCost
                            )
                    },

                    /*
                     * SUMATORIAS CONSOLIDADAS
                     */
                    totals: {

                        entry: {

                            quantity:
                                this.round(
                                    summary.totalEntryQuantity
                                ),

                            totalCost:
                                this.round(
                                    summary.totalEntryCost
                                )
                        },

                        exit: {

                            quantity:
                                this.round(
                                    summary.totalExitQuantity
                                ),

                            totalCost:
                                this.round(
                                    summary.totalExitCost
                                )
                        }
                    },

                    /*
                     * RESULTADO ESPERADO
                     */
                    expectedFinalBalance: {

                        quantity:
                            this.round(
                                expectedFinalQuantity
                            ),

                        totalCost:
                            this.round(
                                expectedFinalTotalCost
                            )
                    },

                    /*
                     * RANGO PERMITIDO
                     */
                    costTolerance: {

                        percentage: 2.5,

                        lowerLimit:
                            this.round(
                                lowerCostLimit
                            ),

                        upperLimit:
                            this.round(
                                upperCostLimit
                            )
                    },

                    /*
                     * SALDO FINAL REAL CONSOLIDADO
                     */
                    actualFinalBalance: {

                        quantity:
                            this.round(
                                summary.finalQuantity
                            ),

                        totalCost:
                            this.round(
                                summary.finalTotalCost
                            )
                    },

                    /*
                     * DIFERENCIAS
                     */
                    difference: {

                        quantity:
                            this.round(
                                quantityDifference
                            ),

                        totalCost:
                            this.round(
                                totalCostDifference
                            )
                    },

                    productCount:
                        summary.productCount,

                    movementCount:
                        summary.movementCount,

                    differences
                }
            });
        }

        console.log("==========================================");
        console.log("RULE_014 - FIN");
        console.log(
            `Meses procesados: ${monthlySummary.size}`
        );
        console.log(
            `Findings encontrados: ${findings.length}`
        );
        console.log("==========================================");

        return findings;
    }
}