import { chakra } from '@chakra-ui/react';

/**
 * Dark-theme form primitives. `Box as="input"` keeps Box's div typings in
 * Chakra v3, so native props like `placeholder` and `value` are rejected —
 * these factory components carry the right element typings.
 */
const baseField = {
  width: '100%',
  bg: '#0a0e17',
  color: 'white',
  border: '1px solid',
  borderColor: '#374151',
  borderRadius: '8px',
  px: 3,
  py: 2,
  fontSize: 'sm',
  outline: 'none',
  transition: 'border-color 0.2s',
  _focus: { borderColor: '#25D366' },
  _placeholder: { color: '#4b5563' },
};

export const TextField = chakra('input', { base: baseField });

export const TextAreaField = chakra('textarea', {
  base: { ...baseField, lineHeight: '1.6', resize: 'vertical' },
});

export const SelectField = chakra('select', {
  base: {
    ...baseField,
    cursor: 'pointer',
    '& option': { background: '#111827', color: 'white' },
  },
});

/** Native button with Chakra styling — `as="button"` on Box rejects `type`. */
export const PlainButton = chakra('button');

/** Applied to date/time inputs so the browser picker renders dark. */
export const darkPicker = { colorScheme: 'dark' } as const;
