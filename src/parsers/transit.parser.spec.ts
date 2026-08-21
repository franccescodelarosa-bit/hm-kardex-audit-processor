
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { TransitParser } from "./transit.parser";

async function buildTransitFile(): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("CLIENTE");

    for (let i = 1; i <= 6; i++) {
        sheet.addRow([]);
    }
    sheet.addRow([
        "ITEM", "FECHA", "FECCARGA", "COMPROBANTE", "CODIGOS",
        "RUC", "PROVEEDOR", "SUBTOTAL", "IGV", "FLETE", "OTROS", "COSTO ESPERADO"
    ]);

    const row = sheet.addRow([]);
    row.getCell(1).value = 1;
    row.getCell(2).value = new Date(2023, 11, 6);
    row.getCell(3).value = new Date(2024, 0, 4);
    row.getCell(4).value = "Fac-F001-501064";
    row.getCell(5).value = "00002525";
    row.getCell(6).value = "20136836545";
    row.getCell(7).value = "ARDILES SAC";
    row.getCell(8).value = 297.26; // SUBTOTAL
    row.getCell(9).value = 53.51;  // IGV
    row.getCell(10).value = 18.32; // FLETE
    row.getCell(11).value = 0;     // OTROS COSTOS
    // COSTO ESPERADO: formula rota, tal como el archivo real del cliente.
    row.getCell(12).value = { formula: "H8+I8", result: 350.77 } as any;

    const filePath = path.join(os.tmpdir(), `transit-test-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

test("TransitParser (reproduce el bug real): Costo Esperado se calcula como SUBTOTAL + IGV, sin depender de la fórmula rota del Excel", async () => {
    const filePath = await buildTransitFile();
    try {
        const items = await TransitParser.parse(filePath);
        assert.equal(items.length, 1);
        assert.equal(items[0].subtotal, 297.26);
        assert.equal(items[0].igv, 53.51);
        assert.equal(Number.isNaN(items[0].expectedCost), false, "expectedCost no debe ser NaN");
        assert.equal(items[0].expectedCost, 297.26 + 53.51);
    } finally {
        fs.unlinkSync(filePath);
    }
});

async function buildRealLayoutTransitFile(): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("CLIENTE");

    sheet.addRow(["COMERCIAL L&M EIRL"]);
    sheet.addRow(["JR. PROSPERO N° 880"]);
    sheet.addRow(["RUC Nº 20451412508", null, null, null, null, null, "MERCADERIA EN TRANSITO"]);
    sheet.addRow(["Fecha de Emision", null, null, "Del 01/12/2023 al 31/12/2023"]);
    sheet.addRow(["Fecha de Ingreso al Almacen", null, null, "Del 01/01/2024 al 20/01/2024"]);
    sheet.addRow([
        "ITEM", "FECHA", "FECCARGA", "COMPROBANTE", "CODIGOS (ITEN ADQUIRIDOS)",
        "RUC", "PROVEEDOR", "SUBTOTAL", "IGV", "FLETE", "OTROS", "COSTO ESPERADO"
    ]);

    const row = sheet.addRow([]);
    row.getCell(1).value = 1;
    row.getCell(2).value = new Date(2023, 11, 6);
    row.getCell(3).value = new Date(2024, 0, 4);
    row.getCell(4).value = "Fac-F001-501064";
    row.getCell(5).value = "´00002525 - 00007894 - ´00362541";
    row.getCell(6).value = "20136836545";
    row.getCell(7).value = "ARDILES SAC";
    row.getCell(8).value = 297.26;
    row.getCell(9).value = 0;
    row.getCell(10).value = 0;
    row.getCell(11).value = 0;

    const filePath = path.join(os.tmpdir(), `transit-real-layout-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}

test("TransitParser (reproduce el archivo real de COMERCIAL L&M EIRL): con encabezado en la fila 6, el primer item (fila 7) NO debe perderse", async () => {
    const filePath = await buildRealLayoutTransitFile();
    try {
        const items = await TransitParser.parse(filePath);
        assert.equal(items.length, 1, "El primer item del tránsito no debe descartarse solo porque el encabezado está una fila antes de lo asumido");
        assert.equal(items[0].document, "Fac-F001-501064");
        assert.equal(items[0].subtotal, 297.26);
    } finally {
        fs.unlinkSync(filePath);
    }
});
