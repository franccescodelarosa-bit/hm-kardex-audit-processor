import { AuditData } from "../models/audit-data";
import { Finding } from "../models/finding";

export class Rule004 {

    static execute(data: AuditData): Finding[] {

        // Pendiente de definición funcional.
        //
        // El archivo "Mercadería en Tránsito" únicamente contiene
        // información de comprobantes y proveedores.
        //
        // No contiene código de producto, cantidad ni detalle que
        // permita realizar un cruce confiable contra el Kardex.
        //
        // Se requiere validación funcional con el cliente.

        return [];
    }

}