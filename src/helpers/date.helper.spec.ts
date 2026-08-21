import { test } from "node:test";
import assert from "node:assert/strict";
import { DateHelper } from "./date.helper";

test("DateHelper.excelSerialToDate + monthOf (reproduce el bug real): 1 de febrero UTC no debe leerse como enero, sin importar la zona horaria de la máquina", () => {
    // Serial de Excel equivalente al 1/feb/2024 a medianoche UTC.
    const unMinutoDeUnDia = 1000 * 60 * 60 * 24;
    const utcDays = Date.UTC(2024, 1, 1) / unMinutoDeUnDia;
    const serial = utcDays + 25569;

    const date = DateHelper.excelSerialToDate(serial);

    assert.equal(
        DateHelper.monthOf(date),
        2,
        "la fecha 1/feb/2024 UTC debe calcular mes=2, sin importar en qué huso horario corra el proceso"
    );
});

test("DateHelper.monthOf: el 1 de diciembre UTC (fin de año) calcula mes=12 correctamente", () => {
    const date = new Date(Date.UTC(2024, 11, 1));
    assert.equal(DateHelper.monthOf(date), 12);
});

test("DateHelper.toDateString sigue funcionando igual que antes (regresión)", () => {
    assert.equal(DateHelper.toDateString(new Date(Date.UTC(2024, 0, 15))), "2024-01-15");
    assert.equal(DateHelper.toDateString(null), null);
});
