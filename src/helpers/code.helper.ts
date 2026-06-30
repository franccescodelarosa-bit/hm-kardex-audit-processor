export class CodeHelper {

    static normalize(code: string): string {

        return (code ?? "")
            .trim()
            .toUpperCase()
            .replace(/^0+/, "");

    }

}