import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { InventoryItem } from "../models/inventory-item";
import { KardexProduct } from "../models/kardex-product";
import { CodeHelper } from "../helpers/code.helper";
import { DateHelper } from "../helpers/date.helper";

export class Rule006 {
    static execute(context: AuditData): Finding[] {
        const findings: Finding[] = [];
        this.validateInventory(
            context.initialInventory,
            "INVENTARIO_INICIAL",
            findings
        );
        this.validateInventory(
            context.finalInventory,
            "INVENTARIO_FINAL",
            findings
        );
        this.validateKardex(
            context.kardex,
            findings
        );
        return findings;
    }

    private static validateKardex(
        kardex: KardexProduct[],
        findings: Finding[]
    ) {

        const productsByCodeAndMonth = new Map<string, KardexProduct[]>();

        for (const product of kardex) {
            const code = CodeHelper.normalize(product.code);
            const month = product.movements.find(
                movement => movement.month !== null
            )?.month;

            if (!month) {
                continue;
            }

            const key = `${code}|${month}`;
            if (!productsByCodeAndMonth.has(key)) {
                productsByCodeAndMonth.set(key, []);
            }
            productsByCodeAndMonth.get(key)!.push(product);
        }

        for (const [key, products] of productsByCodeAndMonth) {

            if (products.length <= 1) {
                continue;
            }

            const [code, monthText] = key.split("|");

            const duplicateOccurrences = products.map(product => {
                const first = product.movements[0];
                return {
                    date: DateHelper.toDateString(first?.date ?? null),
                    document: first?.document ?? "",
                    movementCount: product.movements.length
                };
            });

            findings.push({
                ruleId: "RULE_006",
                productCode: code,
                productName: products[0].description,
                errorType: "DUPLICATE_PRODUCT",
                description: `El código ${code} aparece ${products.length} veces en el Kardex del mes ${monthText}.`,
                recommendation: "Verifique que el producto no esté registrado más de una vez dentro del mismo período del Kardex.",
                riskLevel: "MEDIO",
                metadata: {
                    source: "KARDEX",
                    month: Number(monthText),
                    occurrences: products.length,
                    duplicateOccurrences
                }
            });
        }
    }

    private static validateInventory(
        inventory: InventoryItem[],
        source: string,
        findings: Finding[]
    ) {

        const products = new Map<string, InventoryItem[]>();
        for (const item of inventory) {
            const code = CodeHelper.normalize(item.code);
            if (!products.has(code)) {
                products.set(code, []);
            }
            products.get(code)!.push(item);
        }

        for (const [code, items] of products) {
            if (items.length <= 1) {
                continue;
            }
            findings.push({
                ruleId: "RULE_006",
                productCode: code,
                productName: items[0].product,
                errorType: "DUPLICATE_PRODUCT",
                description: `El código ${code} aparece ${items.length} veces en ${source}.`,
                recommendation: "Verifique que el producto no esté registrado más de una vez.",
                riskLevel: "MEDIO",
                metadata: {
                    source,
                    occurrences: items.length,
                    rows: items.map(x => x.item)
                }
            });
        }
    }
}