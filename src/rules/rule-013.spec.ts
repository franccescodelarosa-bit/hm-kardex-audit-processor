
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule013 } from "./rule-013";
import { auditData, kardexProduct, movement } from "../testing/kardex-fixtures";

/**
 * El ejemplo completo del Anexo 02 - Regla 13. IMPORTANTE: cada fila de ese
 * Excel dice "REVISAR" -- es un ejemplo de un archivo que SÍ tiene error,
 * no uno limpio. La "RESULTADO DE LA VALIDACION" del propio Anexo confirma
 * los valores correctos: CPP final 17.01.2026 = 11.4369747899, Saldo final
 * valorizado = 27220.0 (con precisión completa) -- el archivo, en cambio,
 * quedó en 27219.6 / 11.436806722689075 por redondear a centavos en cada
 * salida en vez de mantener 6+ decimales internos (punto 4 del diagrama).
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

test("RULE_013 (Anexo 02 oficial, releído bien): el archivo del Anexo SÍ tiene error real -- el propio Excel lo marca 'REVISAR' en cada fila, no es un ejemplo limpio", () => {
    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO ANEXO 02", anexo02Movimientos())]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);

    const meta = findings[0].metadata!;
    // Con precisión completa (punto 4), el saldo final correcto es 27220.0,
    // no los 27219.6 que quedaron en el archivo (arrastran el redondeo a
    // centavos de las salidas del 08 y 09.01).
    assert.equal(meta.expectedFinalBalance.totalCost, 27220);
    assert.equal(meta.actualFinalBalance.totalCost, 27219.6);
    // El Costo Unitario NO aparece acá: 11.436974... (correcto) y
    // 11.436806... (archivo) redondean AL MISMO centavo (11.44) -- la
    // "tolerancia de redondeo" del punto 5 hace que esa diferencia puntual
    // no se reporte, aunque el Costo Total sí difiera.
    assert.deepEqual(meta.differences, ["Costo Total de Salidas", "Costo Total de Saldo Final"]);
});

/**
 * Ejemplo sintético SIN decimales escondidos (CPP = 12.00 exacto en cada
 * paso) -- este es el que se usa como base "limpia" para los tests
 * siguientes, así cada uno prueba UN error a la vez sin arrastrar el
 * problema de redondeo del Anexo 02.
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

test("RULE_013 (reproduce un error real): si el Saldo Final del archivo NO coincide con el recalculado vía CPP -> SÍ genera hallazgo, sin ningún perdón de centavos", () => {
    const movimientos = ejemploLimpioMovimientos();
    movimientos[2] = { ...movimientos[2], balanceTotalCost: 1850 };

    const data = auditData({
        kardex: [kardexProduct("0000020", "PRODUCTO CON ERROR", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].description.includes("Saldo Final") || findings[0].description.toLowerCase().includes("saldo"));
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

test("RULE_013 (punto 5 del diagrama oficial): si el Costo Total coincide PERO el Costo Unitario final del archivo no coincide con el CPP recalculado -> SÍ genera hallazgo", () => {
    const movimientos = ejemploLimpioMovimientos();
    movimientos[2] = { ...movimientos[2], balanceUnitCost: 12.50 };

    const data = auditData({
        kardex: [kardexProduct("0000020", "PRODUCTO CON COSTO UNITARIO MAL", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(
        findings[0].description.includes("Costo Unitario"),
        "la descripcion debe mencionar el Costo Unitario, no solo el Costo Total"
    );
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

test("RULE_013: un producto con un solo movimiento (Saldo Inicial) -> sin hallazgo (nada para recalcular)", () => {
    const data = auditData({
        kardex: [kardexProduct("0000099", "PRODUCTO SIN MOVIMIENTOS", [
            movement({ operation: "16", balanceQuantity: 10, balanceUnitCost: 5, balanceTotalCost: 50, month: 1 })
        ])]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 0);
});
