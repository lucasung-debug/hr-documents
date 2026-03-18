import { z } from 'zod'
import { DOCUMENT_KEYS } from '@/types/document'

export const loginSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(50, '이름이 너무 깁니다'),
  phone: z
    .string()
    .regex(/^[0-9]{10,11}$/, '휴대전화번호는 숫자 10-11자리여야 합니다'),
})

export const signCaptureSchema = z.object({
  signatureBase64: z
    .string()
    .min(1, '서명 데이터가 없습니다')
    .refine(
      (val) => val.startsWith('data:image/png;base64,'),
      '서명은 PNG 형식이어야 합니다'
    ),
})

export const docConsentSchema = z.object({
  documentKey: z.enum(DOCUMENT_KEYS, {
    errorMap: () => ({ message: '유효하지 않은 서류 키입니다' }),
  }),
  signatureBase64: z
    .string()
    .refine((val) => val.startsWith('data:image/png;base64,'), 'PNG 형식이어야 합니다')
    .optional(),
})

export const generatePdfSchema = z.object({
  documentKey: z.enum(DOCUMENT_KEYS, {
    errorMap: () => ({ message: '유효하지 않은 서류 키입니다' }),
  }),
  signatureBase64: z
    .string()
    .refine((val) => val.startsWith('data:image/png;base64,'), 'PNG 형식이어야 합니다')
    .optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignCaptureInput = z.infer<typeof signCaptureSchema>
export type DocConsentInput = z.infer<typeof docConsentSchema>
export type GeneratePdfInput = z.infer<typeof generatePdfSchema>
