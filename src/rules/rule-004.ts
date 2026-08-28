import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { KardexProduct } from "../models/kardex-product";
import { TransitItem } from "../models/transit-item";
import { DateHelper } from "../helpers/date.helper";
import { CodeHelper } from "../helpers/code.helper";

const MAX_DIFFERENCE_PERCENT = 5;

export class Rule004 {

    static execute(data: AuditData): Finding[] {

        const findings: Finding[] = [];

        /*
         * ============================================================
         * 1. ÍNDICE DE DOCUMENTOS DEL KARDEX
         * ============================================================
         */

        const documents = new Map<string, {
            productCode: string;
            productName: string;
            movement: KardexMovement;
        }[]>();

        for (const product of data.kardex) {

            for (const movement of product.movements) {

                // Solo ingresos
                if (Number(movement.entryQuantity || 0) <= 0) {
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

                documents.get(normalizedDocument)!.push({
                    productCode: product.code,
                    productName: product.description,
                    movement
                });
            }
        }

        /*
         * ============================================================
         * 2. PROCESAR MERCADERÍA EN TRÁNSITO
         * ============================================================
         */

        for (const transit of data.transit) {

            const normalizedDocument =
                DocumentHelper.normalize(transit.document);

            const documentMatches =
                documents.get(normalizedDocument) ?? [];

            /*
             * ========================================================
             * 3. CORTE POR AÑO (aplica a los dos casos: encontrado y
             *    no encontrado)
             * ========================================================
             *
             * Si el ingreso al almacén cae en un año DISTINTO al
             * ejercicio auditado, no corresponde exigir que ya esté
             * en el Kardex de ESTE ejercicio -- no se genera hallazgo.
             *
             * Si no tenemos el año de la auditoría disponible (datos
             * viejos), no podemos aplicar este corte — se mantiene el
             * comportamiento anterior.
             */

            const periodDateObj =
                new Date(transit.warehouseDate ?? transit.issueDate);

            if (
                data.year !== undefined &&
                periodDateObj.getFullYear() !== data.year
            ) {
                continue;
            }

            const periodMonth = DateHelper.monthOf(periodDateObj);

            const { acquiredCodes, evaluatedProducts, foundCost } =
                this.buscarPorCodigosAdquiridos(
                    data.kardex,
                    transit,
                    periodMonth
                );

            /*
             * ========================================================
             * 4. SI EL DOCUMENTO SÍ EXISTE EN KARDEX
             * ========================================================
             *
             * Confirmado con la usuaria: ahora TAMBIÉN valida costo
             * para las facturas encontradas -- busca por los códigos
             * adquiridos + mes (mismo mecanismo que el caso NO
             * encontrado, ver más abajo), y compara contra el costo
             * esperado que trae la propia columna del cliente.
             */

            if (documentMatches.length > 0) {

                findings.push(
                    this.buildCostValidationFinding(
                        transit,
                        normalizedDocument,
                        periodMonth,
                        acquiredCodes,
                        evaluatedProducts,
                        foundCost
                    )
                );

                continue;
            }

            /*
             * ========================================================
             * 5. SI EL DOCUMENTO NO EXISTE EN KARDEX
             * ========================================================
             *
             * El finding existe porque el DOCUMENTO NO ESTÁ
             * REGISTRADO EN KARDEX. Los valores esperado/encontrado
             * son información adicional para la auditoría.
             */

            const expectedCost =
                Number(transit.expectedCost ?? 0);

            const difference =
                Number(
                    (
                        expectedCost -
                        foundCost
                    ).toFixed(2)
                );

            const differencePercent =
                expectedCost === 0
                    ? 0
                    : Math.abs(
                        difference /
                        expectedCost
                    ) * 100;

            findings.push({

                ruleId: "RULE_004",

                productCode: "",

                productName: "",

                errorType:
                    "TRANSIT_NOT_FOUND",

                description:
                    `El comprobante ${transit.document} no fue encontrado en ningún ingreso del Kardex.`,

                recommendation:
                    "Verifique que la mercadería en tránsito haya sido registrada en el Kardex y que los productos adquiridos correspondan al documento.",

                riskLevel: "MEDIO",

                metadata: {

                    transitItem:
                        DateHelper.toDateString(
                            transit.issueDate
                        ),

                    month:
                        periodMonth,

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

                    acquiredCodes,

                    expectedCost,

                    foundCost,

                    difference,

                    differencePercent,

                    evaluatedProducts,

                    products:
                        evaluatedProducts
                            .map(
                                product =>
                                    `${product.code} - ${product.description}`
                            )
                            .join("\n")
                }
            });
        }

        return findings;
    }

    private static buscarPorCodigosAdquiridos(
        kardex: KardexProduct[],
        transit: TransitItem,
        periodMonth: number
    ): {
        acquiredCodes: string[];
        evaluatedProducts: {
            code: string;
            description: string;
            cost: number;
            month: number | null;
            document: string;
        }[];
        foundCost: number;
    } {

        const acquiredCodes =
            String(transit.acquiredCodes ?? "")
                .split(/[-,;\n]/)
                .map(code => CodeHelper.normalize(code))
                .filter(Boolean);

        const evaluatedProducts: {
            code: string;
            description: string;
            cost: number;
            month: number | null;
            document: string;
        }[] = [];

        let foundCost = 0;

        for (const product of kardex) {

            const normalizedProductCode =
                CodeHelper.normalize(product.code);

            if (!acquiredCodes.includes(normalizedProductCode)) {
                continue;
            }

            for (const movement of product.movements) {

                if (movement.month !== periodMonth) {
                    continue;
                }

                // Solo ingresos
                if (Number(movement.entryQuantity || 0) <= 0) {
                    continue;
                }

                const cost =
                    Number(movement.entryTotalCost || 0);

                foundCost += cost;

                evaluatedProducts.push({
                    code: product.code,
                    description: product.description,
                    cost,
                    month: movement.month,
                    document: movement.document
                });
            }
        }

        return { acquiredCodes, evaluatedProducts, foundCost };
    }


    private static buildCostValidationFinding(
        transit: TransitItem,
        normalizedDocument: string,
        periodMonth: number,
        acquiredCodes: string[],
        evaluatedProducts: {
            code: string;
            description: string;
            cost: number;
            month: number | null;
            document: string;
        }[],
        foundCost: number
    ): Finding {

        const expectedCost =
            Number(transit.expectedCost ?? 0);

        const difference =
            Number((expectedCost - foundCost).toFixed(2));

        const differencePercent =
            expectedCost === 0
                ? foundCost === 0
                    ? 0
                    : 100
                : Math.abs(difference / expectedCost) * 100;

        const isIncident =
            differencePercent > MAX_DIFFERENCE_PERCENT;

        return {

            ruleId: "RULE_004",

            productCode: transit.document,

            productName: "",

            errorType: isIncident
                ? "TRANSIT_COST_MISMATCH"
                : "ACCEPTED",

            description: isIncident
                ? `El documento ${transit.document} presenta una diferencia de ${differencePercent.toFixed(2)}% entre el costo esperado y el costo encontrado en el Kardex.`
                : `El documento ${transit.document} presenta una diferencia de ${differencePercent.toFixed(2)}%, dentro del porcentaje permitido.`,

            recommendation: isIncident
                ? "Verifique la diferencia entre el costo esperado del comprobante y lo registrado en el Kardex."
                : "No requiere acción. La diferencia se encuentra dentro del porcentaje permitido.",

            riskLevel: isIncident
                ? "MEDIO"
                : "BAJO",

            metadata: {

                transitItem:
                    DateHelper.toDateString(transit.issueDate),

                month: periodMonth,

                issueDate: transit.issueDate,

                warehouseDate: transit.warehouseDate,

                supplierRuc: transit.supplierRuc,

                supplier: transit.supplier,

                document: transit.document,

                normalizedDocument,

                acquiredCodes,

                expectedCost,

                foundCost,

                difference,

                differencePercent,

                thresholdPercent: MAX_DIFFERENCE_PERCENT,

                isIncident,

                evaluatedProducts,

                products:
                    evaluatedProducts
                        .map(
                            product =>
                                `${product.code} - ${product.description}`
                        )
                        .join("\n")
            }
        };
    }
}
