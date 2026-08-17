import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";

export class Rule003 {

    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }

    // TipoOP 16 = Saldo Inicial
    private static readonly INITIAL_BALANCE_OPERATION = "16";

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        /*
         * ============================================================
         * 1. AGRUPAR POR CÓDIGO + MES
         * ============================================================
         *
         * Si existen registros duplicados del mismo producto
         * dentro del mismo mes, conservamos el último.
         */

        const productsByCodeAndMonth =
            new Map<string, KardexProduct>();

        for (const product of data.kardex) {

            const code = CodeHelper.normalize(product.code);

            const month = product.movements
                .find(movement => movement.month !== null)
                ?.month;

            if (!month) {
                continue;
            }

            const key = `${code}|${month}`;

            // Si existe un duplicado del mismo producto/mes,
            // conservamos el último registro recibido.
            productsByCodeAndMonth.set(key, product);
        }

        /*
         * ============================================================
         * 2. AGRUPAR POR CÓDIGO
         * ============================================================
         */

        const history =
            new Map<string, KardexProduct[]>();

        for (const [key, product] of productsByCodeAndMonth) {

            const code = key.split("|")[0];

            if (!history.has(code)) {
                history.set(code, []);
            }

            history.get(code)!.push(product);
        }

        /*
         * ============================================================
         * 3. PROCESAR HISTORIAL DE CADA PRODUCTO
         * ============================================================
         */

        for (const [code, months] of history) {

            /*
             * Ordenar explícitamente por mes.
             */
            months.sort((a, b) => {

                const monthA =
                    a.movements.find(
                        movement => movement.month !== null
                    )?.month ?? 0;

                const monthB =
                    b.movements.find(
                        movement => movement.month !== null
                    )?.month ?? 0;

                return monthA - monthB;
            });

            if (months.length < 2) {
                continue;
            }

            /*
             * ========================================================
             * 4. COMPARAR MES CONTRA MES SIGUIENTE
             * ========================================================
             */

            for (let i = 0; i < months.length - 1; i++) {

                const current = months[i];
                const next = months[i + 1];

                /*
                 * ----------------------------------------------------
                 * SALDO FINAL DEL MES ACTUAL
                 * ----------------------------------------------------
                 *
                 * El último movimiento del mes representa
                 * el saldo final.
                 */
                const currentLast =
                    current.movements[
                        current.movements.length - 1
                    ];

                /*
                 * ----------------------------------------------------
                 * SALDO INICIAL DEL SIGUIENTE MES
                 * ----------------------------------------------------
                 *
                 * TipoOP 16 = Saldo Inicial.
                 *
                 * No usamos movements[0], porque puede haber
                 * registros duplicados o un orden diferente.
                 */
                const nextInitial =
                    next.movements.find(
                        movement =>
                            String(movement.operation).trim() ===
                            this.INITIAL_BALANCE_OPERATION
                    );

                if (!currentLast || !nextInitial) {
                    continue;
                }

                /*
                 * ====================================================
                 * 5. OBTENER MESES
                 * ====================================================
                 */

                const fromMonth =
                    currentLast.month ??
                    current.movements.find(
                        movement => movement.month !== null
                    )?.month ??
                    0;

                const toMonth =
                    nextInitial.month ??
                    next.movements.find(
                        movement => movement.month !== null
                    )?.month ??
                    0;

                /*
                 * ====================================================
                 * 6. VALIDAR COSTOS
                 * ====================================================
                 */

                const differences: string[] = [];

                // Costo Unitario
                if (
                    !this.equals(
                        currentLast.balanceUnitCost,
                        nextInitial.balanceUnitCost
                    )
                ) {
                    differences.push("Costo Unitario");
                }

                // Costo Total
                if (
                    !this.equals(
                        currentLast.balanceTotalCost,
                        nextInitial.balanceTotalCost
                    )
                ) {
                    differences.push("Costo Total");
                }

                /*
                 * Si ambos costos coinciden,
                 * no existe incidencia.
                 */
                if (differences.length === 0) {
                    continue;
                }

                /*
                 * ====================================================
                 * 7. GENERAR FINDING
                 * ====================================================
                 */

                findings.push({

                    ruleId: "RULE_003",

                    productCode: current.code,

                    productName: current.description,

                    errorType:
                        "MONTHLY_COST_CONTINUITY_ERROR",

                    description:
                        `No existe continuidad de costos entre el cierre del mes ${fromMonth} ` +
                        `y el inicio del mes ${toMonth}: ${differences.join(", ")}.`,

                    recommendation:
                        "Verifique que el costo unitario y el costo total del saldo final coincidan con el saldo inicial del siguiente período.",

                    riskLevel: "ALTO",

                    metadata: {

                        fromIndex: fromMonth,

                        toIndex: toMonth,

                        finalBalance: {

                            quantity:
                                currentLast.balanceQuantity,

                            unitCost:
                                currentLast.balanceUnitCost,

                            totalCost:
                                currentLast.balanceTotalCost
                        },

                        initialBalance: {

                            quantity:
                                nextInitial.balanceQuantity,

                            unitCost:
                                nextInitial.balanceUnitCost,

                            totalCost:
                                nextInitial.balanceTotalCost
                        },

                        differences
                    }
                });
            }
        }

        return findings;
    }
}