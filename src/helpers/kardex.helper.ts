import { KardexProduct } from "../models/kardex-product";
import { MonthlyBalance } from "./monthly-balance";

export class KardexHelper {

    static getMonthlyBalances(product: KardexProduct): MonthlyBalance[] {

        const result: MonthlyBalance[] = [];
        const grouped = new Map<number, typeof product.movements>();
        // Agrupar movimientos por mes
        for (const movement of product.movements) {
            if (!grouped.has(movement.month!)) {
                grouped.set(movement.month!, []);
            }
            grouped.get(movement.month!)!.push(movement);
        }

        // Calcular saldo inicial y final
        for (const [month, movements] of grouped) {
            const first = movements[0];
            const last = movements[movements.length - 1];
            result.push({
                month,
                initialQuantity:
                    first.balanceQuantity
                    - first.entryQuantity
                    + first.exitQuantity,
                finalQuantity:
                    last.balanceQuantity,
                finalUnitCost:
                    last.balanceUnitCost,
                initialTotalCost:
                    first.balanceTotalCost
                    - first.entryTotalCost
                    + first.exitTotalCost,
                finalTotalCost:
                    last.balanceTotalCost
            });
        }
        result.sort((a, b) => a.month - b.month);
        return result;
    }
}