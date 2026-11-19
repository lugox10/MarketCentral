import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { VerticalForm } from '../app/admin/taxonomia/taxonomy-forms';
import { PlanFormModal } from '../app/admin/planes/plan-form';
import type { Plan } from '../src/lib/business';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

const plan: Plan = {
  id: 'plan-1',
  code: 'BASE',
  name: 'Base',
  priceCop: 30000,
  currency: 'COP',
  maxListings: 30,
  maxCategories: 3,
  featuredSlots: 6,
  trialMonths: 0,
  trialDays: null,
  billingPeriodDays: 30,
  isActive: true,
};

function inputValue(input: HTMLElement): string {
  return (input as HTMLInputElement).value;
}

describe('aislamiento de estado en los formularios', () => {
  it('escribir en el formulario de vertical no vuelve a renderizar al padre', () => {
    let parentRenders = 0;

    function Harness(): React.ReactElement {
      parentRenders += 1;
      return <VerticalForm onCancel={() => undefined} onCreate={async () => null} />;
    }

    render(<Harness />);
    expect(parentRenders).toBe(1);

    const input = screen.getByLabelText('Nombre');
    fireEvent.change(input, { target: { value: 'P' } });
    fireEvent.change(input, { target: { value: 'Pr' } });
    fireEvent.change(input, { target: { value: 'Prenderías' } });

    expect(inputValue(input)).toBe('Prenderías');
    // El modal se re-renderiza, pero la página que lo abre (el padre) no.
    expect(parentRenders).toBe(1);
  });

  it('valida el nombre antes de llamar al API', async () => {
    const onCreate = jest.fn(async () => null);
    render(<VerticalForm onCancel={() => undefined} onCreate={onCreate} />);

    const form = document.getElementById('form-vertical');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(await screen.findByText(/al menos 2 caracteres/i)).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('el formulario de plan mantiene sus campos aislados del padre', async () => {
    let parentRenders = 0;
    const onSave = jest.fn(async () => null);

    function Harness(): React.ReactElement {
      parentRenders += 1;
      return <PlanFormModal plan={plan} onClose={() => undefined} onSave={onSave} />;
    }

    render(<Harness />);
    expect(parentRenders).toBe(1);

    const price = screen.getByLabelText('Precio (COP)');
    fireEvent.change(price, { target: { value: '35000' } });

    expect(inputValue(price)).toBe('35000');
    expect(parentRenders).toBe(1);

    const submit = screen
      .getAllByRole('button')
      .find((button) => /guardar/i.test(button.textContent ?? ''));
    expect(submit).toBeTruthy();
    fireEvent.click(submit!);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ priceCop: 35000, maxListings: 30, billingPeriodDays: 30 }),
    );
  });
});
