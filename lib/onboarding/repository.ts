import type { OnboardingCase, OnboardingCaseMetadataPatch } from '@/types/onboarding'

export interface OnboardingCaseRepository {
  findByEmployeeId(employeeId: string): Promise<OnboardingCase | null>
  initCase(employeeId: string, name: string, phone: string): Promise<void>
  updateMetadata(employeeId: string, patch: OnboardingCaseMetadataPatch): Promise<void>
}
