import { render, screen } from '@testing-library/react';
import { AttributeEditForm } from '../app/admin/taxonomia/taxonomy-edit-forms';

const attribute = {
  id: 'a1',
  categoryId: 'c1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Almacenamiento',
  code: 'almacenamiento',
  type: 'ENUM' as const,
  isRequired: false,
  isFilterable: true,
  isActive: true,
  options: [
    { id: 'o1', value: '64GB', isActive: true },
    { id: 'o2', value: '128GB', isActive: false },
  ],
};

describe('Formularios de edición de taxonomía', () => {
  it('muestra el código como campo deshabilitado con la ayuda de integridad', () => {
    render(
      <AttributeEditForm
        attribute={attribute}
        onCancel={() => null}
        onSave={async () => null}
        onToggleOption={() => Promise.resolve(null)}
        onAddOption={() => Promise.resolve(null)}
      />,
    );

    const code = screen.getByLabelText('Code') as HTMLInputElement;
    expect(code.disabled).toBe(true);
    expect(code.value).toBe('almacenamiento');
    expect(screen.getByText(/no se puede modificar por integridad de datos/i)).toBeTruthy();
  });

  it('marca las opciones inactivas y permite alternarlas', () => {
    render(
      <AttributeEditForm
        attribute={attribute}
        onCancel={() => null}
        onSave={async () => null}
        onToggleOption={() => Promise.resolve(null)}
        onAddOption={() => Promise.resolve(null)}
      />,
    );

    expect(screen.getByText('64GB')).toBeTruthy();
    expect(screen.getByText('128GB')).toBeTruthy();
    expect(
      screen.getAllByRole('button').some((button) => /restaurar/i.test(button.textContent ?? '')),
    ).toBe(true);
  });
});
