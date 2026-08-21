/**
 * Tests de RULE_001, basados en el spec real:
 *  - Comparar Inventario Inicial vs el SALDO INICIAL del Kardex
 *    (TipoOp = 16, primera línea) — NO contra el último movimiento del año.
 *  - Ante productos duplicados en el Kardex, quedarse con el PRIMERO.
 *
 * Correr con:
 *   node -r ts-node/register --test src/rules/rule-001.spec.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule001 } from "./rule-001";
import { auditData, entrada, inventoryItem, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_001: no genera hallazgo si el inventario inicial coincide con el Saldo Inicial del Kardex (TipoOp 16)", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5)])]
    });
    const findings = Rule001.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_001: SÍ genera hallazgo cuando el inventario inicial NO coincide con el Saldo Inicial del Kardex", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5)])]
    });
    const findings = Rule001.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "INVENTORY_MISMATCH");
});

test("RULE_001 (reproduce el bug real): stock inicial correcto + movimientos durante el año NO debe dar falso positivo", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [
            saldoInicial(10, 5),
            entrada(20, 5, 30, 5)
        ])]
    });
    const findings = Rule001.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_001: ante productos duplicados en el Kardex, se queda con el PRIMERO encontrado", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A (primero)", [saldoInicial(10, 5)]),
            kardexProduct("0000000001", "PRODUCTO A (duplicado)", [saldoInicial(10, 5), entrada(5, 5, 15, 5)])
        ]
    });
    const findings = Rule001.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_001: producto del inventario que no existe en el Kardex genera PRODUCT_NOT_FOUND", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000099", "PRODUCTO FANTASMA", 5, 1)],
        kardex: []
    });
    const findings = Rule001.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "PRODUCT_NOT_FOUND");
});
