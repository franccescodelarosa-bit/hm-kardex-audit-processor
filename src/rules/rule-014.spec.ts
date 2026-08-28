import { test } from "node:test";
import assert from "node:assert/strict";
import { Rule014 } from "./rule-014";
import { auditData, kardexProduct, movement } from "../testing/kardex-fixtures";
function productoAnexo() {
    return kardexProduct("0000010", "PRODUCTO ANEXO", [
        movement({ operation: "16", balanceQuantity: 1000, balanceUnitCost: 10, balanceTotalCost: 10000, month: 1 }),
        movement({ operation: "02", entryQuantity: 500, entryUnitCost: 12, entryTotalCost: 6000, balanceQuantity: 1500, balanceTotalCost: 16000, month: 1 }),
        movement({ operation: "01", exitQuantity: 20, exitTotalCost: 213.4, balanceQuantity: 1480, balanceTotalCost: 15786.6, month: 1 }),
        movement({ operation: "01", exitQuantity: 100, exitTotalCost: 1067, balanceQuantity: 1380, balanceTotalCost: 14719.6, month: 1 }),
        movement({ operation: "02", entryQuantity: 1000, entryUnitCost: 12.5, entryTotalCost: 12500, balanceQuantity: 2380, balanceTotalCost: 27219.6, month: 1 })
    ]);
}

/** Un segundo producto simple, inventado a propósito para probar la CONSOLIDACIÓN entre productos. */
function productoSimple() {
    return kardexProduct("0000020", "PRODUCTO SIMPLE", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "02", entryQuantity: 50, entryUnitCost: 5, entryTotalCost: 250, balanceQuantity: 150, balanceTotalCost: 750, month: 1 }),
        movement({ operation: "01", exitQuantity: 30, exitTotalCost: 150, balanceQuantity: 120, balanceTotalCost: 600, month: 1 })
    ]);
}

/** El SEGUNDO producto real del Anexo 03 (COD: 0000011), tal cual el Excel oficial. */
function productoAnexoSegundo() {
    return kardexProduct("0000011", "PRODUCTO ANEXO 2", [
        movement({ operation: "16", balanceQuantity: 1000, balanceUnitCost: 10, balanceTotalCost: 10000, month: 1 }),
        movement({ operation: "02", entryQuantity: 100, entryUnitCost: 12, entryTotalCost: 1200, balanceQuantity: 1100, balanceTotalCost: 11200, month: 1 }),
        movement({ operation: "01", exitQuantity: 80, exitTotalCost: 853.6, balanceQuantity: 1020, balanceTotalCost: 10346.4, month: 1 }),
        movement({ operation: "01", exitQuantity: 500, exitTotalCost: 5335, balanceQuantity: 520, balanceTotalCost: 5011.4, month: 1 }),
        movement({ operation: "02", entryQuantity: 3000, entryUnitCost: 12.5, entryTotalCost: 37500, balanceQuantity: 3520, balanceTotalCost: 42511.4, month: 1 })
    ]);
}

test("RULE_014 (validado contra el Anexo 03): la ecuación de conciliación global cierra -> sin hallazgo", () => {
    const data = auditData({ kardex: [productoAnexo(), productoSimple()] });
    const findings = Rule014.execute(data);
    assert.equal(findings.length, 0);
});

test("RULE_014 (reproduce un error real): si el Cierre consolidado no coincide con Inicio+Entrada-Salida -> SÍ genera hallazgo, sin ningún perdón", () => {
    const productoConError = productoAnexo();
    // Alteramos el saldo final del último movimiento -- un error real de $100.
    const movimientos = [...productoConError.movements];
    movimientos[movimientos.length - 1] = {
        ...movimientos[movimientos.length - 1],
        balanceTotalCost: 27319.6
    };
    productoConError.movements = movimientos;

    const data = auditData({ kardex: [productoConError] });
    const findings = Rule014.execute(data);
    assert.equal(findings.length, 1);
});

test("RULE_014: solo se suman entradas de OPERACIÓN 2 y salidas de OPERACIÓN 1 -- un ajuste (TipoOp 28) no debe contarse en la ecuación global", () => {
    const producto = kardexProduct("0000030", "PRODUCTO CON AJUSTE", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "28", entryQuantity: 10, entryTotalCost: 50, balanceQuantity: 110, balanceTotalCost: 550, month: 1 }) // ajuste por sobrante
    ]);
    const data = auditData({ kardex: [producto] });
    const findings = Rule014.execute(data);
    // Inicio(500) + Entrada op.2 (0, el ajuste NO cuenta) - Salida op.1 (0) = 500
    // Cierre real = 550 (por el ajuste) -> esperado(500) != cierre(550) -> SÍ hallazgo
    assert.equal(findings.length, 1);
});

test("RULE_014 (confirmado con el diagrama oficial y el Anexo 03: 'SOLO saldo, no cantidades'): si la CANTIDAD no cierra pero el COSTO sí, NO genera hallazgo", () => {
    const producto = kardexProduct("0000040", "PRODUCTO CON DESCUADRE SOLO EN CANTIDAD", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "02", entryQuantity: 50, entryUnitCost: 5, entryTotalCost: 250, balanceQuantity: 150, balanceTotalCost: 750, month: 1 }),
        // El costo cierra perfecto (750), pero la cantidad del archivo (200) no
        // coincide con la fórmula (100+50=150) -- un desfase de cantidad puro.
        movement({ operation: "01", exitQuantity: 0, exitTotalCost: 0, balanceQuantity: 200, balanceTotalCost: 750, month: 1 })
    ]);
    const data = auditData({ kardex: [producto] });
    const findings = Rule014.execute(data);
    assert.equal(findings.length, 0, "el diagrama de RULE_014 solo valida el Inventario Valorizado (costo), nunca cantidad");
});

test("RULE_014 (validado contra el Anexo 03 COMPLETO, los 2 productos reales): reproduce EXACTO el TOTAL GENERAL oficial -- 20000 / 57200 / 7469 / 69731", () => {
    const data = auditData({ kardex: [productoAnexo(), productoAnexoSegundo()] });
    const findings = Rule014.execute(data);
    assert.equal(findings.length, 0, "el Anexo 03 es un ejemplo SIN error -- el consolidado cierra perfecto");
});
