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

    static excelSerialToDate(serial: number): Date {
        const utcDays = Math.floor(serial - 25569);
        const utcValue = utcDays * 86400;
        return new Date(utcValue * 1000);
    }

    static monthOf(date: Date): number {
        return date.getUTCMonth() + 1;
    }
}