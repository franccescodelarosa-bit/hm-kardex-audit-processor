/**
 * Tests de RULE_003 — la gemela de RULE_002 pero en costos.
 * Descripcion oficial: "Validar continuidad de costos unitarios y costos
 * totales entre meses."
 *
 * Correr con:
 *   node -r ts-node/register --test src/rules/rule-003.spec.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule003 } from "./rule-003";
import { auditData, entrada, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_003: no genera hallazgo cuando hay continuidad correcta de costos entre meses consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // termina mes 1: 15u a $5
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 2)])                            // arranca mes 2: 15u a $5
        ]
    });
    const findings = Rule003.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_003: SÍ genera hallazgo cuando no hay continuidad de costo entre meses consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // termina mes 1 a $5/u
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 8, 2)])                            // arranca mes 2 a $8/u (mal)
        ]
    });
    const findings = Rule003.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "MONTHLY_COST_CONTINUITY_ERROR");
});

test("RULE_003 (reproduce el bug real): falta un mes en el medio -> debe reportar 'no existe en el kardex siguiente', no comparar meses no consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // mes 1
            // mes 2: NO HAY DATOS
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 3)])                            // mes 3
        ]
    });
    const findings = Rule003.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "PRODUCT_NOT_FOUND_NEXT_MONTH");
});

test("RULE_003: un producto que recién aparece en un mes posterior NO es un hallazgo", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000002", "PRODUCTO NUEVO", [saldoInicial(10, 5, 2)])
        ]
    });
    const findings = Rule003.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_003 (spec de Frank, igual que RULE_002): ante duplicados en el MISMO mes del Kardex, se queda con el ÚLTIMO encontrado", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A (primero, debe descartarse)", [
                saldoInicial(999, 99, 1),
                entrada(1, 99, 1000, 99, 1) // si se usara este bloque, mes 1 terminaria a $99/u
            ]),
            kardexProduct("0000000001", "PRODUCTO A (ultimo, el que vale)", [
                saldoInicial(10, 5, 1),
                entrada(5, 5, 15, 5, 1) // este bloque termina el mes 1 a $5/u
            ]),
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 2)]) // mes 2 arranca a $5/u
        ]
    });
    const findings = Rule003.execute(data);
    assert.equal(findings.length, 0);
});
