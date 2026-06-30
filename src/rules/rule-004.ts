import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";

export class Rule004 {
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];

        // Índice de documentos registrados en el Kardex (solo ingresos)
        const documents = new Map<string, KardexMovement[]>();
        for (const product of data.kardex) {
            for (const movement of product.movements) {

                // Solo movimientos de ingreso
                if (movement.entryQuantity <= 0) {
                    continue;
                }

                const normalizedDocument =
                    DocumentHelper.normalize(movement.document);
                if (!normalizedDocument) {
                    continue;
                }

                if (!documents.has(normalizedDocument)) {
                    documents.set(normalizedDocument, []);
                }

                documents.get(normalizedDocument)!.push(movement);
            }
        }

        // Cruce Mercadería en Tránsito vs Kardex
        for (const transit of data.transit) {
            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            const matches =
                documents.get(normalizedDocument) ?? [];
            
            // Encontrado
            if (matches.length > 0) {
                continue;
            }

            // No encontrado
            findings.push({
                ruleId: "RULE_004",
                productCode: "",
                productName: "",
                errorType: "TRANSIT_NOT_FOUND",
                description:
                    `El comprobante ${transit.document} no fue encontrado en ningún ingreso del Kardex.`,
                recommendation:
                    "Verifique que la mercadería en tránsito haya sido registrada en el Kardex.",
                riskLevel: "MEDIO",
                metadata: {
                    transitItem: transit.item,
                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,
                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,
                    document: transit.document,
                    normalizedDocument
                }
            });

            /*
             * PENDIENTE DE DEFINICIÓN FUNCIONAL
             *
             * - Duplicado
             * - Registrado fuera de plazo
             *
             * Una misma factura puede contener varios productos
             * y generar múltiples movimientos válidos en el Kardex.
             * HM debe definir el criterio para considerar
             * un documento como duplicado.
             */
        }

        return findings;
    }

}