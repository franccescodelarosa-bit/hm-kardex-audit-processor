import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { CodeHelper } from "../helpers/code.helper";
import { DateHelper } from "../helpers/date.helper";
export class Rule008 {
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        // Maestro construido con Inventario Inicial + Inventario Final
        const masterCodes = new Set<string>();
        for (const item of data.initialInventory) {
            masterCodes.add(CodeHelper.normalize(item.code));
        }
        for (const item of data.finalInventory) {
            masterCodes.add(CodeHelper.normalize(item.code));
        }
        this.validateKardex(
            data.kardex,
            findings,
            masterCodes
        );
        return findings;
    }

    private static validateKardex(
        products: any[],
        findings: Finding[],
        masterCodes: Set<string>
    ) {
        const processed = new Set<string>();
        for (const product of products) {
            const code = CodeHelper.normalize(product.code);
            if (processed.has(code)) {
                continue;
            }
            processed.add(code);
            if (masterCodes.has(code)) {
                continue;
            }
            const balance = product.movements.at(-1)?.balanceQuantity ?? 0;
            if (balance === 0) {
                continue;
            }
            const firstMovement = product.movements.find(
                (m : any) => !m.document?.startsWith("00 Saldo Inicial")
            );

            const reference = firstMovement ?? product.movements[0];
            findings.push({
                ruleId: "RULE_008",
                productCode: product.code,
                productName: product.product ?? product.description,
                errorType: "MASTER_CODE_NOT_FOUND",
                description:
                    "El producto existe en el Kardex pero no aparece ni en el Inventario Inicial ni en el Inventario Final.",
                recommendation:
                    "Verifique el código del producto o confirme que forme parte del catálogo de inventarios.",
                riskLevel: "ALTO",
                metadata: {
                    source: "KARDEX",
                    date: DateHelper.toDateString(product.movements?.[0]?.date),
                    document: reference.document
                }
            });
        }
    }
}