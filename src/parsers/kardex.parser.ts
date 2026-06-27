import ExcelJS from "exceljs";
import { KardexProduct } from "../models/kardex-product";
enum ParserState {
    SEARCH_PRODUCT,
    READ_MOVEMENTS
}
export class KardexParser {
    static async parse(filePath: string): Promise<KardexProduct[]> {
        console.log(`Parsing kardex: ${filePath}`);
        const products: KardexProduct[] = [];
        const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
            entries: "emit",
            sharedStrings: "cache",
            styles: "ignore",
            hyperlinks: "ignore",
            worksheets: "emit"
        });
        for await (const worksheet of reader) {
            await this.parseWorksheet(worksheet, products);
        }
        if (products.length > 0) {
            const max = products.reduce(
                (a, b) => a.movements.length > b.movements.length ? a : b
            );
            console.log(max.code);
            console.log(max.movements.length);
        }
        return products;
    }

    private static async parseWorksheet( worksheet: any, products: KardexProduct[] ) {
        let state = ParserState.SEARCH_PRODUCT;
        let currentProduct: KardexProduct | null = null;
        for await (const row of worksheet) {
            switch (state) {
                case ParserState.SEARCH_PRODUCT:
                    if (this.isProduct(row)) {
                        currentProduct = this.parseProduct(row);
                        state = ParserState.READ_MOVEMENTS;
                    }
                    break;
                case ParserState.READ_MOVEMENTS:
                    if (!currentProduct)
                        break;
                    if (this.isTotals(row)) {
                        products.push(currentProduct);
                        currentProduct = null;
                        state = ParserState.SEARCH_PRODUCT;
                        break;
                    }
                    if (this.isMovement(row)) {
                        currentProduct.movements.push(
                            this.parseMovement(row)
                        );
                    }
                    break;
            }

        }
    }
    
    private static normalize(text: string): string {
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toUpperCase();
    }

    private static findText(row: any, startsWith: string): string {
        const expected = this.normalize(startsWith);
        for (const value of row.values) {
            const original = String(value ?? "").trim();
            if (this.normalize(original).startsWith(expected)) {
                return original;
            }
        }
        return "";
    }

    private static cell(row: any, index: number): string {
        return String(row.values[index] ?? "").trim();
    }

    private static isProduct(row: any): boolean {
        return this.findText(row, "Codigo:") !== "";
    }
    private static excelDateToJsDate(serial: number): Date {
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        return new Date(utcValue * 1000);
    }
    
    private static loggedMovementType = false;
    private static isMovement(row: any): boolean {
        const value = row.getCell(1).value;
        if (value && !this.loggedMovementType) {
            this.loggedMovementType = true;
            console.log(value);
        }
        return typeof value === "number";
    }

    private static isTotals(row: any): boolean {
        for (const value of row.values) {
            const current = String(value ?? "").trim();
            if (current.includes("Totales")) {
                return true;
            }
        }
        return false;
    }
    private static parseProduct(row: any): KardexProduct {
        const text = this.findText(row, "Codigo:");
        if (!text) {
            console.log("=================================");
            console.log("INVALID PRODUCT ROW");
            console.log(row.values);
            console.log("=================================");
            throw new Error("Invalid product row");
        }
        const match = text.match(/^C[oó]digo:\s*(\S+)\s+(.+)$/i);
        if (!match) {
            throw new Error(`Invalid product row: ${text}`);
        }
        const unitText = this.findText(row, "U.Med:");
        return {
            code: match[1],
            description: match[2],
            unit: unitText ? unitText.replace("U.Med:", "").trim() : "",
            movements: []
        };
    }
    private static number(row: any, index: number): number {
        const value = row.getCell(index).value;
        if (value === null || value === undefined || value === "")
            return 0;
        return Number(value);
    }

    private static parseMovement(row: any) {
        const serial = row.getCell(1).value as number;
        const date = this.excelDateToJsDate(serial);
        return {
            month: date.getMonth() + 1,
            date,
            document: this.cell(row,2),
            operation: this.cell(row,5),
            entryQuantity: this.number(row,6),
            entryUnitCost: this.number(row,7),
            entryTotalCost: this.number(row,8),
            exitQuantity: this.number(row,9),
            exitUnitCost: this.number(row,10),
            exitTotalCost: this.number(row,11),
            balanceQuantity: this.number(row,12),
            balanceUnitCost: this.number(row,13),
            balanceTotalCost: this.number(row,14)
        };
    }
}