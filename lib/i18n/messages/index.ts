import type { Locale } from '../config';
import type { Messages } from '../translate';
import { ru } from './ru';
import { pl } from './pl';
import { en } from './en';
import { uk } from './uk';

export const MESSAGES: Record<Locale, Messages> = { ru, pl, en, uk };
