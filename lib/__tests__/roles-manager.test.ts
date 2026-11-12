import { describe, it, expect } from 'vitest';
import { managerProfileUpdate } from '../roles';

/**
 * Привязка учётной записи к менеджеру не должна понижать офисный
 * профиль до 'manager': у менеджера нет managers.view/managers.edit,
 * audit.view и export.view. Потеря этих прав делает невозможным
 * открыть раздел «Менеджеры» и отвязать себя.
 */
describe('managerProfileUpdate', () => {
  it('не понижает офисный профиль до manager', () => {
    expect(managerProfileUpdate('office', 'm1')).toEqual({ manager_id: 'm1' });
    expect(managerProfileUpdate('admin', 'm1')).toEqual({ manager_id: 'm1' });
  });

  it('назначает роль manager неофисному профилю', () => {
    expect(managerProfileUpdate('driver', 'm1')).toEqual({
      role: 'manager',
      manager_id: 'm1',
    });
    expect(managerProfileUpdate(null, 'm1')).toEqual({
      role: 'manager',
      manager_id: 'm1',
    });
  });

  it('всегда проставляет ссылку на карточку', () => {
    for (const role of ['office', 'admin', 'driver', 'manager', null, '']) {
      expect(managerProfileUpdate(role, 'm1').manager_id).toBe('m1');
    }
  });
});
