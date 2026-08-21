/**
 * Correr con:
 *   node -r ts-node/register --test src/helpers/excel-cell.helper.spec.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ExcelCellHelper } from "./excel-cell.helper";

test("ExcelCellHelper.toNumber: devuelve el numero tal cual si la celda es un numero plano", () => {
    assert.equal(ExcelCellHelper.toNumber(1268.46), 1268.46);
});

test("ExcelCellHelper.toNumber: devuelve 0 si la celda esta vacia (null/undefined/string vacio)", () => {
    assert.equal(ExcelCellHelper.toNumber(null), 0);
    assert.equal(ExcelCellHelper.toNumber(undefined), 0);
    assert.equal(ExcelCellHelper.toNumber(""), 0);
});

test("ExcelCellHelper.toNumber (reproduce el bug real): celda con formula debe devolver el resultado calculado, no NaN", () => {
    // Esto es EXACTAMENTE lo que ExcelJS devuelve para una celda "=F5*G5"
    // en vez de un numero plano.
    const celdaConFormula = { formula: "F5*G5", result: 1268.46 };
    const resultado = ExcelCellHelper.toNumber(celdaConFormula);
    assert.equal(resultado, 1268.46);
    assert.equal(Number.isNaN(resultado), false);
});

test("ExcelCellHelper.toNumber: si el valor no es numerico, devuelve 0 en vez de NaN", () => {
    assert.equal(ExcelCellHelper.toNumber("no es un numero"), 0);
});
