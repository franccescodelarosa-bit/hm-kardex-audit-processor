
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule011 } from "./rule-011";
import { auditData, entrada, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_011: variación de costo dentro del 25% entre meses consecutivos -> sin hallazgo", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 100, 1), entrada(5, 100, 15, 100, 1)]), // termina mes 1 a $100
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 110, 2)])                                // arranca mes 2 a $110 (+10%)
        ]
    });
    const findings = Rule011.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_011: variación de costo por encima del 25% entre meses consecutivos -> SÍ genera hallazgo", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 100, 1), entrada(5, 100, 15, 100, 1)]), // termina mes 1 a $100
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 140, 2)])                                // arranca mes 2 a $140 (+40%)
        ]
    });
    const findings = Rule011.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "UNUSUAL_UNIT_COST_VARIATION");
});

test("RULE_011 (reproduce el bug real): una variación grande DENTRO del mismo mes ya NO se compara movimiento a movimiento", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [
                saldoInicial(10, 100, 1),
                entrada(1, 500, 11, 500, 1), // salto grande dentro del mes (ya no debe importar)
                entrada(1, 100, 12, 100, 1)  // vuelve a 100 (última fila del mes 1)
            ]),
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(100, 100, 2)]) // mes 2 arranca igual a como cerró el mes 1
        ]
    });
    const findings = Rule011.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_011: producto con datos de un solo mes -> sin hallazgo (nada para comparar)", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000002", "PRODUCTO NUEVO", [saldoInicial(10, 100, 1), entrada(5, 100, 15, 100, 1)])
        ]
    });
    const findings = Rule011.execute(data);
    assert.equal(findings.length, 0);
});
