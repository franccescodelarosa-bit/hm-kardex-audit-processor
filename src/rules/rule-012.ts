import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { DateHelper } from "../helpers/date.helper";
import { CodeHelper } from "../helpers/code.helper";
const MAX_DIFFERENCE_PERCENT = 5;
export class Rule012 {

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        // ============================================================
        // 1. ÍNDICE DE DOCUMENTOS DEL KARDEX
        // ============================================================
        const documents = new Set<string>();
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
                documents.add(normalizedDocument);
            }
        }

        // ============================================================
        // 2. CRUCE CONTRA MERCADERÍA EN TRÁNSITO
        // ============================================================

        for (const transit of data.transit) {

            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            // RULE004 ya reporta cuando el documento no existe
            if (!documents.has(normalizedDocument)) {
                continue;
            }

            // ========================================================
            // 3. YA NO SE BAJA AL KARDEX POR DOCUMENTO PARA SUMAR.
            // ========================================================
            

            const month = DateHelper.monthOf(
                new Date(transit.warehouseDate ?? transit.issueDate)
            );

            const acquiredCodes =
                String(transit.acquiredCodes ?? "")
                    .split(/[-,;\n]/)
                    .map(code => CodeHelper.normalize(code))
                    .filter(Boolean);

            const evaluatedProducts: {
                code: string;
                description: string;
                cost: number;
            }[] = [];

            let kardexTotal = 0;

            for (const product of data.kardex) {

                const normalizedProductCode =
                    CodeHelper.normalize(product.code);

                if (!acquiredCodes.includes(normalizedProductCode)) {
                    continue;
                }

                for (const movement of product.movements) {

                    if (movement.month !== month) {
                        continue;
                    }

                    // Solo ingresos
                    if (Number(movement.entryQuantity || 0) <= 0) {
                        continue;
                    }

                    const cost = Number(movement.entryTotalCost || 0);
                    kardexTotal += cost;

                    evaluatedProducts.push({
                        code: product.code,
                        description: product.description,
                        cost
                    });
                }
            }

            const expectedCost = Number(
                (
                    Number(transit.subtotal || 0) +
                    Number(transit.igv || 0) +
                    Number(transit.freight || 0) +
                    Number(transit.otherCosts || 0)
                ).toFixed(2)
            );

            const difference = Number(
                (expectedCost - kardexTotal).toFixed(2)
            );
            const differencePercent =
                expectedCost === 0
                    ? kardexTotal === 0
                        ? 0
                        : 100
                    : Math.abs(difference / expectedCost) * 100;
                    
            const isIncident = differencePercent > MAX_DIFFERENCE_PERCENT;

            findings.push({
                ruleId: "RULE_012",

                productCode: transit.document,
                productName: "",

                errorType: isIncident
                    ? "COST_DIFFERENCE"
                    : "ACCEPTED",

                description: isIncident
                    ? `El documento presenta una diferencia de ${differencePercent.toFixed(2)}% entre el valor esperado y el valor registrado en Kardex.`
                    : `El documento presenta una diferencia de ${differencePercent.toFixed(2)}%, dentro del porcentaje permitido.`,

                recommendation: isIncident
                    ? "Verifique la diferencia entre el valor del documento y la valorización registrada en el Kardex."
                    : "No requiere acción. La diferencia se encuentra dentro del porcentaje permitido.",
               

                riskLevel: isIncident
                    ? "MEDIO"
                    : "BAJO",

                 metadata: {
                    month,

                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,

                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,

                    document: transit.document,
                    normalizedDocument,
                    acquiredCodes,

                    expectedCost,
                    kardexCost: kardexTotal,

                    difference,
                    differencePercent,

                    thresholdPercent: MAX_DIFFERENCE_PERCENT,

                    isIncident,

                    movements: evaluatedProducts.length,
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