import { Button } from './Button';

interface SecondaryButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function SecondaryButton({ label, onClick, disabled, small, type = 'button' }: SecondaryButtonProps) {
  return (
    <Button
      variant="secondary"
      size={small ? 'sm' : 'md'}
      label={label}
      onClick={onClick}
      disabled={disabled}
      type={type}
    />
  );
}
