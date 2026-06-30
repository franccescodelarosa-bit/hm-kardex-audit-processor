export class DocumentHelper {

    static normalize(document: string): string {

        if (!document) {
            return "";
        }

        let value = document
            .toUpperCase()
            .replace(/^FAC-/, "")
            .replace(/^\d+\s+/, "")
            .trim();

        const match = value.match(/^([A-Z0-9]+)-?0*([0-9]+)$/);

        if (!match) {
            return value.replace(/[-\s]/g, "");
        }

        const serie = match[1];
        const correlativo = match[2].padStart(8, "0");

        return `${serie}${correlativo}`;
    }

}