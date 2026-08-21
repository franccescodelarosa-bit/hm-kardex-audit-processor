/**
 * Tests de RULE_008, segun el spec real (diagrama con ejemplos AB4/XY1):
 *  - "AB4 no se encuentra en el inventario pero sí en el kardex" (ya existía)
 *  - "XY1 No se encuentra en el kardex pero sí en el inventario" (NUEVO,
 *    la dirección contraria — faltaba)
 *  - Si el producto está en el kardex con cantidad 0 y no está en el
 *    inventario, NO es un error (ya existía)
 *
 * Correr con:
 *   node -r ts-node/register --test src/rules/rule-008.spec.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule008 } from "./rule-008";
import { auditData, inventoryItem, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_008: producto en Inventario Inicial que SÍ está en el Kardex -> sin hallazgo", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1)])]
    });
    const findings = Rule008.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_008 (reproduce el hueco del spec): producto en Inventario Inicial que NO está en el Kardex -> hallazgo", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000099", "PRODUCTO XY1", 5, 1)],
        kardex: []
    });
    const findings = Rule008.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "INVENTORY_CODE_NOT_IN_KARDEX");
    assert.equal(findings[0].metadata?.source, "INVENTARIO_INICIAL");
});

test("RULE_008: producto en Inventario Final que NO está en el Kardex -> hallazgo", () => {
    const data = auditData({
        finalInventory: [inventoryItem("0000000099", "PRODUCTO XY1", 5, 1)],
        kardex: []
    });
    const findings = Rule008.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata?.source, "INVENTARIO_FINAL");
});

test("RULE_008 (regresion): sigue detectando el caso AB4 -- producto en Kardex que no está en ningún inventario", () => {
    const data = auditData({
        kardex: [kardexProduct("0000000005", "PRODUCTO AB4", [saldoInicial(10, 5, 1)])]
    });
    const findings = Rule008.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "MASTER_CODE_NOT_FOUND");
});

test("RULE_008 (regresion): producto en Kardex con saldo 0 y sin inventario -> NO es error", () => {
    const data = auditData({
        kardex: [kardexProduct("0000000005", "PRODUCTO SIN STOCK", [saldoInicial(0, 0, 1)])]
    });
    const findings = Rule008.execute(data);
    assert.equal(findings.length, 0);
});
