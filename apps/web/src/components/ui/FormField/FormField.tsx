import type { ReactElement } from 'react'
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { Field, type ControlProps } from '../Field'

export interface FormFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> {
  control: Control<TValues>
  name: TName
  label: string
  hint?: string
  required?: boolean
  /**
   * Render the control, receiving react-hook-form's field state. Spread it onto
   * native inputs (`<Input {...field} />`) or map it for Radix controls
   * (`<Select value={field.value} onValueChange={field.onChange} />`).
   */
  children: (
    field: ControllerRenderProps<TValues, TName>,
  ) => ReactElement<ControlProps>
}

/**
 * Connects a design-system control to react-hook-form + Zod: a Controller drives
 * the field, and the Field surfaces the resolver's error message (with the
 * label/hint/aria wiring). The Zod schema stays the single source of truth.
 */
export function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({
  control,
  name,
  label,
  hint,
  required,
  children,
}: FormFieldProps<TValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          hint={hint}
          required={required}
          error={fieldState.error?.message}
        >
          {children(field)}
        </Field>
      )}
    />
  )
}
