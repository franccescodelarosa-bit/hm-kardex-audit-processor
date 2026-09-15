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

    private static roundToPrecision(value: number): number {
        return Math.round(value * 1000000) / 1000000;
    }

    private static strictEqual(a: number, b: number): boolean {
        return Math.abs(a - b) < 0.0000001;
    }

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        for (const product of data.kardex) {

            if (product.movements.length === 0) {
                continue;
            }

            const month = product.movements.find(m => m.month !== null)?.month ?? 0;
            const normalizedCode = CodeHelper.normalize(product.code);

            const [first, ...rest] = product.movements;

            if (rest.length === 0) {
                continue;
            }

            let cantidadArchivo = first.balanceQuantity;
            let valorArchivo = first.balanceTotalCost;

            let cpp = cantidadArchivo > 0 ? valorArchivo / cantidadArchivo : 0;

            let totalSalidaCantidadRecalculada = 0;
            let totalSalidaCostoRecalculado = 0;
            let totalSalidaCostoArchivo = 0;

            let totalEntradaCantidad = 0;
            let totalEntradaCosto = 0;

            const unitCostMismatches: Array<{
                date: Date | null;
                document: string;
                quantity: number;
                expectedTotalCost: number;
                foundTotalCost: number;
                expectedUnitCost: number;
                foundUnitCost: number;
            }> = [];

            for (const movement of rest) {

                this.applyMovement(movement, {

                    onEntry: () => {

                        const cantidadFila = movement.balanceQuantity;

                        totalEntradaCantidad += movement.entryQuantity;
                        totalEntradaCosto += movement.entryTotalCost;

                        cpp =
                            cantidadFila > 0
                                ? (movement.entryTotalCost + valorArchivo) / cantidadFila
                                : 0;

                        if (cantidadFila > 0) {

                            const encontradoFila = movement.entryTotalCost + valorArchivo;
                            const archivoFilaTotal = movement.balanceTotalCost;

                            if (!this.centsEqual(encontradoFila, archivoFilaTotal)) {
                                unitCostMismatches.push({
                                    date: movement.date,
                                    document: movement.document,
                                    quantity: cantidadFila,
                                    expectedTotalCost: archivoFilaTotal,
                                    foundTotalCost: this.roundToCents(encontradoFila),
                                    expectedUnitCost: movement.balanceUnitCost,
                                    foundUnitCost: this.roundToPrecision(cpp)
                                });
                            }
                        }
                    },

                    onExit: () => {

                        const cppVigenteArchivo =
                            cantidadArchivo > 0 ? valorArchivo / cantidadArchivo : 0;

                        const costoSalida = cppVigenteArchivo * movement.exitQuantity;

                        totalSalidaCantidadRecalculada += movement.exitQuantity;
                        totalSalidaCostoRecalculado += costoSalida;
                        totalSalidaCostoArchivo += movement.exitTotalCost;
                    }
                });
                cantidadArchivo = movement.balanceQuantity;
                valorArchivo = movement.balanceTotalCost;
            }

            const last = product.movements[product.movements.length - 1];

            const cantidadFinal = last.balanceQuantity;
            const valorFinalCalculado = cpp * cantidadFinal;

            const differences: string[] = [];

            const salidaCoincide =
                this.centsEqual(totalSalidaCostoRecalculado, totalSalidaCostoArchivo);

            if (!salidaCoincide) {
                differences.push("Costo Total de Salidas");
            }

            if (unitCostMismatches.length > 0) {
                differences.push("Costo Unitario de Saldo Final");
            }

            const saldoFinalCoincide =
                this.strictEqual(valorFinalCalculado, last.balanceTotalCost);

            if (!saldoFinalCoincide) {
                differences.push("Costo Total de Saldo Final");
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
                    "Verifique el cálculo del Costo Promedio Ponderado: las entradas deben recalcularlo con el " +
                    "saldo que el Kardex tenía justo antes de cada una, las salidas deben usar el CPP vigente " +
                    "sin modificarlo.",
                riskLevel: "CRITICO",
                metadata: {
                    month,
                    normalizedCode,
                    initialBalance: {
                        quantity: first.balanceQuantity,
                        totalCost: this.roundToCents(first.balanceTotalCost)
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
                    unitCostMismatches,
                    expectedFinalBalance: {
                        quantity: cantidadFinal,
                        unitCost: this.roundToPrecision(cpp),
                        totalCost: this.roundToPrecision(valorFinalCalculado)
                    },
                    actualFinalBalance: {
                        quantity: cantidadFinal,
                        unitCost: last.balanceUnitCost,
                        totalCost: last.balanceTotalCost
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
