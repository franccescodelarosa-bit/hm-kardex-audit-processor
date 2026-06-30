import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { CodeHelper } from "../helpers/code.helper";

export class Rule008 {

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        // Maestro de códigos (Inventario Inicial)
        const masterCodes = new Set<string>();

        for (const item of data.initialInventory) {
            const code = CodeHelper.normalize(item.code);
            if (item.code.includes("26861")) {
                console.log({
                    original: item.code,
                    normalized: code
                });
            }
            masterCodes.add(CodeHelper.normalize(item.code));
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

        // Evitar revisar el mismo código varias veces
        const processed = new Set<string>();

        for (const product of products) {

            const code = CodeHelper.normalize(product.code);

            if (processed.has(code)) {
                continue;
            }

            processed.add(code);

            // DEBUG
            if (code === "26861") {

                console.log("=================================");
                console.log("RULE008");
                console.log({
                    source,
                    code,
                    existsInMaster: masterCodes.has(code)
                });

            }

            if (masterCodes.has(code)) {
                continue;
            }

            findings.push({

                ruleId: "RULE_008",
                productCode: product.code,
                productName: product.product ?? product.description,
                errorType: "MASTER_CODE_NOT_FOUND",

                description:
                    "El producto no existe en el Inventario Inicial (Maestro).",

                recommendation:
                    "Verifique que el código del producto esté registrado correctamente.",

                riskLevel: "ALTO",

                metadata: {
                    source
                }

            });

        }

    }

}