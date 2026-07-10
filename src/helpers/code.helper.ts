export class CodeHelper {

    static normalize(code: string | number): string {

        const value = String(code ?? "")
            .trim()
            .toUpperCase();

        // Extraer el primer bloque numérico
        const match = value.match(/\d+/);

        if (!match) {
            return value;
        }

        return match[0].replace(/^0+/, "") || "0";
    }

}