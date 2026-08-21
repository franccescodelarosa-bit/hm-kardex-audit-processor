import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";
const MAX_DIFFERENCE_PERCENT = 5;
export class Rule012 {

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

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

            const kardexTotal = matches.reduce(
                (sum, product) =>
                    sum + Number(product.movement.entryTotalCost || 0),
                0
            );

            const evaluatedProducts = matches.map(product => ({
                code: product.productCode,
                description: product.productName,
                cost: Number(product.movement.entryTotalCost || 0)
            }));

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

            const month = DateHelper.monthOf(
                new Date(transit.warehouseDate ?? transit.issueDate)
            );

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

                    expectedCost,
                    kardexCost: kardexTotal,

                    difference,
                    differencePercent,

                    thresholdPercent: MAX_DIFFERENCE_PERCENT,

                    isIncident,

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