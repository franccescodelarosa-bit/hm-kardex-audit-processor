import ExcelJS from "exceljs";
import { InventoryItem } from "../models/inventory-item";
export class InventoryParser {
    static async parse(filePath: string): Promise<InventoryItem[]> {
        console.log(`Parsing ${filePath}`);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        const items: InventoryItem[] = [];
        for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber++) {
            const row = sheet.getRow(rowNumber);
            if (!row.getCell(1).value) {
                continue;
            }
            items.push({
                item: Number(row.getCell(1).value),
                family: String(row.getCell(2).value ?? ""),
                code: String(row.getCell(3).value ?? ""),
                product: String(row.getCell(4).value ?? ""),
                unit: String(row.getCell(5).value ?? ""),
                stock: Number(row.getCell(6).value ?? 0),
                unitCost: Number(row.getCell(7).value ?? 0),
                totalCost: Number(row.getCell(8).value ?? 0)
            });
        }
        console.log(`Inventory items: ${items.length}`);
        return items;
    }
}