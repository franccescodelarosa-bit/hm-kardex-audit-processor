import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";

export class Rule012 {

    // Documento que queremos rastrear
    private static readonly DEBUG_DOCUMENT = "Fac-F001-1588";

    private static equalsOrGreater(a: number, b: number): boolean {
        return a + 0.01 >= b;
    }

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

        const documents = new Map<string, KardexMovement[]>();

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

                // DEBUG DEL DOCUMENTO OBJETIVO
                if (normalizedDocument === debugNormalizedDocument) {

                    console.log("🔥 KARDEX MATCH ENCONTRADO");
                    console.log({
                        productCode: product.code,
                        productName: product.description,

                        originalDocument: movement.document,
                        normalizedDocument,

                        date: movement.date,

                        entryQuantity: movement.entryQuantity,
                        entryUnitCost: movement.entryUnitCost,
                        entryTotalCost: movement.entryTotalCost,

                        operation: movement.operation
                    });
                }

                if (!documents.has(normalizedDocument)) {
                    documents.set(normalizedDocument, []);
                }

                documents.get(normalizedDocument)!.push(movement);
            }
        }

        // ============================================================
        // 2. DEBUG: RESULTADO FINAL DEL ÍNDICE
        // ============================================================

        const debugMatches =
            documents.get(debugNormalizedDocument) ?? [];

        console.log("========================================");
        console.log("📦 RESUMEN KARDEX DOCUMENTO DEBUG");
        console.log("Documento:", debugNormalizedDocument);
        console.log("Movimientos encontrados:", debugMatches.length);

        debugMatches.forEach((movement, index) => {

            console.log(`MOVIMIENTO ${index + 1}`, {
                document: movement.document,
                normalizedDocument:
                    DocumentHelper.normalize(movement.document),

                date: movement.date,

                entryQuantity: movement.entryQuantity,
                entryUnitCost: movement.entryUnitCost,
                entryTotalCost: movement.entryTotalCost
            });
        });

        const debugKardexTotal = debugMatches.reduce(
            (sum, movement) =>
                sum + Number(movement.entryTotalCost || 0),
            0
        );

        console.log(
            "💰 TOTAL KARDEX ENCONTRADO:",
            debugKardexTotal
        );

        console.log("========================================");

        // ============================================================
        // 3. CRUCE CONTRA MERCADERÍA EN TRÁNSITO
        // ============================================================

        for (const transit of data.transit) {

            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            const isDebugDocument =
                normalizedDocument === debugNormalizedDocument;

            if (isDebugDocument) {

                console.log("🚨 TRANSIT DEBUG ENCONTRADO");

                console.log({
                    originalDocument: transit.document,
                    normalizedDocument,

                    issueDate: transit.issueDate,
                    warehouseDate: transit.warehouseDate,

                    supplierRuc: transit.supplierRuc,
                    supplier: transit.supplier,

                    transitTotal: transit.total
                });
            }

            const matches =
                documents.get(normalizedDocument) ?? [];

            // RULE004 ya reporta cuando no existe
            if (matches.length === 0) {

                if (isDebugDocument) {
                    console.log(
                        "❌ NO EXISTEN MATCHES EN KARDEX PARA:",
                        normalizedDocument
                    );
                }

                continue;
            }

            // ========================================================
            // 4. SUMA DEL KARDEX
            // ========================================================

            const kardexTotal = matches.reduce(
                (sum, movement) =>
                    sum + Number(movement.entryTotalCost || 0),
                0
            );

            const transitTotal =
                Number(transit.total || 0);

            if (isDebugDocument) {

                console.log("========================================");
                console.log("🧮 COMPARACIÓN RULE_012");
                console.log({
                    document: transit.document,
                    normalizedDocument,

                    matches: matches.length,

                    transitTotal,
                    kardexTotal,

                    difference:
                        transitTotal - kardexTotal,

                    equalsOrGreater:
                        this.equalsOrGreater(
                            kardexTotal,
                            transitTotal
                        )
                });

                console.log(
                    "DETALLE DE MOVIMIENTOS SUMADOS:"
                );

                matches.forEach((movement, index) => {

                    console.log({
                        index: index + 1,

                        document: movement.document,

                        date: movement.date,

                        entryQuantity:
                            movement.entryQuantity,

                        entryUnitCost:
                            movement.entryUnitCost,

                        entryTotalCost:
                            movement.entryTotalCost
                    });
                });

                console.log("========================================");
            }

            // ========================================================
            // 5. VALIDACIÓN
            // ========================================================

            if (
                this.equalsOrGreater(
                    kardexTotal,
                    transitTotal
                )
            ) {

                if (isDebugDocument) {
                    console.log(
                        "⚠️ RULE_012 NO GENERA FINDING"
                    );

                    console.log({
                        reason:
                            "kardexTotal >= transitTotal",
                        kardexTotal,
                        transitTotal
                    });
                }

                continue;
            }

            if (isDebugDocument) {
                console.log(
                    "🔥🔥🔥 RULE_012 GENERANDO FINDING 🔥🔥🔥"
                );
            }

            findings.push({

                ruleId: "RULE_012",

                productCode: "",
                productName: "",

                errorType:
                    "TRANSIT_AMOUNT_MISMATCH",

                description:
                    `El monto registrado en el Kardex (${kardexTotal.toFixed(2)}) ` +
                    `es menor al monto de la operación (${transitTotal.toFixed(2)}).`,

                recommendation:
                    "Verifique que todos los productos de la operación hayan sido registrados en el Kardex.",

                riskLevel: "MEDIO",

                metadata: {

                    issueDate:
                        transit.issueDate,

                    warehouseDate:
                        transit.warehouseDate,

                    supplierRuc:
                        transit.supplierRuc,

                    supplier:
                        transit.supplier,

                    document:
                        transit.document,

                    normalizedDocument,

                    transitAmount:
                        transitTotal,

                    kardexAmount:
                        kardexTotal,

                    difference:
                        transitTotal - kardexTotal,

                    movements:
                        matches.length,

                    transitItem:
                        DateHelper.toDateString(
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