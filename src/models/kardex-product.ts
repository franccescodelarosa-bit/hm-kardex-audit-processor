import { KardexMovement } from './kardex-movement';
export interface KardexProduct {
    code: string;
    description: string;
    unit: string;
    movements: KardexMovement[];
}