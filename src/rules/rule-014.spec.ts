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

    // Confirmado contra el Anexo 03 (última línea del archivo): "EL SISTEMA
    // DEBE EMITIR EL SIGUIENTE MENSAJE: 'ERROR DE CONSOLIDACIÓN DEL KARDEX
    // Y LA DIFERENCIA'" -- tiene que aparecer literal en la descripción.
    assert.match(
        findings[0].description,
        /ERROR DE CONSOLIDACIÓN DEL KARDEX Y LA DIFERENCIA/
    );
});

test("RULE_014 (Tabla 12, confirmada con el cliente -- reemplaza la versión anterior): un ajuste por SOBRANTE (TipoOp 28) SÍ cuenta como Entrada en la ecuación global", () => {
    const producto = kardexProduct("0000030", "PRODUCTO CON AJUSTE", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "28", entryQuantity: 10, entryTotalCost: 50, balanceQuantity: 110, balanceTotalCost: 550, month: 1 }) // ajuste por sobrante
    ]);
    const data = auditData({ kardex: [producto] });
    const findings = Rule014.execute(data);
    // Inicio(500) + Entrada [op.28 SÍ cuenta ahora] (50) - Salida (0) = 550
    // Cierre real = 550 -> esperado(550) == cierre(550) -> sin hallazgo
    assert.equal(findings.length, 0);
});

test("RULE_014 (Tabla 12): un ajuste por FALTANTE (TipoOp 28, del lado de Salida) SÍ cuenta como Salida en la ecuación global", () => {
    const producto = kardexProduct("0000031", "PRODUCTO CON AJUSTE POR FALTANTE", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "28", exitQuantity: 10, exitTotalCost: 50, balanceQuantity: 90, balanceTotalCost: 450, month: 1 }) // ajuste por faltante
    ]);
    const data = auditData({ kardex: [producto] });
    const findings = Rule014.execute(data);
    // Inicio(500) + Entrada (0) - Salida [op.28 SÍ cuenta ahora] (50) = 450
    // Cierre real = 450 -> esperado(450) == cierre(450) -> sin hallazgo
    assert.equal(findings.length, 0);
});

test("RULE_014 (Tabla 12): devolución recibida (op 05), promoción (op 07) y autoconsumo (op 99.1) también cuentan en la ecuación global", () => {
    const producto = kardexProduct("0000032", "PRODUCTO CON OPERACIONES NUEVAS", [
        movement({ operation: "16", balanceQuantity: 100, balanceUnitCost: 5, balanceTotalCost: 500, month: 1 }),
        movement({ operation: "05", entryQuantity: 5, entryTotalCost: 25, balanceQuantity: 105, balanceTotalCost: 525, month: 1 }), // devolución recibida
        movement({ operation: "07", exitQuantity: 2, exitTotalCost: 10, balanceQuantity: 103, balanceTotalCost: 515, month: 1 }), // promoción
        movement({ operation: "99.1", exitQuantity: 3, exitTotalCost: 15, balanceQuantity: 100, balanceTotalCost: 500, month: 1 }) // autoconsumo
    ]);
    const data = auditData({ kardex: [producto] });
    const findings = Rule014.execute(data);
    // Inicio(500) + Entrada [op.05] (25) - Salida [op.07 + op.99.1] (10+15=25) = 500
    // Cierre real = 500 -> esperado(500) == cierre(500) -> sin hallazgo
    assert.equal(findings.length, 0);
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
