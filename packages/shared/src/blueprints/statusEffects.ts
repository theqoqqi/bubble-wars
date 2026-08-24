import { Registry } from '../Registry.js';
import { StatusEffectDef } from '../types.js';

export const DEFAULT_STATUS_EFFECTS: StatusEffectDef[] = [
    {
        id: 'slow',
        name: 'Замедление',
        description: 'Снижает скорость передвижения',
    },
];

export const statusEffectRegistry = new Registry<StatusEffectDef>('StatusEffectRegistry');
