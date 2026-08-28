
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
