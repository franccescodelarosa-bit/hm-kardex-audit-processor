import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { InventoryItem } from "../models/inventory-item";
import { CodeHelper } from "../helpers/code.helper";

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
        return findings;
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