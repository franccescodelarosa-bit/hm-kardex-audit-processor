import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";

export class Rule004 {

    private static readonly DEBUG_DOCUMENTS = [
        "Fac-F001-501064",
        "Fac-F001-1588"
    ];

    static execute(data: AuditData): Finding[] {
        const findings: Finding[] = [];

        const debugDocuments = new Set(
            this.DEBUG_DOCUMENTS.map(document =>
                DocumentHelper.normalize(document)
            )
        );

        console.log("========================================");
        console.log("🔍 RULE_004 DEBUG DOCUMENTOS");

        for (const document of this.DEBUG_DOCUMENTS) {
            console.log({
                original: document,
                normalized: DocumentHelper.normalize(document)
            });
        }

        console.log("========================================");

        // Índice de documentos registrados en el Kardex
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

                const normalizedDocument =
                    DocumentHelper.normalize(movement.document);

                if (!normalizedDocument) {
                    continue;
                }

                // DEBUG: encontramos uno de los documentos objetivo en Kardex
                if (debugDocuments.has(normalizedDocument)) {

                    console.log("🔥 RULE_004 - DOCUMENTO ENCONTRADO EN KARDEX");

                    console.log({
                        productCode: product.code,
                        productName: product.description,

                        originalDocument: movement.document,
                        normalizedDocument,

                        month: movement.month,
                        date: movement.date,

                        entryQuantity: movement.entryQuantity,
                        entryUnitCost: movement.entryUnitCost,
                        entryTotalCost: movement.entryTotalCost
                    });
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
        // DEMO DIRECTA: ¿EXISTEN LOS DOS DOCUMENTOS EN EL ÍNDICE?
        // ============================================================

        console.log("========================================");
        console.log("🧪 RULE_004 - RESULTADO DIRECTO DEL ÍNDICE");

        for (const originalDocument of this.DEBUG_DOCUMENTS) {

            const normalizedDocument =
                DocumentHelper.normalize(originalDocument);

            const matches =
                documents.get(normalizedDocument) ?? [];

            console.log({
                originalDocument,
                normalizedDocument,
                found: matches.length > 0,
                matches: matches.length,
                products: matches.map(x => ({
                    productCode: x.productCode,
                    productName: x.productName,
                    kardexDocument: x.movement.document,
                    entryQuantity: x.movement.entryQuantity,
                    entryTotalCost: x.movement.entryTotalCost
                }))
            });
        }

        console.log("========================================");

        // ============================================================
        // CRUCE MERCADERÍA EN TRÁNSITO VS KARDEX
        // ============================================================

        for (const transit of data.transit) {

            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            const matches =
                documents.get(normalizedDocument) ?? [];

            const isDebugDocument =
                debugDocuments.has(normalizedDocument);

            if (isDebugDocument) {

                console.log("🚨 RULE_004 - DOCUMENTO EN TRANSIT");

                console.log({
                    transitDocument: transit.document,
                    normalizedDocument,

                    foundInKardex: matches.length > 0,
                    matches: matches.length,

                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,
                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,

                    // IMPORTANTE PARA INVESTIGAR RULE_012
                    transitTotal: transit.expectedCost,

                    matchedProducts: matches.map(x => ({
                        productCode: x.productCode,
                        productName: x.productName,
                        kardexDocument: x.movement.document,
                        entryQuantity: x.movement.entryQuantity,
                        entryUnitCost: x.movement.entryUnitCost,
                        entryTotalCost: x.movement.entryTotalCost
                    }))
                });
            }

            const month = matches.length > 0
                ? matches[0].movement.month
                : null;

            const duplicatedItems = matches.length;

            const products = matches
                .map(x => `${x.productCode} - ${x.productName}`)
                .join("\n");
            const foundTotal = matches.reduce(
                (sum, x) => sum + Number(x.movement.entryTotalCost || 0),
                0
            );
            
            // ============================================================
            // VALIDACIÓN: TOTAL DE MERCADERÍA EN TRÁNSITO EN CERO
            // ===========================================================

            const transitTotal = Number(transit.expectedCost ?? 0);

            if (transitTotal === 0) {

                console.log("❌ RULE_004 - TOTAL DE TRÁNSITO EN CERO", {
                    document: transit.document,
                    normalizedDocument,
                    total: transit.expectedCost,
                    supplier: transit.supplier,
                    supplierRuc: transit.supplierRuc,
                    foundInKardex: matches.length > 0
                });

                findings.push({
                    ruleId: "RULE_004",
                    productCode: "",
                    productName: "",
                    errorType: "TRANSIT_TOTAL_ZERO",
                    description:
                        `El comprobante ${transit.document} presenta un valor total de 0 en el reporte de mercadería en tránsito.`,
                    recommendation:
                        "Verifique el valor total del comprobante en el reporte de mercadería en tránsito.",
                    riskLevel: "MEDIO",
                    metadata: {
                        transitItem: DateHelper.toDateString(transit.issueDate),
                        month,
                        duplicatedItems,
                        products,
                        issueDate: transit.issueDate,
                        warehouseDate: transit.warehouseDate,
                        supplierRuc: transit.supplierRuc,
                        supplier: transit.supplier,
                        document: transit.document,
                        normalizedDocument,
                        expectedCost: transitTotal,
                        foundCost: foundTotal
                    }
                });
            }

            // Encontrado
            if (matches.length > 0) {

                if (isDebugDocument) {
                    console.log(
                        `✅ RULE_004: ${transit.document} ENCONTRADO - NO GENERA FINDING`
                    );
                }

                continue;
            }

            if (isDebugDocument) {
                console.log(
                    `❌ RULE_004: ${transit.document} NO ENCONTRADO - GENERA FINDING`
                );
            }
            const expectedCost = Number(transit.expectedCost ?? 0);

            const foundCost = matches.reduce(
                (sum, x) => sum + Number(x.movement.entryTotalCost || 0),
                0
            );

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
                    transitItem: DateHelper.toDateString(transit.issueDate),
                    month,
                    duplicatedItems,
                    products,
                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,
                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,
                    document: transit.document,
                    normalizedDocument,
                    expectedCost,
                    foundCost
                }
            });
        }

        return findings;
    }
}