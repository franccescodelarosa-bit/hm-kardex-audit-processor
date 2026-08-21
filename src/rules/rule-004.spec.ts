
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule004 } from "./rule-004";
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

test("RULE_004: si el documento SÍ existe en el Kardex, no genera hallazgo (eso lo cubre RULE_012)", () => {
    const data = auditData({
        year: 2024,
        transit: [transitItem({
            document: "Fac-F001-1234",
            warehouseDate: new Date(2024, 0, 15),
            expectedCost: 500
        })],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [
            movement({ document: "Fac-F001-1234", entryQuantity: 10, entryTotalCost: 500, month: 1 })
        ])]
    });
    const findings = Rule004.execute(data);
    assert.equal(findings.length, 0);
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
