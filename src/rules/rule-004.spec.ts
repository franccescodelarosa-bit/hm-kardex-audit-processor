
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule004 } from "./rule-004";
import { Rule012 } from "./rule-012";
import { auditData, entrada, kardexProduct, movement, transitItem } from "../testing/kardex-fixtures";

test("RULE_004 (reproduce el bug real): factura con ingreso al almacén en un AÑO DISTINTO al auditado no genera hallazgo", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-9999",
            warehouseDate: new Date(2025, 0, 15), // enero 2025 - fuera del ejercicio 2024
            acquiredCodes: "0000000001",
            expectedCost: 500
        })],
        kardex: [] // el documento no existe en ningun lado
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_004: factura no encontrada, con ingreso al almacén DENTRO del año auditado, SÍ genera hallazgo (comportamiento normal preservado)", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-9999",
            warehouseDate: new Date(2024, 0, 15), // enero 2024 - dentro del ejercicio
            acquiredCodes: "0000000001",
            expectedCost: 500
        })],
        kardex: []
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "TRANSIT_NOT_FOUND");
});

test("RULE_004 (confirmado con la usuaria): si el documento SÍ existe en el Kardex, AHORA TAMBIÉN valida costo -- busca por códigos adquiridos + mes, tolerancia 5%, igual mecanismo que RULE_012", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-1234",
            acquiredCodes: "0000000001",
            warehouseDate: new Date(Date.UTC(2024, 0, 15)),
            expectedCost: 500
        })],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [
            movement({ document: "Fac-F001-1234", entryQuantity: 10, entryTotalCost: 500, month: 1 })
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.foundCost, 500);
    assert.equal(findings[0].errorType, "ACCEPTED");
});

test("RULE_004: costo encontrado fuera del 5% de tolerancia -> TRANSIT_COST_MISMATCH", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-1234",
            acquiredCodes: "0000000001",
            warehouseDate: new Date(Date.UTC(2024, 0, 15)),
            expectedCost: 500
        })],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [
            movement({ document: "Fac-F001-1234", entryQuantity: 10, entryTotalCost: 300, month: 1 })
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "TRANSIT_COST_MISMATCH");
    assert.equal(findings[0].metadata!.isIncident, true);
});

test("RULE_004 vs RULE_012 (misma factura, con Flete): buscan el mismo costo en el Kardex, pero comparan contra un 'esperado' DISTINTO -- pueden dar resultados diferentes", () => {
    const facturaConFlete = {
        document: "Fac-F001-503371",
        acquiredCodes: "040751",
        warehouseDate: new Date(Date.UTC(2024, 0, 15)),
        subtotal: 684.17,
        igv: 123.15,
        freight: 30.00,
        otherCosts: 0,
        expectedCost: 807.32 // esto es lo que RULE_004 usa (Subtotal+IGV de la columna del cliente)
    };
    const kardex = [kardexProduct("040751", "MALLA MOSQUITERO", [
        movement({ document: "Fac-F001-503371", entryQuantity: 1, entryTotalCost: 849.42, month: 1 })
    ])];

    const dataRule004 = auditData({ year: 2024, transit: [transitItem(facturaConFlete)], kardex });
    const dataRule012 = auditData({ year: 2024, transit: [transitItem(facturaConFlete)], kardex });

    const finding004 = Rule004.execute(dataRule004)[0];
    const finding012 = Rule012.execute(dataRule012)[0];

    // El costo ENCONTRADO en el Kardex es el mismo en las dos (buscan igual)
    assert.equal(finding004.metadata!.foundCost, finding012.metadata!.kardexCost);

    // Pero el costo ESPERADO es distinto: RULE_004 usa 807.32 (Subtotal+IGV
    // tal cual la columna del cliente), RULE_012 usa 837.32 (Subtotal+IGV+
    // Flete+Otros) -- por eso el resultado final puede diferir.
    assert.equal(finding004.metadata!.expectedCost, 807.32);
    assert.equal(finding012.metadata!.expectedCost, 837.32);
    assert.notEqual(finding004.metadata!.expectedCost, finding012.metadata!.expectedCost);
});

test("RULE_004 (confirmado con la usuaria, apuntes del cliente: busca por CÓDIGO y por FACTURA): si acquiredCodes no encuentra nada, cae a buscar el costo por número de documento", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-E001-1007",
            acquiredCodes: "", // vacía -- así viene el 99.6% de las facturas reales
            warehouseDate: new Date(Date.UTC(2024, 0, 13)),
            expectedCost: 650
        })],
        kardex: [kardexProduct("000123", "PRODUCTO REAL", [
            movement({ document: "Fac-E001-1007", entryQuantity: 5, entryTotalCost: 650, month: 1 })
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.foundCost, 650); // ya NO es 0 -- lo encontró por documento
    assert.equal(findings[0].errorType, "ACCEPTED");
    assert.equal(findings[0].metadata!.usedFallback, true);
    assert.equal(findings[0].metadata!.evaluatedProducts.length, 1);
    assert.equal(findings[0].metadata!.evaluatedProducts[0].code, "000123");
});

test("RULE_004 (fallback por documento): también filtra por mes -- si el movimiento matcheado por documento está en OTRO mes, no cuenta", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-E001-2000",
            acquiredCodes: "",
            warehouseDate: new Date(Date.UTC(2024, 0, 10)), // enero -> mes 1
            expectedCost: 300
        })],
        kardex: [kardexProduct("000999", "PRODUCTO B", [
            movement({ document: "Fac-E001-2000", entryQuantity: 2, entryTotalCost: 300, month: 3 }) // marzo, no enero
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.foundCost, 0);
    assert.equal(findings[0].metadata!.noEvaluable, true);
});

test("RULE_004 (sin datos para evaluar): si NI por código NI por documento (con su fallback, filtrado por mes) se encuentra costo, queda noEvaluable=true -- NO es TRANSIT_COST_MISMATCH", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-E001-9000",
            acquiredCodes: "",
            warehouseDate: new Date(Date.UTC(2024, 0, 5)),
            expectedCost: 500
        })],
        kardex: [kardexProduct("000111", "PRODUCTO C", [
            // el documento SÍ aparece (documentMatches > 0) pero en otro mes
            movement({ document: "Fac-E001-9000", entryQuantity: 1, entryTotalCost: 500, month: 5 })
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata!.noEvaluable, true);
    assert.equal(findings[0].errorType, "TRANSIT_COST_NOT_EVALUABLE");
    assert.notEqual(findings[0].errorType, "TRANSIT_COST_MISMATCH");
});

test("RULE_004 (prioridad): si acquiredCodes SÍ encuentra algo, usa eso -- no hace falta caer al fallback por documento", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-7000",
            acquiredCodes: "000500",
            warehouseDate: new Date(Date.UTC(2024, 0, 8)),
            expectedCost: 200
        })],
        kardex: [
            kardexProduct("000500", "PRODUCTO POR CODIGO", [
                movement({ document: "OTRO-DOC-999", entryQuantity: 1, entryTotalCost: 200, month: 1 })
            ]),
            kardexProduct("000777", "PRODUCTO POR DOCUMENTO (senuelo)", [
                movement({ document: "Fac-F001-7000", entryQuantity: 1, entryTotalCost: 999, month: 1 })
            ])
        ]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
    // Encuentra por CODIGO (200), no por documento (999) -- el codigo tiene prioridad
    assert.equal(findings[0].metadata!.foundCost, 200);
    assert.equal(findings[0].metadata!.usedFallback, false);
});

test("RULE_004: sin año de auditoría disponible (dato viejo), sigue funcionando como antes (compatibilidad)", () => {
    const data = auditData({
        year: undefined,
        transit: [transitItem({
            document: "Fac-F001-9999",
            warehouseDate: new Date(2024, 0, 15),
            acquiredCodes: "0000000001",
            expectedCost: 500
        })],
        kardex: []
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 1);
});
