
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule006 } from "./rule-006";
import { auditData, inventoryItem, kardexProduct, movement, saldoInicial } from "../testing/kardex-fixtures";

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

test("RULE_006 (trazabilidad, Opción A): duplicado en Kardex ahora identifica cada ocurrencia por fecha/documento/cantidad de movimientos, ya no manda 'rows: []' vacío", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [
                movement({ date: new Date(2024, 0, 1), document: "00 Saldo Inicial", operation: "16", balanceQuantity: 10, balanceUnitCost: 5, balanceTotalCost: 50, month: 1 })
            ]),
            kardexProduct("0000000001", "PRODUCTO A (duplicado)", [
                movement({ date: new Date(2024, 0, 1), document: "00 Saldo Inicial", operation: "16", balanceQuantity: 10, balanceUnitCost: 5, balanceTotalCost: 50, month: 1 }),
                movement({ date: new Date(2024, 0, 5), document: "01 F001-00011022", operation: "01", exitQuantity: 2, month: 1 })
            ])
        ]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 1);

    const occurrences = findings[0].metadata?.duplicateOccurrences;
    assert.equal(occurrences.length, 2);
    assert.equal(occurrences[0].document, "00 Saldo Inicial");
    assert.equal(occurrences[0].movementCount, 1);
    assert.equal(occurrences[1].movementCount, 2);
    // "rows" (numérico, sin sentido para Kardex) ya no se manda mas
    assert.equal(findings[0].metadata?.rows, undefined);
});

test("RULE_006: el chequeo de duplicados en Inventario sigue mandando 'rows' con el numero de item (no se toco esa ruta)", () => {
    const data = auditData({
        finalInventory: [
            inventoryItem("0000000002", "PRODUCTO B", 10, 5),
            inventoryItem("0000000002", "PRODUCTO B (duplicado)", 10, 5)
        ]
    });
    const findings = Rule006.execute(data);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].metadata?.rows, [1, 1]);
});
