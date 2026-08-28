
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule005 } from "./rule-005";
import { auditData, kardexProduct, movement } from "../testing/kardex-fixtures";

test("RULE_005: costo unitario negativo en el Saldo se etiqueta 'Costo Unitario de Saldo' (no 'Costo Saldo', ambiguo)", () => {
    const data = auditData({
        kardex: [
            kardexProduct("006749", "PEGAMENTO", [
                movement({ operation: "16", balanceQuantity: 10, balanceUnitCost: -4.06, balanceTotalCost: -40.6 })
            ])
        ]
    });
    const findings = Rule005.execute(data);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].metadata!.negatives, ["Costo Unitario de Saldo", "Costo Total de Saldo"]);
});

test("RULE_005: costo total negativo en Entrada se etiqueta 'Costo Total de Entrada'", () => {
    const data = auditData({
        kardex: [
            kardexProduct("006750", "OTRO PRODUCTO", [
                movement({ operation: "02", entryQuantity: 5, entryUnitCost: 2, entryTotalCost: -10 })
            ])
        ]
    });
    const findings = Rule005.execute(data);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].metadata!.negatives, ["Costo Total de Entrada"]);
});

test("RULE_005: cantidad negativa en Salida se etiqueta 'Cantidad de Salida'", () => {
    const data = auditData({
        kardex: [
            kardexProduct("006751", "PRODUCTO SALIDA", [
                movement({ operation: "01", exitQuantity: -3, exitUnitCost: 5, exitTotalCost: -15 })
            ])
        ]
    });
    const findings = Rule005.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].metadata!.negatives.includes("Cantidad de Salida"));
});

test("RULE_005: sin valores negativos, no genera hallazgo", () => {
    const data = auditData({
        kardex: [
            kardexProduct("006752", "PRODUCTO SANO", [
                movement({ operation: "16", balanceQuantity: 10, balanceUnitCost: 4, balanceTotalCost: 40 })
            ])
        ]
    });
    const findings = Rule005.execute(data);
    assert.equal(findings.length, 0);
});
