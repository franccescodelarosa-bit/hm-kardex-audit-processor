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

                let finalEvaluatedProducts = evaluatedProducts;
                let finalFoundCost = foundCost;
                let usedFallback = false;

                /*
                 * ----------------------------------------------------
                 * BUSCA POR CÓDIGO Y POR FACTURA (confirmado con la
                 * usuaria, según sus apuntes del cliente).
                 * ----------------------------------------------------
                 * Primero por `acquiredCodes` (más preciso). Si no
                 * encontró nada -- dato real: la columna "Códigos
                 * Adquiridos" viene vacía en el 99.6% de las facturas
                 * reales del cliente -- cae a buscar el costo por el
                 * propio número de documento, reutilizando
                 * `documentMatches` (ya calculado más arriba, filtrado
                 * igual por mes).
                 */
                if (finalEvaluatedProducts.length === 0) {

                    const fallback =
                        this.buscarPorDocumento(
                            documentMatches,
                            periodMonth
                        );

                    finalEvaluatedProducts = fallback.evaluatedProducts;
                    finalFoundCost = fallback.foundCost;
                    usedFallback = true;
                }

                findings.push(
                    this.buildCostValidationFinding(
                        transit,
                        normalizedDocument,
                        periodMonth,
                        acquiredCodes,
                        finalEvaluatedProducts,
                        finalFoundCost,
                        usedFallback
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

    private static movementDateKey(date: Date | string | null | undefined): string {
        if (!date) {
            return "";
        }
        return date instanceof Date ? date.toISOString() : String(date);
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

        const vistos = new Set<string>();

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

                const dedupeKey = [
                    normalizedProductCode,
                    DocumentHelper.normalize(movement.document),
                    this.movementDateKey(movement.date),
                    movement.entryTotalCost
                ].join("|");

                if (vistos.has(dedupeKey)) {
                    continue;
                }
                vistos.add(dedupeKey);

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

    private static buscarPorDocumento(
        documentMatches: {
            productCode: string;
            productName: string;
            movement: KardexMovement;
        }[],
        periodMonth: number
    ): {
        evaluatedProducts: {
            code: string;
            description: string;
            cost: number;
            month: number | null;
            document: string;
        }[];
        foundCost: number;
    } {

        const evaluatedProducts: {
            code: string;
            description: string;
            cost: number;
            month: number | null;
            document: string;
        }[] = [];

        const vistos = new Set<string>();

        let foundCost = 0;

        for (const match of documentMatches) {

            // Mismo filtro por mes que se aplica en la búsqueda por
            // código -- no vale un ingreso de otro mes.
            if (match.movement.month !== periodMonth) {
                continue;
            }

            const dedupeKey = [
                CodeHelper.normalize(match.productCode),
                DocumentHelper.normalize(match.movement.document),
                this.movementDateKey(match.movement.date),
                match.movement.entryTotalCost
            ].join("|");

            if (vistos.has(dedupeKey)) {
                continue;
            }
            vistos.add(dedupeKey);

            const cost =
                Number(match.movement.entryTotalCost || 0);

            foundCost += cost;

            evaluatedProducts.push({
                code: match.productCode,
                description: match.productName,
                cost,
                month: match.movement.month,
                document: match.movement.document
            });
        }

        return { evaluatedProducts, foundCost };
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
        foundCost: number,
        usedFallback: boolean
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

        /*
         * NO EVALUABLE: ni por código adquirido ni por documento (con su
         * fallback) se encontró ningún producto -- no hay nada contra
         * qué comparar. Esto es DISTINTO de una incidencia real de
         * costo: no es "el costo no coincide", es "no se pudo revisar".
         * Antes los dos casos daban exactamente el mismo resultado
         * mecánico (100% de diferencia, TRANSIT_COST_MISMATCH) -- ya no.
         */
        const noEvaluable =
            evaluatedProducts.length === 0;

        const isIncident =
            !noEvaluable &&
            differencePercent > MAX_DIFFERENCE_PERCENT;

        return {

            ruleId: "RULE_004",

            productCode: transit.document,

            productName: "",

            errorType: noEvaluable
                ? "TRANSIT_COST_NOT_EVALUABLE"
                : isIncident
                    ? "TRANSIT_COST_MISMATCH"
                    : "ACCEPTED",

            description: noEvaluable
                ? `El documento ${transit.document} está registrado en el Kardex, pero no se encontró ningún costo de ingreso para sus productos en el mes correspondiente (ni por código adquirido ni por documento) -- no fue posible evaluar el costo.`
                : isIncident
                    ? `El documento ${transit.document} presenta una diferencia de ${differencePercent.toFixed(2)}% entre el costo esperado y el costo encontrado en el Kardex.`
                    : `El documento ${transit.document} presenta una diferencia de ${differencePercent.toFixed(2)}%, dentro del porcentaje permitido.`,

            recommendation: noEvaluable
                ? "Verifique manualmente este documento -- no se encontraron productos por código adquirido ni por número de documento en el mes correspondiente."
                : isIncident
                    ? "Verifique la diferencia entre el costo esperado del comprobante y lo registrado en el Kardex."
                    : "No requiere acción. La diferencia se encuentra dentro del porcentaje permitido.",

            riskLevel: isIncident || noEvaluable
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

                noEvaluable,

                usedFallback,

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
