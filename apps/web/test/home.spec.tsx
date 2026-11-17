import { render, screen } from '@testing-library/react';

import HomePage from '../app/page';

describe('HomePage', () => {
  it('muestra el mensaje de construcción de MarketCentral', () => {
    render(<HomePage />);

    expect(screen.getByText('MarketCentral — en construcción')).toBeTruthy();
  });

  it('no muestra el botón de catálogo como accionable todavía', () => {
    render(<HomePage />);

    const button = screen.getByRole('button', { name: /explorar catálogo/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
