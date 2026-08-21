import ExcelJS from "exceljs";
import { TransitItem } from "../models/transit-item";
import { ExcelCellHelper } from "../helpers/excel-cell.helper";
export class TransitParser {
    static async parse(filePath: string): Promise<TransitItem[]> {
        console.log(`Parsing transit: ${filePath}`);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        const items: TransitItem[] = [];

        let firstDataRow = 8;
        for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
            const headerCell = String(sheet.getRow(rowNumber).getCell(1).value ?? "").trim().toUpperCase();
            if (headerCell === "ITEM") {
                firstDataRow = rowNumber + 1;
                break;
            }
        }

        for (let rowNumber = firstDataRow; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            if (!row.getCell(1).value) {
                continue;
            }
            const subtotal = ExcelCellHelper.toNumber(row.getCell(8).value);
            const igv = ExcelCellHelper.toNumber(row.getCell(9).value);
            items.push({
                item: ExcelCellHelper.toNumber(row.getCell(1).value),
                issueDate: row.getCell(2).value as Date,
                warehouseDate: row.getCell(3).value as Date,
                document: String(row.getCell(4).value ?? ""),
                acquiredCodes: String(row.getCell(5).value ?? ""),
                supplierRuc: String(row.getCell(6).value ?? ""),
                supplier: String(row.getCell(7).value ?? ""),
                subtotal,
                igv,
                freight: ExcelCellHelper.toNumber(row.getCell(10).value),
                otherCosts: ExcelCellHelper.toNumber(row.getCell(11).value),
                expectedCost: subtotal + igv
            });
        }
        console.log(`Transit items: ${items.length}`);
        return items;
    }
}