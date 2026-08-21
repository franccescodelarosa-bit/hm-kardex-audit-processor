
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule006 } from "./rule-006";
import { auditData, inventoryItem, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_006: no genera hallazgo si no hay duplicados en el Kardex ni en los inventarios", () => {
    const data = auditData({
        initialInventory: [inventoryItem("0000000001", "PRODUCTO A", 10, 5)],
        kardex: [kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1)])]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_006 (reproduce el caso del spec): el mismo codigo aparece DOS VECES en el MISMO mes del Kardex", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1)]),
            kardexProduct("0000000001", "PRODUCTO A (duplicado)", [saldoInicial(10, 5, 1)])
        ]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "DUPLICATE_PRODUCT");
    assert.equal(findings[0].metadata?.source, "KARDEX");
});

test("RULE_006: el mismo codigo en MESES DISTINTOS del Kardex NO es un duplicado (es normal)", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1)]), // mes 1
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(12, 5, 2)])  // mes 2
        ]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_006 (regresion): el chequeo de duplicados en Inventario sigue funcionando igual que antes", () => {
    const data = auditData({
        initialInventory: [
            inventoryItem("0000000001", "PRODUCTO A", 10, 5),
            inventoryItem("0000000001", "PRODUCTO A (duplicado)", 10, 5)
        ]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].metadata?.source, "INVENTARIO_INICIAL");
});
