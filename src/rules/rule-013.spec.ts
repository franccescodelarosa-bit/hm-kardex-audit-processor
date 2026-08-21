
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule013 } from "./rule-013";
import { auditData, kardexProduct, movement } from "../testing/kardex-fixtures";

/** El ejemplo completo del Anexo 02 - Regla 13, ya validado a mano. */
function anexo02Movimientos() {
    return [
        movement({ operation: "16", document: "00 Saldo Inicial", balanceQuantity: 1000, balanceUnitCost: 10, balanceTotalCost: 10000, month: 1 }),
        movement({ operation: "02", document: "02.01.26", entryQuantity: 500, entryUnitCost: 12, entryTotalCost: 6000, balanceQuantity: 1500, balanceUnitCost: 10.666666666666666, balanceTotalCost: 16000, month: 1 }),
        movement({ operation: "01", document: "08.01.26", exitQuantity: 20, exitUnitCost: 10.67, exitTotalCost: 213.4, balanceQuantity: 1480, balanceUnitCost: 10.666666666666666, balanceTotalCost: 15786.6, month: 1 }),
        movement({ operation: "01", document: "09.01.26", exitQuantity: 100, exitUnitCost: 10.67, exitTotalCost: 1067, balanceQuantity: 1380, balanceUnitCost: 10.666666666666666, balanceTotalCost: 14719.6, month: 1 }),
        movement({ operation: "02", document: "17.01.26", entryQuantity: 1000, entryUnitCost: 12.5, entryTotalCost: 12500, balanceQuantity: 2380, balanceUnitCost: 11.436806722689075, balanceTotalCost: 27219.6, month: 1 })
    ];
}

test("RULE_013 (validado contra el Anexo 02 oficial): un Kardex que sigue la metodología de CPP correctamente -> sin hallazgo", () => {
    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO ANEXO 02", anexo02Movimientos())]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_013 (reproduce un error real): si el Saldo Final del archivo NO coincide con el recalculado vía CPP -> SÍ genera hallazgo, sin ningún perdón de centavos", () => {
    const movimientos = anexo02Movimientos();
    movimientos[4] = { ...movimientos[4], balanceTotalCost: 27269.6 };

    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO CON ERROR", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].description.includes("Saldo Final") || findings[0].description.toLowerCase().includes("saldo"));
});

test("RULE_013: una diferencia de UN SOLO CENTAVO también se reporta -- sin tolerancia, ni siquiera mínima", () => {
    const movimientos = anexo02Movimientos();
    movimientos[4] = { ...movimientos[4], balanceTotalCost: 27219.61 }; // $0.01 de diferencia real
    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO CON UN CENTAVO DE ERROR", movimientos)]
    });
    const findings = Rule013.execute(data);
    assert.equal(findings.length, 1);
});

test("RULE_013 (punto 5 del diagrama oficial): si el Costo Total coincide PERO el Costo Unitario final del archivo no coincide con el CPP recalculado -> SÍ genera hallazgo", () => {
    const movimientos = anexo02Movimientos();
    movimientos[4] = { ...movimientos[4], balanceUnitCost: 12.00 };

    const data = auditData({
        kardex: [kardexProduct("0000010", "PRODUCTO CON COSTO UNITARIO MAL", movimientos)]
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
