import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";
import { CodeHelper } from "../helpers/code.helper";

export class Rule012 {

    // Documento que queremos rastrear
    private static readonly DEBUG_DOCUMENT = "Fac-F001-1588";

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        const debugNormalizedDocument =
            DocumentHelper.normalize(this.DEBUG_DOCUMENT);

        console.log("========================================");
        console.log("🔍 RULE_012 DEBUG INICIO");
        console.log("Documento buscado:", this.DEBUG_DOCUMENT);
        console.log("Documento normalizado:", debugNormalizedDocument);
        console.log("Transit items:", data.transit.length);
        console.log("Kardex products:", data.kardex.length);
        console.log("========================================");

        // ============================================================
        // 1. ÍNDICE DE MOVIMIENTOS DE KARDEX POR DOCUMENTO
        // ============================================================        
        const documents = new Map<string, {
            productCode: string;
            productName: string;
            movement: KardexMovement;
        }[]>();
        for (const product of data.kardex) {
            for (const movement of product.movements) {
                // Solo ingresos
                if (movement.entryQuantity <= 0) {
                    continue;
                }
                const normalizedDocument = DocumentHelper.normalize(movement.document);
                if (!normalizedDocument) {
                    continue;
                }
                if (!documents.has(normalizedDocument)) {
                    documents.set(normalizedDocument, []);
                }

                documents.get(normalizedDocument)!.push({
                    productCode: product.code,
                    productName: product.description,
                    movement
                });
            }
        }

        // ============================================================
        // 2. DEBUG: RESULTADO FINAL DEL ÍNDICE
        // ============================================================


        // ============================================================
        // 3. CRUCE CONTRA MERCADERÍA EN TRÁNSITO
        // ============================================================
        
        for (const transit of data.transit) {

            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            const matches =
                documents.get(normalizedDocument) ?? [];

            // RULE004 ya reporta cuando no existe
            if (matches.length === 0) {
                continue;
            }

            // ========================================================
            // 4. SUMA DEL KARDEX
            // ========================================================

            const acquiredCodes = transit.acquiredCodes
                .split(/[-,;\n]/)
                .map(code => CodeHelper.normalize(code))
                .filter(Boolean);

            let kardexTotal = 0;

            const evaluatedProducts: {
                code: string;
                description: string;
                cost: number;
            }[] = [];

            for (const code of acquiredCodes) {

                const productMatches = matches.filter(x =>
                    CodeHelper.normalize(x.productCode) === code
                );

                for (const product of productMatches) {

                    kardexTotal += Number(product.movement.entryTotalCost);

                    evaluatedProducts.push({
                        code: product.productCode,
                        description: product.productName,
                        cost: product.movement.entryTotalCost
                    });
                }
            }

            const expectedCost = Number(transit.expectedCost || 0);

            const difference = Number(
                (expectedCost - kardexTotal).toFixed(2)
            );

            // Si prácticamente son iguales
            if (Math.abs(difference) <= 0.01) {
                continue;
            }

            const kardexLower = kardexTotal < expectedCost;

            findings.push({
                ruleId: "RULE_012",

                productCode: "",
                productName: "",

                errorType: kardexLower
                    ? "MISSING_COSTS"
                    : "OVERCAPITALIZED_COSTS",

                description: kardexLower
                    ? `El costo registrado en el Kardex (${kardexTotal.toFixed(
                        2
                    )}) es inferior al costo esperado (${expectedCost.toFixed(
                        2
                    )}).`
                    : `El costo registrado en el Kardex (${kardexTotal.toFixed(
                        2
                    )}) es superior al costo esperado (${expectedCost.toFixed(
                        2
                    )}).`,

                recommendation: kardexLower
                    ? "Verifique que todos los costos asociados a la compra hayan sido capitalizados en el Kardex."
                    : "Verifique que no se hayan capitalizado costos que no corresponden a la operación.",

                riskLevel: "MEDIO",

                metadata: {
                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,

                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,

                    document: transit.document,

                    expectedCost,
                    kardexCost: kardexTotal,

                    difference,

                    movements: matches.length,
                    evaluatedProducts,
                    transitItem: DateHelper.toDateString(
                        transit.issueDate
                    )
                }
            });
            
        }

        console.log("========================================");
        console.log(
            "🏁 RULE_012 FINALIZADA - FINDINGS:",
            findings.length
        );
        console.log("========================================");

        return findings;
    }
}