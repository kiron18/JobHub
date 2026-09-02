import { Button } from './Button';

interface GhostButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
}

export function GhostButton({ label, onClick, disabled, small, type = 'button' }: GhostButtonProps) {
  return (
    <Button
      variant="ghost"
      size={small ? 'sm' : 'md'}
      label={label}
      onClick={onClick}
      disabled={disabled}
      type={type}
    />
  );
}
