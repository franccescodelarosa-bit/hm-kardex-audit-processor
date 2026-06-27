import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
export class Rule008 {
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        const masterCodes = new Set<string>();
        for (const item of data.initialInventory) {
            masterCodes.add(item.code.trim().toUpperCase());
        }
        this.validateProducts(
            data.finalInventory,
            "FINAL_INVENTORY",
            findings,
            masterCodes
        );
        this.validateProducts(
            data.kardex,
            "KARDEX",
            findings,
            masterCodes
        );
        return findings;
    }
    private static validateProducts(
        products: any[],
        source: string,
        findings: Finding[],
        masterCodes: Set<string>
    ) {
        for (const product of products) {
            const code = product.code.trim().toUpperCase();
            if (masterCodes.has(code)) {
                continue;
            }
            findings.push({
                ruleId: "RULE_008",
                productCode: product.code,
                productName: product.product ?? product.description,
                errorType: "MASTER_CODE_NOT_FOUND",
                description: "El producto no existe en el Inventario Inicial (Maestro).",
                recommendation: "Verifique que el código del producto esté registrado correctamente.",
                riskLevel: "ALTO",
                metadata: {
                    source
                }
            });
        }
    }
}