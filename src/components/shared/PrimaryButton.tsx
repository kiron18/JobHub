import { Button } from './Button';

/* Kept as a named wrapper because five files import it. The behaviour now
   comes from ./Button, so there is one button in the product, not four. */

interface PrimaryButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function PrimaryButton({ label, onClick, disabled, loading, small, type = 'button' }: PrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      size={small ? 'sm' : 'md'}
      label={label}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      loadingLabel="Working"
      type={type}
    />
  );
}
