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
         * 1. AGRUPAR POR CÓDIGO -> MES -> PRODUCTO
         * ============================================================
         *
         * Igual que RULE_002: un Map<mes, KardexProduct> por código para
         * poder detectar HUECOS reales entre meses, en vez de comparar
         * como "consecutivos" dos meses que en realidad no lo son.
         */
        const historyByCode = new Map<string, Map<number, KardexProduct>>();

        for (const product of data.kardex) {

            const code = CodeHelper.normalize(product.code);

            const month = product.movements
                .find(movement => movement.month !== null)
                ?.month;

            if (!month) {
                continue;
            }

            if (!historyByCode.has(code)) {
                historyByCode.set(code, new Map());
            }

            historyByCode.get(code)!.set(month, product);
        }

        /*
         * ============================================================
         * 2. PROCESAR EL HISTORIAL DE CADA PRODUCTO, MES A MES
         * ============================================================
         */
        for (const [, monthsMap] of historyByCode) {

            const months = [...monthsMap.keys()].sort((a, b) => a - b);

            if (months.length < 2) {
                continue;
            }

            const firstMonth = months[0];
            const lastMonth = months[months.length - 1];

            for (let month = firstMonth; month < lastMonth; month++) {

                const current = monthsMap.get(month);

                if (!current) {
                    continue;
                }

                const next = monthsMap.get(month + 1);

                /*
                 * ====================================================
                 * EL PRODUCTO NO EXISTE EN EL KARDEX SIGUIENTE
                 * ====================================================
                 */
                if (!next) {

                    const currentLast =
                        current.movements[current.movements.length - 1];

                    findings.push({
                        ruleId: "RULE_003",
                        productCode: current.code,
                        productName: current.description,
                        errorType: "PRODUCT_NOT_FOUND_NEXT_MONTH",
                        description:
                            `El producto no existe en el Kardex del mes ${month + 1}, ` +
                            `pero sí tuvo movimientos en el mes ${month}.`,
                        recommendation:
                            "Verifique que el producto haya sido cargado en el Kardex de todos los meses del ejercicio.",
                        riskLevel: "ALTO",
                        metadata: {
                            fromIndex: month,
                            toIndex: month + 1,
                            finalBalance: currentLast
                                ? {
                                    quantity: currentLast.balanceQuantity,
                                    unitCost: currentLast.balanceUnitCost,
                                    totalCost: currentLast.balanceTotalCost
                                }
                                : null,
                            initialBalance: null
                        }
                    });

                    continue;
                }

                /*
                 * ====================================================
                 * SALDO FINAL DEL MES ACTUAL / SALDO INICIAL DEL SIGUIENTE
                 * ====================================================
                 */
                const currentLast =
                    current.movements[current.movements.length - 1];

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
                 * VALIDAR COSTOS
                 * ====================================================
                 */
                const differences: string[] = [];

                if (
                    !this.equals(
                        currentLast.balanceUnitCost,
                        nextInitial.balanceUnitCost
                    )
                ) {
                    differences.push("Costo Unitario");
                }

                if (
                    !this.equals(
                        currentLast.balanceTotalCost,
                        nextInitial.balanceTotalCost
                    )
                ) {
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
                    description:
                        `No existe continuidad de costos entre el cierre del mes ${month} ` +
                        `y el inicio del mes ${month + 1}: ${differences.join(", ")}.`,
                    recommendation:
                        "Verifique que el costo unitario y el costo total del saldo final coincidan con el saldo inicial del siguiente período.",
                    riskLevel: "ALTO",
                    metadata: {
                        fromIndex: month,
                        toIndex: month + 1,
                        finalBalance: {
                            quantity: currentLast.balanceQuantity,
                            unitCost: currentLast.balanceUnitCost,
                            totalCost: currentLast.balanceTotalCost
                        },
                        initialBalance: {
                            quantity: nextInitial.balanceQuantity,
                            unitCost: nextInitial.balanceUnitCost,
                            totalCost: nextInitial.balanceTotalCost
                        },
                        differences
                    }
                });
            }
        }

        return findings;
    }
}
