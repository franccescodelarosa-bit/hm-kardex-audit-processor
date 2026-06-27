import ExcelJS from "exceljs";
import { TransitItem } from "../models/transit-item";
export class TransitParser {
    static async parse(filePath: string): Promise<TransitItem[]> {
        console.log(`Parsing transit: ${filePath}`);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        const items: TransitItem[] = [];
        for (let rowNumber = 8; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            if (!row.getCell(1).value) {
                continue;
            }
            items.push({
                item: Number(row.getCell(1).value),
                issueDate: row.getCell(2).value as Date,
                warehouseDate: row.getCell(3).value as Date,
                document: String(row.getCell(4).value ?? ""),
                supplierRuc: String(row.getCell(5).value ?? ""),
                supplier: String(row.getCell(6).value ?? ""),
                subtotal: Number(row.getCell(7).value ?? 0),
                igv: Number(row.getCell(8).value ?? 0),
                freight: Number(row.getCell(9).value ?? 0),
                total: Number(row.getCell(10).value ?? 0)
            });
        }
        console.log(`Transit items: ${items.length}`);
        return items;
    }
}