import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  type FormProviderProps,
  useFormContext,
} from "react-hook-form";

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Help } from "@/help/Help";
import { useHelp } from "@/help/useHelp";

// Optional namespace that turns on automatic help coverage for a form: every
// field derives a key of `form.<namespace>.<fieldName>` with no per-field work.
const HelpNamespaceContext = React.createContext<string | undefined>(undefined);

const Form = <
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>({
  helpNamespace,
  ...props
}: FormProviderProps<TFieldValues, TContext, TTransformedValues> & {
  helpNamespace?: string;
}) => {
  return (
    <HelpNamespaceContext.Provider value={helpNamespace}>
      <FormProvider {...props} />
    </HelpNamespaceContext.Provider>
  );
};

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props} />
      </FormItemContext.Provider>
    );
  }
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const { error, formItemId, name } = useFormField();
  const namespace = React.useContext(HelpNamespaceContext);
  // Automatic coverage: when a form sets `helpNamespace`, every field derives its
  // key here. If no registry entry exists, the label renders exactly as before —
  // no affordance, no gap, no warning.
  const helpKey = namespace ? `form.${namespace}.${name}` : "";
  const help = useHelp(helpKey);

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {helpKey && help.enabled && help.entry && (
        <Help k={helpKey} side="top">
          <button
            type="button"
            aria-label={`Help: ${help.entry.title || help.entry.body}`}
            onClick={(e) => e.preventDefault()}
            className="ml-1 inline-flex translate-y-[1px] align-middle text-muted-foreground/70 hover:text-muted-foreground focus:text-muted-foreground focus:outline-none"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </Help>
      )}
    </Label>
  );
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId, name } = useFormField();
  const namespace = React.useContext(HelpNamespaceContext);
  // Stamp the field's help key onto the control (separate from `data-help`, so it
  // only feeds the validation-failure signal, never the hover/discovery anchors).
  // Only when a registry entry actually exists, so nothing leaks onto bare fields.
  const helpKey = namespace ? `form.${namespace}.${name}` : "";
  const help = useHelp(helpKey);
  const fieldHelpKey = helpKey && help.enabled && help.entry ? helpKey : undefined;

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      data-help-field={fieldHelpKey}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
