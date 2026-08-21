import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { KardexMovement } from "../models/kardex-movement";
import { CodeHelper } from "../helpers/code.helper";

export class Rule013 {

    private static readonly ENTRY_OPERATION = "02";
    private static readonly EXIT_OPERATION = "01";

    private static roundToCents(value: number): number {
        return Math.round(value * 100) / 100;
    }

    /** Compara dos montos en centavos exactos (como enteros, sin ambigüedad de punto flotante). */
    private static centsEqual(a: number, b: number): boolean {
        return Math.round(a * 100) === Math.round(b * 100);
    }

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        for (const product of data.kardex) {

            if (product.movements.length === 0) {
                continue;
            }

            const month = product.movements.find(m => m.month !== null)?.month ?? 0;

            const [first, ...rest] = product.movements;

            if (rest.length === 0) {
                // Solo Saldo Inicial, nada para recalcular en este período.
                continue;
            }

            let cantidadAcumulada = first.balanceQuantity;
            let valorAcumulado = first.balanceTotalCost;
            let cpp = cantidadAcumulada > 0 ? valorAcumulado / cantidadAcumulada : 0;

            let totalEntradaCantidad = 0;
            let totalEntradaCosto = 0;
            let totalSalidaCantidadRecalculada = 0;
            let totalSalidaCostoRecalculado = 0;
            let totalSalidaCostoArchivo = 0;

            for (const movement of rest) {
                this.applyMovement(movement, {
                    onEntry: () => {
                        const nuevoValor = valorAcumulado + movement.entryTotalCost;
                        const nuevaCantidad = cantidadAcumulada + movement.entryQuantity;
                        cpp = nuevaCantidad > 0 ? nuevoValor / nuevaCantidad : 0;
                        valorAcumulado = nuevoValor;
                        cantidadAcumulada = nuevaCantidad;
                        totalEntradaCantidad += movement.entryQuantity;
                        totalEntradaCosto += movement.entryTotalCost;
                    },
                    onExit: () => {
                        const costoSalida = this.roundToCents(cpp) * movement.exitQuantity;
                        valorAcumulado -= costoSalida;
                        cantidadAcumulada -= movement.exitQuantity;
                        // El CPP NO cambia en una salida.
                        totalSalidaCantidadRecalculada += movement.exitQuantity;
                        totalSalidaCostoRecalculado += costoSalida;
                        totalSalidaCostoArchivo += movement.exitTotalCost;
                    }
                });
            }

            const last = product.movements[product.movements.length - 1];

            const differences: string[] = [];

            const salidaCoincide = this.centsEqual(totalSalidaCostoRecalculado, totalSalidaCostoArchivo);
            if (!salidaCoincide) {
                differences.push("Costo Total de Salidas");
            }

            const saldoFinalCoincide = this.centsEqual(valorAcumulado, last.balanceTotalCost);
            if (!saldoFinalCoincide) {
                differences.push("Costo Total de Saldo Final");
            }

            const cantidadEsCero = this.centsEqual(cantidadAcumulada, 0) && this.centsEqual(last.balanceQuantity, 0);
            const costoUnitarioCoincide = cantidadEsCero || this.centsEqual(cpp, last.balanceUnitCost);
            if (!costoUnitarioCoincide) {
                differences.push("Costo Unitario de Saldo Final");
            }

            if (differences.length === 0) {
                continue;
            }

            findings.push({
                ruleId: "RULE_013",
                productCode: product.code,
                productName: product.description,
                errorType: "INVALID_CPP",
                description:
                    `Las sumatorias del producto ${product.code} no cumplen la metodología de Costo Promedio ` +
                    `Ponderado para el mes ${month}. Diferencias: ${differences.join(", ")}.`,
                recommendation:
                    "Verifique el cálculo del Costo Promedio Ponderado: las entradas deben recalcularlo, " +
                    "las salidas deben usar el CPP vigente sin modificarlo.",
                riskLevel: "CRITICO",
                metadata: {
                    month,
                    normalizedCode: CodeHelper.normalize(product.code),
                    initialBalance: {
                        quantity: first.balanceQuantity,
                        totalCost: first.balanceTotalCost
                    },
                    totals: {
                        entry: {
                            quantity: totalEntradaCantidad,
                            totalCost: this.roundToCents(totalEntradaCosto)
                        },
                        exit: {
                            quantity: totalSalidaCantidadRecalculada,
                            totalCost: this.roundToCents(totalSalidaCostoRecalculado),
                            totalCostArchivo: this.roundToCents(totalSalidaCostoArchivo)
                        }
                    },
                    expectedFinalBalance: {
                        quantity: cantidadAcumulada,
                        unitCost: this.roundToCents(cpp),
                        totalCost: this.roundToCents(valorAcumulado)
                    },
                    costTolerance: {
                        percentage: 0,
                        lowerLimit: this.roundToCents(valorAcumulado),
                        upperLimit: this.roundToCents(valorAcumulado)
                    },
                    actualFinalBalance: {
                        quantity: last.balanceQuantity,
                        unitCost: last.balanceUnitCost,
                        totalCost: last.balanceTotalCost
                    },
                    difference: {
                        quantity: Number((cantidadAcumulada - last.balanceQuantity).toFixed(2)),
                        unitCost: this.roundToCents(cpp - last.balanceUnitCost),
                        totalCost: this.roundToCents(valorAcumulado - last.balanceTotalCost)
                    },
                    movementCount: product.movements.length,
                    differences
                }
            });
        }

        return findings;
    }

    private static applyMovement(
        movement: KardexMovement,
        handlers: { onEntry: () => void; onExit: () => void }
    ) {
        const operation = String(movement.operation).trim();
        if (operation === this.ENTRY_OPERATION || Number(movement.entryQuantity || 0) > 0) {
            handlers.onEntry();
            return;
        }
        if (operation === this.EXIT_OPERATION || Number(movement.exitQuantity || 0) > 0) {
            handlers.onExit();
        }
    }
}
