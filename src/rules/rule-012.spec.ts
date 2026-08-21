
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule012 } from "./rule-012";
import { auditData, kardexProduct, movement, transitItem } from "../testing/kardex-fixtures";

test("RULE_012: documento sin match en el Kardex -> no genera hallazgo (lo cubre RULE_004)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-9999", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_012: costo esperado coincide con la suma del Kardex -> ACCEPTED", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "ACCEPTED");
    assert.equal(findings[0].metadata!.isIncident, false);
});

test("RULE_012: una factura con VARIOS productos en el Kardex -> se suman todas las entradas de ese documento", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [
            kardexProduct("0000001", "PRODUCTO A", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 70 })
            ]),
            kardexProduct("0000002", "PRODUCTO B", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 48 })
            ])
        ]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 118);
    assert.equal(findings[0].metadata!.movements, 2);
    assert.equal(findings[0].errorType, "ACCEPTED");
});

test("RULE_012: diferencia grande entre costo esperado y Kardex -> COST_DIFFERENCE", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 80 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "COST_DIFFERENCE");
    assert.equal(findings[0].metadata!.isIncident, true);
});

test("RULE_012: solo cuenta movimientos de ENTRADA del Kardex (una salida con el mismo documento no debe sumar)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118 }),
            movement({ operation: "01", document: "Fac-F001-501064", exitQuantity: 3, exitTotalCost: 35.4 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 118);
});

test("RULE_012 (reproduce el ejemplo real Fac-F001-503371): el Costo Esperado incluye Flete y Otros Costos, no solo Subtotal+IGV", () => {
    // Datos reales: Subtotal 684.17, IGV 123.15, Flete 30.00, Otros 0.00
    // -> Costo Esperado real (columna del cliente) = 837.32. Confirmado
    // con la usuaria: RULE_012 usa la columna del Excel del cliente tal
    // cual (con Flete), a diferencia de RULE_004 que usa solo Subtotal+IGV.
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-503371",
            subtotal: 684.17,
            igv: 123.15,
            freight: 30.00,
            otherCosts: 0,
            expectedCost: 807.32 // este campo YA NO se usa en RULE_012 -- se deja distinto a proposito para confirmar que no se lee
        })],
        kardex: [kardexProduct("040751", "MALLA MOSQUITERO", [
            movement({ operation: "02", document: "Fac-F001-503371", entryQuantity: 1, entryTotalCost: 849.42 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.expectedCost, 837.32, "el costo esperado debe ser Subtotal+IGV+Flete+Otros, no Subtotal+IGV solo");
    assert.equal(Math.round((findings[0].metadata!.differencePercent as number) * 100) / 100, 1.45, "con el costo esperado correcto (837.32), la diferencia baja de 5.21% a ~1.45%");
    assert.equal(findings[0].errorType, "ACCEPTED", "con el Flete incluido, esta factura pasa a estar DENTRO del umbral del 5%");
});

test("RULE_012: guarda normalizedDocument en metadata (antes quedaba undefined en la trazabilidad del Excel)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].metadata!.normalizedDocument, "normalizedDocument no deberia quedar undefined");
});

test("RULE_012: usa el numero de documento como productCode (una factura puede tener varios productos, no hay un unico codigo)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", subtotal: 100, igv: 18, expectedCost: 118 })],
        kardex: [
            kardexProduct("0000001", "PRODUCTO A", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 70 })
            ]),
            kardexProduct("0000002", "PRODUCTO B", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 48 })
            ])
        ]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].productCode, "Fac-F001-501064", "confirmado con la usuaria: se muestra el documento en vez de dejarlo vacio, ya que puede haber mas de un producto por factura");
});

test("RULE_012: guarda el mes en metadata (sacado de la fecha de ingreso a almacen), igual que hace RULE_004 con los mismos datos", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            subtotal: 100, igv: 18, expectedCost: 118,
            // Emision en diciembre, ingreso a almacen recien en marzo -- el
            // mes que importa es el de ingreso a almacen (warehouseDate),
            // igual que ya hace RULE_004 con este mismo campo.
            issueDate: new Date(Date.UTC(2023, 11, 20)),
            warehouseDate: new Date(Date.UTC(2024, 2, 5))
        })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.month, 3, "el mes debe salir de warehouseDate (marzo), no de issueDate (diciembre)");
});
