/**
 * Tests de RULE_002, segun el spec real
 * oficial: "Validar que el saldo final en cantidades de un periodo
 * coincida con el saldo inicial en cantidades del siguiente periodo, y
 * asi sucesivamente de todo el ejercicio."
 *
 * Dos bugs cubiertos:
 *  1. Faltaba el hallazgo "el producto no existe en el kardex siguiente".
 *  2. Si a un producto le faltaba UN mes en el medio (ej: tiene datos en
 *     enero y marzo pero no en febrero), el codigo viejo comparaba enero
 *     directo contra marzo como si fueran consecutivos, en vez de
 *     detectar el hueco de febrero.
 *
 * Correr con:
 *   node -r ts-node/register --test src/rules/rule-002.spec.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule002 } from "./rule-002";
import { auditData, entrada, kardexProduct, saldoInicial } from "../testing/kardex-fixtures";

test("RULE_002: no genera hallazgo cuando hay continuidad correcta entre dos meses consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // termina mes 1 en 15
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 2)])                            // arranca mes 2 en 15
        ]
    });
    const findings = Rule002.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_002: SÍ genera hallazgo cuando no hay continuidad de cantidad entre meses consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // termina mes 1 en 15
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(20, 5, 2)])                            // arranca mes 2 en 20 (mal)
        ]
    });
    const findings = Rule002.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "MONTHLY_CONTINUITY_ERROR");
});

test("RULE_002 (reproduce el bug real): falta un mes en el medio -> debe reportar 'no existe en el kardex siguiente', no comparar meses no consecutivos", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(10, 5, 1), entrada(5, 5, 15, 5, 1)]), // mes 1, termina en 15
            // mes 2: NO HAY DATOS (falta el archivo / no se cargó)
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 3)])                            // mes 3, arranca en 15
        ]
    });
    const findings = Rule002.execute(data);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].errorType, "PRODUCT_NOT_FOUND_NEXT_MONTH");
    assert.equal(findings[0].metadata?.toMonth, 2);
});

test("RULE_002: un producto que recién aparece en un mes posterior NO es un hallazgo (no existía antes)", () => {
    const data = auditData({
        kardex: [
            kardexProduct("0000000002", "PRODUCTO NUEVO", [saldoInicial(10, 5, 2)]) // solo existe desde el mes 2
        ]
    });
    const findings = Rule002.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_002 (spec de Frank): ante productos duplicados en el MISMO mes del Kardex, se queda con el ÚLTIMO encontrado (al revés que RULE_001)", () => {
    const data = auditData({
        kardex: [
            // Dos bloques del MISMO código en el MISMO mes 1 -> duplicado.
            kardexProduct("0000000001", "PRODUCTO A (primero, debe descartarse)", [
                saldoInicial(999, 5, 1),
                entrada(1, 5, 1000, 5, 1) // si se usara este bloque, mes 1 terminaria en 1000
            ]),
            kardexProduct("0000000001", "PRODUCTO A (ultimo, el que vale)", [
                saldoInicial(10, 5, 1),
                entrada(5, 5, 15, 5, 1) // este bloque termina el mes 1 en 15
            ]),
            kardexProduct("0000000001", "PRODUCTO A", [saldoInicial(15, 5, 2)]) // mes 2 arranca en 15
        ]
    });
    const findings = Rule002.execute(data);
    assert.equal(findings.length, 0);
});
