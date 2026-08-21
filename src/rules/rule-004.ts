import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";
import { DocumentHelper } from "../helpers/document.helper";
import { KardexMovement } from "../models/kardex-movement";
import { DateHelper } from "../helpers/date.helper";
import { CodeHelper } from "../helpers/code.helper";

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
             * 3. SI EL DOCUMENTO EXISTE EN KARDEX
             * ========================================================
             *
             * RULE_004 solo debe reportar documentos NO encontrados.
             */

            if (documentMatches.length > 0) {
                continue;
            }

            /*
             * ========================================================
             * 4. OBTENER MES DEL PERÍODO
             * ========================================================
             *
             * El período de Mercadería en Tránsito corresponde
             * a la fecha de ingreso al almacén.
             *
             * Ejemplo:
             *
             * Emisión:       06/12/2023
             * Ingreso almacén: 04/01/2024
             *
             * Período = Enero
             */

            const periodDateObj =
                new Date(transit.warehouseDate ?? transit.issueDate);

            /*
             * ========================================================
             * 4b. POLÍTICA DE MERCADERÍA EN TRÁNSITO: CORTE POR AÑO
             * ========================================================
             *
             * Si el ingreso al almacén cae en un año DISTINTO al
             * ejercicio auditado, la mercadería legítimamente puede
             * seguir en tránsito fuera del año que estamos auditando.
             * No corresponde exigir que ya esté en el Kardex de ESTE
             * ejercicio, así que no se genera hallazgo.
             *
             * Si no tenemos el año de la auditoría disponible (datos
             * viejos), no podemos aplicar este corte — se mantiene el
             * comportamiento anterior.
             */
            if (
                data.year !== undefined &&
                periodDateObj.getFullYear() !== data.year
            ) {
                continue;
            }

            const periodMonth =
                periodDateObj.getMonth() + 1;

            /*
             * ========================================================
             * 5. OBTENER CÓDIGOS DE ITEMS ADQUIRIDOS
             * ========================================================
             *
             * Ejemplo:
             *
             * ´00002525 - 00007894 - ´00362541
             *
             * Separamos por -, , ; o salto de línea.
             */

            const acquiredCodes =
                String(transit.acquiredCodes ?? "")
                    .split(/[-,;\n]/)
                    .map(code => CodeHelper.normalize(code))
                    .filter(Boolean);

            /*
             * ========================================================
             * 6. BUSCAR LOS PRODUCTOS EN EL KARDEX
             * ========================================================
             *
             * IMPORTANTE:
             *
             * NO usamos el documento.
             *
             * Buscamos por los códigos adquiridos y por el mes
             * correspondiente al período.
             */

            const evaluatedProducts: {
                code: string;
                description: string;
                cost: number;
                month: number | null;
                document: string;
            }[] = [];

            let foundCost = 0;

            for (const product of data.kardex) {

                const normalizedProductCode =
                    CodeHelper.normalize(product.code);

                if (!acquiredCodes.includes(normalizedProductCode)) {
                    continue;
                }

                /*
                 * Buscar movimientos del producto correspondientes
                 * al período.
                 */

                for (const movement of product.movements) {

                    if (
                        movement.month !== periodMonth
                    ) {
                        continue;
                    }

                    /*
                     * Solo ingresos.
                     */
                    if (
                        Number(movement.entryQuantity || 0) <= 0
                    ) {
                        continue;
                    }

                    const cost =
                        Number(
                            movement.entryTotalCost || 0
                        );

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

            /*
             * ========================================================
             * 7. VALOR ESPERADO
             * ========================================================
             */

            const expectedCost =
                Number(transit.expectedCost ?? 0);

            /*
             * ========================================================
             * 8. DIFERENCIA
             * ========================================================
             */

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

            /*
             * ========================================================
             * 9. GENERAR FINDING
             * ========================================================
             *
             * El finding existe porque el DOCUMENTO NO ESTÁ
             * REGISTRADO EN KARDEX.
             *
             * Los valores esperado/encontrado son información
             * adicional para la auditoría.
             */

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
}