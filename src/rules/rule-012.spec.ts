
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule012 } from "./rule-012";
import { auditData, kardexProduct, movement, transitItem } from "../testing/kardex-fixtures";

const ENERO = { issueDate: new Date(Date.UTC(2023, 11, 20)), warehouseDate: new Date(Date.UTC(2024, 0, 5)) };

test("RULE_012: documento sin match en el Kardex -> no genera hallazgo (lo cubre RULE_004). El filtro sigue siendo por DOCUMENTO, eso no cambió.", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-9999", acquiredCodes: "0000001", subtotal: 100, igv: 18, expectedCost: 118, ...ENERO })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118, month: 1 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_012 (Opción confirmada): ya NO busca por documento para sumar -- busca por los CÓDIGOS ADQUIRIDOS + el mes de ingreso a almacén", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001",
            subtotal: 100, igv: 18, expectedCost: 118,
            ...ENERO
        })],
        kardex: [
            // "Señuelo": mismo documento que el tránsito (para pasar el
            // filtro de existencia), pero NO es el código adquirido -- no
            // debe sumarse.
            kardexProduct("9999999", "PRODUCTO SEÑUELO", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 1, entryTotalCost: 1, month: 1 })
            ]),
            // Este SÍ es el código adquirido, pero con OTRO documento --
            // bajo la lógica vieja (por documento) NO se hubiera sumado acá;
            // con la nueva (por código), SÍ debe sumarse.
            kardexProduct("0000001", "PRODUCTO A", [
                movement({ operation: "02", document: "OTRO-DOC-DISTINTO", entryQuantity: 10, entryTotalCost: 118, month: 1 })
            ])
        ]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 118, "debe sumar el movimiento encontrado por código, aunque su documento sea distinto");
    assert.equal(findings[0].errorType, "ACCEPTED");
});

test("RULE_012: una factura con VARIOS códigos adquiridos -> se suman los movimientos de TODOS esos códigos, en el mes correspondiente", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001-0000002",
            subtotal: 100, igv: 18, expectedCost: 118,
            ...ENERO
        })],
        kardex: [
            kardexProduct("0000001", "PRODUCTO A", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 70, month: 1 })
            ]),
            kardexProduct("0000002", "PRODUCTO B", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 48, month: 1 })
            ])
        ]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 118);
    assert.equal(findings[0].metadata!.movements, 2);
    assert.equal(findings[0].errorType, "ACCEPTED");
});

test("RULE_012: diferencia grande entre costo esperado y lo encontrado por código -> COST_DIFFERENCE", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001",
            subtotal: 100, igv: 18, expectedCost: 118,
            ...ENERO
        })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 80, month: 1 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "COST_DIFFERENCE");
    assert.equal(findings[0].metadata!.isIncident, true);
});

test("RULE_012: solo cuenta ENTRADAS del código adquirido -- una salida del mismo código/mes no debe sumar", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001",
            subtotal: 100, igv: 18, expectedCost: 118,
            ...ENERO
        })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118, month: 1 }),
            movement({ operation: "01", document: "Fac-F001-501064", exitQuantity: 3, exitTotalCost: 35.4, month: 1 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 118);
});

test("RULE_012: un código adquirido con movimiento en OTRO mes no se suma (solo cuenta el mes de ingreso a almacén)", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001",
            subtotal: 100, igv: 18, expectedCost: 118,
            ...ENERO // mes 1
        })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            // Documento coincide (pasa el filtro), pero este movimiento puntual es de marzo
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118, month: 3 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.kardexCost, 0, "el movimiento de marzo no debe sumarse a una factura de enero");
    assert.equal(findings[0].metadata!.isIncident, true);
});

test("RULE_012 (reproduce el ejemplo real Fac-F001-503371): el Costo Esperado incluye Flete y Otros Costos, no solo Subtotal+IGV", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-503371",
            acquiredCodes: "040751",
            subtotal: 684.17,
            igv: 123.15,
            freight: 30.00,
            otherCosts: 0,
            expectedCost: 807.32, // este campo YA NO se usa -- se deja distinto a proposito
            ...ENERO
        })],
        kardex: [kardexProduct("040751", "MALLA MOSQUITERO", [
            movement({ operation: "02", document: "Fac-F001-503371", entryQuantity: 1, entryTotalCost: 849.42, month: 1 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.expectedCost, 837.32, "el costo esperado debe ser Subtotal+IGV+Flete+Otros, no Subtotal+IGV solo");
    assert.equal(Math.round((findings[0].metadata!.differencePercent as number) * 100) / 100, 1.45);
    assert.equal(findings[0].errorType, "ACCEPTED");
});

test("RULE_012: guarda normalizedDocument y acquiredCodes en metadata (trazabilidad del Excel)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", acquiredCodes: "0000001", subtotal: 100, igv: 18, expectedCost: 118, ...ENERO })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118, month: 1 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].metadata!.normalizedDocument);
    assert.deepEqual(findings[0].metadata!.acquiredCodes, ["1"], "CodeHelper.normalize saca los ceros a la izquierda");
});

test("RULE_012: usa el numero de documento como productCode (una factura puede tener varios productos, no hay un unico codigo)", () => {
    const data = auditData({
        transit: [transitItem({ document: "Fac-F001-501064", acquiredCodes: "0000001-0000002", subtotal: 100, igv: 18, expectedCost: 118, ...ENERO })],
        kardex: [
            kardexProduct("0000001", "PRODUCTO A", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 70, month: 1 })
            ]),
            kardexProduct("0000002", "PRODUCTO B", [
                movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 5, entryTotalCost: 48, month: 1 })
            ])
        ]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].productCode, "Fac-F001-501064");
});

test("RULE_012: guarda el mes en metadata (sacado de la fecha de ingreso a almacen)", () => {
    const data = auditData({
        transit: [transitItem({
            document: "Fac-F001-501064",
            acquiredCodes: "0000001",
            subtotal: 100, igv: 18, expectedCost: 118,
            issueDate: new Date(Date.UTC(2023, 11, 20)),
            warehouseDate: new Date(Date.UTC(2024, 2, 5))
        })],
        kardex: [kardexProduct("0000001", "PRODUCTO", [
            movement({ operation: "02", document: "Fac-F001-501064", entryQuantity: 10, entryTotalCost: 118, month: 3 })
        ])]
    });
    const findings = Rule012.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.month, 3);
});
