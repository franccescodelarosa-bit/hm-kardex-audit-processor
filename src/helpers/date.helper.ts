export class DateHelper {
    static toDateString(date?: Date | string | null): string | null {
        if (!date) {
            return null;
        }
        if (date instanceof Date) {
            return date.toISOString().split("T")[0];
        }
        return String(date).split("T")[0];
    }
}