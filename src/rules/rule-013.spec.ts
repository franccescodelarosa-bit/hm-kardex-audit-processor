
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule013 } from "./rule-013";
import { auditData, kardexProduct, movement } from "../testing/kardex-fixtures";

/**
 * El ejemplo completo del Anexo 02 - Regla 13. IMPORTANTE: cada fila de ese
 * Excel dice "REVISAR" -- es un ejemplo de un archivo que SÍ tiene error,
 * no uno limpio. Con el motor re-anclado al archivo (confirmado con el
 * cliente, caso real 000129, fórmula por fórmula): el CPP de la ÚLTIMA
 * entrada (17.01.26) se calcula usando el saldo que el archivo REALMENTE
 * tenía en la fila de arriba (14719.6, la salida del 09.01, ya con su
 * propio redondeo) -- eso reproduce EXACTO el 11.436806722689075 / 27219.6
 * que el archivo ya tenía, así que "Costo Unitario/Total de Saldo Final"
 * NO fallan acá. El error del Anexo 02 (redondeo acumulado en las
 * salidas) sigue detectándose, pero vía "Costo Total de Salidas": 20+100
 * unidades costeadas con el CPP vigente en cada salida dan 1279.99...,
 * no los 1280.40 que el archivo suma como total.
 */
function anexo02Movimientos() {
    return [
        movement({ operation: "16", document: "00 Saldo Inicial", balanceQuantity: 1000, balanceUnitCost: 10, balanceTotalCost: 10000, month: 1 }),
        movement({ operation: "02", document: "02.01.26", entryQuantity: 500, entryUnitCost: 12, entryTotalCost: 6000, balanceQuantity: 1500, balanceUnitCost: 10.666666666666666, balanceTotalCost: 16000, month: 1 }),
        movement({ operation: "01", document: "08.01.26", exitQuantity: 20, exitUnitCost: 10.67, exitTotalCost: 213.4, balanceQuantity: 1480, balanceUnitCost: 10.666666666666666, balanceTotalCost: 15786.6, month: 1 }),
        movement({ operation: "01", document: "09.01.26", exitQuantity: 100, exitUnitCost: 10.67, exitTotalCost: 1067, balanceQuantity: 1380, balanceUnitCost: 10.666666666666666, balanceTotalCost: 14719.6, month: 1 }),
        movement({ operation: "02", document: "17.01.26", entryQuantity: 1000, entryUnitCost: 12.5, entryTotalCost: 12500, balanceQuantity: 2380, balanceUnitCost: 11.436806722689075, balanceTotalCost: 27219.6, month: 1 })
    ];
}

test("RULE_013 (Anexo 02 oficial, con el motor re-anclado): las 2 entradas reproducen exacto lo que el archivo ya tenía -- Costo Unitario/Total de Saldo Final NO fallan, pero 'Costo Total de Salidas' SÍ detecta el redondeo acumulado del Anexo", () => {
    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO ANEXO 02", anexo02Movimientos())]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].metadata!.differences, ["Costo Total de Salidas"]);

    const meta = findings[0].metadata!;
    assert.equal(meta.totals.exit.totalCostArchivo, 1280.4);
    assert.notEqual(meta.totals.exit.totalCost, 1280.4);
    assert.equal(meta.unitCostMismatches.length, 0);
    // El CPP final re-anclado coincide EXACTO con el del archivo.
    assert.equal(meta.expectedFinalBalance.totalCost, 27219.6);
    assert.equal(meta.actualFinalBalance.totalCost, 27219.6);
});

/**
 * Ejemplo sintético SIN decimales escondidos (CPP = 12.00 exacto en cada
 * paso) -- este es el que se usa como base "limpia" para los tests
 * siguientes, así cada uno prueba UN error a la vez.
 */
function ejemploLimpioMovimientos() {
    return [
        movement({ operation: "16", document: "00 Saldo Inicial", balanceQuantity: 100, balanceUnitCost: 10, balanceTotalCost: 1000, month: 1 }),
        movement({ operation: "02", document: "Compra 1", entryQuantity: 100, entryUnitCost: 14, entryTotalCost: 1400, balanceQuantity: 200, balanceUnitCost: 12, balanceTotalCost: 2400, month: 1 }),
        movement({ operation: "01", document: "Venta 1", exitQuantity: 50, exitUnitCost: 12, exitTotalCost: 600, balanceQuantity: 150, balanceUnitCost: 12, balanceTotalCost: 1800, month: 1 })
    ];
}

test("RULE_013: un Kardex limpio (CPP sin decimales escondidos, metodología correcta) -> sin hallazgo", () => {
    const data = auditData({
        kardex: [kardexProduct("0000020", "PRODUCTO LIMPIO", ejemploLimpioMovimientos())]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_013 (reproduce un error real): si el Saldo Final del archivo (última fila del mes) NO coincide con el CPP re-anclado -> SÍ genera hallazgo, sin ningún perdón de centavos", () => {
    const movimientos = ejemploLimpioMovimientos();
    movimientos[2] = { ...movimientos[2], balanceTotalCost: 1850 };

    const data = auditData({
        kardex: [kardexProduct("0000020", "PRODUCTO CON ERROR", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].description.toLowerCase().includes("saldo"));
    assert.ok(findings[0].metadata!.differences.includes("Costo Total de Saldo Final"));
    assert.equal(findings[0].metadata!.unitCostMismatches.length, 0, "la entrada en sí estaba bien, el error está en la última fila (salida)");
});

test("RULE_013: una diferencia de UN SOLO CENTAVO también se reporta -- sin tolerancia, ni siquiera mínima", () => {
    const movimientos = ejemploLimpioMovimientos();
    movimientos[2] = { ...movimientos[2], balanceTotalCost: 1800.01 }; // $0.01 de diferencia real
    const data = auditData({
        kardex: [kardexProduct("0000020", "PRODUCTO CON UN CENTAVO DE ERROR", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
});


test("RULE_013 (Costo Unitario de Saldo Final, por entrada): una entrada con Costo Total distinto al que da la fórmula re-anclada se marca individualmente -- y no arrastra error a la siguiente entrada ni al cierre", () => {
    const data = auditData({
        kardex: [kardexProduct("0000050", "PRODUCTO CON UNA ENTRADA MAL", [
            movement({ operation: "16", document: "00 Saldo Inicial", balanceQuantity: 100, balanceUnitCost: 10, balanceTotalCost: 1000, month: 1 }),
            movement({ operation: "02", document: "Compra 1", entryQuantity: 100, entryUnitCost: 14, entryTotalCost: 1400, balanceQuantity: 200, balanceUnitCost: 12.25, balanceTotalCost: 2450, month: 1 }),
            movement({ operation: "02", document: "Compra 2", entryQuantity: 1000, entryUnitCost: 2.45, entryTotalCost: 1000, balanceQuantity: 250, balanceUnitCost: 13.8, balanceTotalCost: 3450, month: 1 })
        ])]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.deepEqual(findings[0].metadata!.differences, ["Costo Unitario de Saldo Final"]);

    const mismatches = findings[0].metadata!.unitCostMismatches;
    assert.equal(mismatches.length, 1, "solo la primera entrada tiene mismatch -- la segunda se re-ancló bien");
    assert.equal(mismatches[0].document, "Compra 1");
    assert.equal(mismatches[0].quantity, 200);
    assert.equal(mismatches[0].expectedTotalCost, 2450); // lo que puso el archivo en esa fila
    assert.equal(mismatches[0].foundTotalCost, 2400);    // lo que da la fórmula re-anclada
});

test("RULE_013 (reproduce el caso real masivo): si la cantidad final es CERO, NO se valida el Costo Unitario -- 0 x cualquier costo da 0, es matematicamente indeterminado", () => {
    const data = auditData({
        kardex: [kardexProduct("011282", "PRODUCTO EN CERO", [
            movement({ operation: "16", balanceQuantity: 0, balanceUnitCost: 0, balanceTotalCost: 0, month: 12 }),
            movement({ operation: "28", balanceQuantity: 0, balanceUnitCost: 6.11, balanceTotalCost: 0, month: 12 })
        ])]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 0, "cantidad 0 hace que Costo Unitario sea indeterminado -- no debe generar hallazgo por esto");
});

test("RULE_013 (caso real 000129, confirmado con el cliente): Costo Unitario de Saldo Final se valida por cada entrada, Costo Total de Saldo Final se valida una vez al cierre real del mes", () => {
    const movimientos = [
        movement({ operation: "16", document: "00 Saldo Inicial", balanceQuantity: 0, balanceUnitCost: 0, balanceTotalCost: 0, month: 1 }),
        movement({ operation: "02", document: "F001-00004970", entryQuantity: 60, entryUnitCost: 5.78, entryTotalCost: 346.80, balanceQuantity: 60, balanceUnitCost: 5.97, balanceTotalCost: 358.20, month: 1 }),
        movement({ operation: "02", document: "F001-00004994", entryQuantity: 60, entryUnitCost: 5.90, entryTotalCost: 354.00, balanceQuantity: 120, balanceUnitCost: 5.94, balanceTotalCost: 712.80, month: 1 }),
        movement({ operation: "01", document: "Venta 1", exitQuantity: 25, exitUnitCost: 5.94, exitTotalCost: 148.50, balanceQuantity: 95, balanceUnitCost: 5.94, balanceTotalCost: 564.30, month: 1 })
    ];

    const data = auditData({
        kardex: [kardexProduct("000129", "AGUJA PLATEADA E/DISCO 24-1 ROSADA M/NEEDLES", movimientos)]
    });
    const findings = Rule013.execute(data);

    assert.equal(findings.length, 1, "un solo hallazgo por producto/mes, aunque haya varias entradas con error");

    const meta = findings[0].metadata!;
    assert.deepEqual(meta.differences, ["Costo Unitario de Saldo Final", "Costo Total de Saldo Final"]);
    assert.ok(!meta.differences.includes("Costo Total de Salidas"), "las salidas coincidieron exacto (222.42 en el caso real completo)");

    // Costo Unitario de Saldo Final: UNA entrada en la lista por cada
    // fila que no coincide -- acá las DOS entradas del mes fallan.
    assert.equal(meta.unitCostMismatches.length, 2);

    assert.equal(meta.unitCostMismatches[0].document, "F001-00004970");
    assert.equal(meta.unitCostMismatches[0].quantity, 60);
    assert.equal(meta.unitCostMismatches[0].expectedTotalCost, 358.20); // archivo
    assert.equal(meta.unitCostMismatches[0].foundTotalCost, 346.80);    // fórmula re-anclada

    assert.equal(meta.unitCostMismatches[1].document, "F001-00004994");
    assert.equal(meta.unitCostMismatches[1].quantity, 120);
    assert.equal(meta.unitCostMismatches[1].expectedTotalCost, 712.80); // archivo
    assert.equal(meta.unitCostMismatches[1].foundTotalCost, 712.20);    // fórmula re-anclada

    assert.equal(meta.expectedFinalBalance.quantity, 95);
    assert.equal(meta.expectedFinalBalance.unitCost, 5.935);
    assert.equal(meta.expectedFinalBalance.totalCost, 563.825);
    assert.equal(meta.actualFinalBalance.unitCost, 5.94);
    assert.equal(meta.actualFinalBalance.totalCost, 564.30);
});

test("RULE_013: un producto con un solo movimiento (Saldo Inicial) -> sin hallazgo (nada para recalcular)", () => {
    const data = auditData({
        kardex: [kardexProduct("0000099", "PRODUCTO SIN MOVIMIENTOS", [
            movement({ operation: "16", balanceQuantity: 10, balanceUnitCost: 5, balanceTotalCost: 50, month: 1 })
        ])]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 0);
});
