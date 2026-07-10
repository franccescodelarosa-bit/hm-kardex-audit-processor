import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";

export class Rule012 {
    private static debugCount = 0;
    private static equalsOrGreater(a: number, b: number): boolean {
        return a + 0.01 >= b;
    }
    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];
        // Índice por documento
        const documents = new Map<string, KardexMovement[]>();
        for (const product of data.kardex) {
            for (const movement of product.movements) {
                // Solo ingresos
                if (movement.entryQuantity <= 0) { continue; }
                const normalizedDocument = DocumentHelper.normalize(movement.document);
                if (!normalizedDocument) { continue; }
                if (!documents.has(normalizedDocument)) {
                    documents.set(normalizedDocument, []);
                }
                documents.get(normalizedDocument)!.push(movement);
            }
        }
        // Cruce contra Mercadería en Tránsito
        for (const transit of data.transit) {
            const normalizedDocument = DocumentHelper.normalize(transit.document);
            const matches = documents.get(normalizedDocument) ?? [];
            // RULE004 ya reporta cuando no existe
            if (matches.length === 0) { continue; }
            // Total registrado en Kardex
            const kardexTotal = matches.reduce( (sum, movement) => sum + movement.entryTotalCost,0 );
            // Ajusta este nombre según tu modelo TransitItem
            const transitTotal = transit.total;
            
            // El Kardex debe ser igual o mayor
            if (this.equalsOrGreater(kardexTotal, transitTotal)) {
                continue;
            }

            findings.push({
                ruleId: "RULE_012",
                productCode: "",
                productName: "",
                errorType: "TRANSIT_AMOUNT_MISMATCH",
                description:
                    `El monto registrado en el Kardex (${kardexTotal.toFixed(2)}) es menor al monto de la operación (${transitTotal.toFixed(2)}).`,
                recommendation:
                    "Verifique que todos los productos de la operación hayan sido registrados en el Kardex.",
                riskLevel: "MEDIO",
                metadata: {
                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,
                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,
                    document: transit.document,
                    normalizedDocument,
                    transitAmount: transitTotal,
                    kardexAmount: kardexTotal,
                    difference: transitTotal - kardexTotal,
                    movements: matches.length,
                    transitItem: DateHelper.toDateString(transit.issueDate)
                }
            });
        }
        return findings;
    }
}