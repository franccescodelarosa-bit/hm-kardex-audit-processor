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

        /*
         * ============================================================
         * 1. AGRUPAR POR CÓDIGO -> MES -> PRODUCTO
         * ============================================================
         *
         * Usamos un Map<mes, KardexProduct> por código (en vez de un
         * array plano) para poder detectar HUECOS reales entre meses.
         * Si a un producto le falta un mes en el medio (ej: tiene datos
         * en enero y marzo pero no en febrero), NO queremos comparar
         * enero contra marzo como si fueran consecutivos.
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
         *
         * Recorremos únicamente el rango en que el producto tuvo
         * actividad (desde su primer mes con datos hasta su último).
         * Un producto que recién aparece más adelante en el ejercicio
         * NO genera hallazgo por los meses anteriores (no es un error).
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
                 *
                 * El producto tuvo movimientos este mes, pero no hay
                 * ningún bloque de Kardex para el mes siguiente, dentro
                 * del rango en que el producto estuvo activo.
                 */
                if (!next) {

                    const currentLast =
                        current.movements[current.movements.length - 1];

                    findings.push({
                        ruleId: "RULE_002",
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
                            fromMonth: month,
                            toMonth: month + 1,
                            finalQuantity: currentLast?.balanceQuantity ?? null,
                            initialQuantity: null
                        }
                    });

                    continue;
                }

                /*
                 * ====================================================
                 * CONTINUIDAD DE SALDO ENTRE MESES CONSECUTIVOS
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

                if (
                    this.equals(
                        currentLast.balanceQuantity,
                        nextInitial.balanceQuantity
                    )
                ) {
                    continue;
                }

                findings.push({
                    ruleId: "RULE_002",
                    productCode: current.code,
                    productName: current.description,
                    errorType: "MONTHLY_CONTINUITY_ERROR",
                    description:
                        `No existe continuidad entre el saldo final del mes ${month} ` +
                        `y el saldo inicial del mes ${month + 1}: Cantidad.`,
                    recommendation:
                        "Verifique que el saldo final del período coincida con el saldo inicial del siguiente.",
                    riskLevel: "ALTO",
                    metadata: {
                        fromMonth: month,
                        toMonth: month + 1,
                        finalQuantity: currentLast.balanceQuantity,
                        initialQuantity: nextInitial.balanceQuantity,
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
