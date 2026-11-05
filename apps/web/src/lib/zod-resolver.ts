import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Custom Zod resolver untuk react-hook-form yang kompatibel penuh dengan Zod v4.
 * Menghindari bug pada `@hookform/resolvers/zod` v3 yang masih mengasumsikan Zod v3
 * (Zod 3 memakai `error.errors`, sedangkan Zod 4 memakai `error.issues`).
 */
export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: z.ZodType<TFieldValues, any, any>,
): Resolver<TFieldValues> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const errors: FieldErrors<TFieldValues> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') as keyof FieldErrors<TFieldValues>;
      if (!errors[path]) {
        errors[path] = {
          type: issue.code,
          message: issue.message,
        } as any;
      }
    }

    return {
      values: {},
      errors,
    } as any;
  };
}
