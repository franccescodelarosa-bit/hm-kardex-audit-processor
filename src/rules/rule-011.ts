import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";
import { DateHelper } from "../helpers/date.helper";

export class Rule011 {

    private static getOperationName(operation: number | string): string {
        const operations: Record<string, string> = {
            "01": "VENTA - SALIDA DE MERCADERIA",
            "02": "COMPRA - INGRESO DE MERCADERIA",
            "05": "DEVOLUCIÓN RECIBIDA - MERCADERIA DEVUELTA POR EL CLIENTE",
            "06": "DEVOLUCIÓN ENTREGADA - MERCADERIA DEVUELTA AL PROVEEDOR",
            "07": "PROMOCIÓN",
            "10": "SALIDA A PRODUCCIÓN",
            "11": "TRANSFERENCIA ENTRE ALMACENES",
            "12": "RETIRO",
            "13": "MERMAS",
            "14": "DESMEDROS",
            "15": "DESTRUCCIÓN",
            "16": "SALDO INICIAL",
            "28": "AJUSTE POR DIFERENCIA DE INVENTARIO (FALTANTES Y SOBRANTES)",
            "99.1": "AUTOCONSUMO"
        };
        const code = String(operation).trim();
        if (code === "99.1") {
            return operations[code];
        }
        const normalized = code.padStart(2, "0");
        return operations[normalized] ?? `Tipo ${operation}`;
    }

    // Confirmado con el spec: 25% (el "100/105/95" del diagrama era solo
    // un ejemplo ilustrativo, no define el porcentaje real).
    private static readonly COST_VARIATION_THRESHOLD = 0.25;

    private static readonly INITIAL_BALANCE_OPERATION = "16";

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        /*
         * Misma estructura que RULE_002/RULE_003: agrupar por código ->
         * mes -> producto, y comparar el CIERRE de un mes (última fila)
         * contra la APERTURA del mes siguiente (primera fila, TipoOp 16).
         * NO se compara movimiento contra movimiento dentro de un mismo
         * mes — eso generaba falsos positivos con saltos de costo que
         * se corrigen solos dentro del propio mes.
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

            // Ante duplicados del mismo código+mes, nos quedamos con el
            // último (misma convención que RULE_002/RULE_003).
            historyByCode.get(code)!.set(month, product);
        }

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

                if (!next) {
                    continue;
                }

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

                if (currentLast.balanceUnitCost <= 0) {
                    continue;
                }

                const variation =
                    Math.abs(
                        nextInitial.balanceUnitCost - currentLast.balanceUnitCost
                    ) / currentLast.balanceUnitCost;

                if (variation <= this.COST_VARIATION_THRESHOLD) {
                    continue;
                }

                const operationName = this.getOperationName(nextInitial.operation);

                findings.push({
                    ruleId: "RULE_011",
                    productCode: current.code,
                    productName: current.description,
                    errorType: "UNUSUAL_UNIT_COST_VARIATION",
                    description:
                        `Se detectó una variación inusual del costo unitario entre el cierre del mes ${month} ` +
                        `y la apertura del mes ${month + 1} (${operationName}).`,
                    recommendation:
                        "Verifique la valorización del período y su sustento documentario.",
                    riskLevel: "MEDIO",
                    metadata: {
                        month: month + 1,
                        fromMonth: month,
                        toMonth: month + 1,
                        date: DateHelper.toDateString(nextInitial.date),
                        document: nextInitial.document,
                        operation: nextInitial.operation,
                        previousCost: currentLast.balanceUnitCost,
                        currentCost: nextInitial.balanceUnitCost,
                        variationPercent:
                            Number((variation * 100).toFixed(2))
                    }
                });
            }
        }

        return findings;
    }
}
