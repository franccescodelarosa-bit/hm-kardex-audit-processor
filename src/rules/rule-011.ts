import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
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
        // Caso especial 99.1
        if (code === "99.1") {
            return operations[code];
        }
        const normalized = code.padStart(2, "0");
        return operations[normalized] ?? `Tipo ${operation}`;
    }

    // Pendiente de validación funcional con el cliente.
    // Actualmente se considera una variación mayor al 50%.
    private static readonly COST_VARIATION_THRESHOLD = 0.50;
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        for (const product of data.kardex) {
            if (product.movements.length < 2) {
                continue;
            }
            for (let i = 1; i < product.movements.length; i++) {
                const previous = product.movements[i - 1];
                const current = product.movements[i];
                if (previous.balanceUnitCost <= 0) {
                    continue;
                }
                const variation =
                    Math.abs(
                        current.balanceUnitCost - previous.balanceUnitCost
                    ) / previous.balanceUnitCost;

                if (variation <= this.COST_VARIATION_THRESHOLD) {
                    continue;
                }
                const operationName = this.getOperationName(current.operation);
                findings.push({
                    ruleId: "RULE_011",
                    productCode: product.code,
                    productName: product.description,
                    errorType: "UNUSUAL_UNIT_COST_VARIATION",
                    description:
                        `Se detectó una variación inusual del costo unitario en una operación de ${operationName} (Tipo ${current.operation}).`,
                    recommendation:
                        "Verifique la valorización del ajuste y su sustento documentario.",
                    riskLevel: "MEDIO",
                    metadata: {
                        date: DateHelper.toDateString(current.date),
                        month: current.month,
                        document: current.document,
                        operation: current.operation,
                        previousCost: previous.balanceUnitCost,
                        currentCost: current.balanceUnitCost,
                        variationPercent:
                            Number((variation * 100).toFixed(2))
                    }
                });
            }
        }
        return findings;
    }
}