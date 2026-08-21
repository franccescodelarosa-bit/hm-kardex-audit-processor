
export class ExcelCellHelper {
    static toNumber(value: unknown): number {
        if (value === null || value === undefined || value === "") {
            return 0;
        }

        if (typeof value === "object" && "result" in (value as object)) {
            return ExcelCellHelper.toNumber((value as { result: unknown }).result);
        }

        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
}
