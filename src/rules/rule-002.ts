import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";
export class Rule002 {
    private static equals(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.01;
    }
    private static readonly INITIAL_BALANCE_OPERATION = "16";
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        const productsByCodeAndMonth = new Map<string, KardexProduct>();
        for (const product of data.kardex) {
            const code = CodeHelper.normalize(product.code);
            const month = product.movements
                .find(movement => movement.month !== null)
                ?.month;
            if (!month) {
                continue;
            }
            const key = `${code}|${month}`;
            productsByCodeAndMonth.set(key, product);
        }
        /*
         * ============================================================
         * 2. AGRUPAR NUEVAMENTE POR CÓDIGO
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
             * Ordenamos explícitamente por mes.
             *
             * Esto evita depender del orden en que las hojas
             * fueron leídas por el parser.
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

                if (CodeHelper.normalize(current.code) === "006749") {

                    console.log("==============================================");
                    console.log("🔥 RULE_002 DEBUG 006749");
                    console.log("==============================================");

                    console.log("CURRENT PRODUCT:", {
                        code: current.code,
                        description: current.description,
                        movements: current.movements.length
                    });

                    console.log("CURRENT ALL MOVEMENTS:");

                    console.log(
                        current.movements.map((movement, index) => ({
                            index,
                            date: movement.date,
                            operation: movement.operation,

                            entryQuantity: movement.entryQuantity,
                            entryUnitCost: movement.entryUnitCost,
                            entryTotalCost: movement.entryTotalCost,

                            exitQuantity: movement.exitQuantity,
                            exitUnitCost: movement.exitUnitCost,
                            exitTotalCost: movement.exitTotalCost,

                            balanceQuantity: movement.balanceQuantity,
                            balanceUnitCost: movement.balanceUnitCost,
                            balanceTotalCost: movement.balanceTotalCost,

                            month: movement.month
                        }))
                    );

                    console.log("==============================================");
                    console.log("NEXT PRODUCT:", {
                        code: next.code,
                        description: next.description,
                        movements: next.movements.length
                    });

                    console.log("NEXT INITIAL OPERATION 16:");

                    console.log(
                        next.movements.find(
                            movement =>
                                String(movement.operation).trim() ===
                                this.INITIAL_BALANCE_OPERATION
                        )
                    );

                    console.log("==============================================");
                }

                /*
                 * ----------------------------------------------------
                 * MES ACTUAL
                 * ----------------------------------------------------
                 *
                 * El último movimiento representa el saldo final
                 * del mes.
                 */
                const currentLast =
                    current.movements[
                        current.movements.length - 1
                    ];

                /*
                 * ----------------------------------------------------
                 * SIGUIENTE MES
                 * ----------------------------------------------------
                 *
                 * NO usamos movements[0].
                 *
                 * Buscamos explícitamente TipoOP = 16,
                 * que corresponde a SALDO INICIAL.
                 */
                const nextInitial =
                    next.movements.find(
                        movement =>
                            String(movement.operation).trim() ===
                            this.INITIAL_BALANCE_OPERATION
                    );

                    if (CodeHelper.normalize(current.code) === "006749") {

    console.log("🚨🚨🚨 COMPARACIÓN FINAL 006749 🚨🚨🚨");

    console.log({
        currentLast: currentLast
            ? {
                date: currentLast.date,
                operation: currentLast.operation,
                balanceQuantity: currentLast.balanceQuantity,
                balanceUnitCost: currentLast.balanceUnitCost,
                balanceTotalCost: currentLast.balanceTotalCost,
                month: currentLast.month
            }
            : null,

        nextInitial: nextInitial
            ? {
                date: nextInitial.date,
                operation: nextInitial.operation,
                balanceQuantity: nextInitial.balanceQuantity,
                balanceUnitCost: nextInitial.balanceUnitCost,
                balanceTotalCost: nextInitial.balanceTotalCost,
                month: nextInitial.month
            }
            : null
    });

    console.log("🚨🚨🚨 FIN DEBUG 006749 🚨🚨🚨");
}


                /*
                 * Si alguno de los dos no existe,
                 * no podemos realizar la comparación.
                 */
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
                 * 6. VALIDAR CANTIDAD
                 * ====================================================
                 */

                if (
                    this.equals(
                        currentLast.balanceQuantity,
                        nextInitial.balanceQuantity
                    )
                ) {
                    continue;
                }

                /*
                 * ====================================================
                 * 7. GENERAR FINDING
                 * ====================================================
                 */

                findings.push({

                    ruleId: "RULE_002",

                    productCode: current.code,

                    productName: current.description,

                    errorType: "MONTHLY_CONTINUITY_ERROR",

                    description:
                        `No existe continuidad entre el saldo final del mes ${fromMonth} ` +
                        `y el saldo inicial del mes ${toMonth}: Cantidad.`,

                    recommendation:
                        "Verifique que el saldo final del período coincida con el saldo inicial del siguiente.",

                    riskLevel: "ALTO",

                    metadata: {

                        fromMonth,

                        toMonth,

                        finalQuantity:
                            currentLast.balanceQuantity,

                        initialQuantity:
                            nextInitial.balanceQuantity,

                        difference:
                            currentLast.balanceQuantity -
                            nextInitial.balanceQuantity
                    }
                });
            }
        }

        return findings;
    }
}