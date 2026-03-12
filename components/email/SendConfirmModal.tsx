import { Modal } from '@/components/ui/Modal'

interface SendConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function SendConfirmModal({ isOpen, onConfirm, onCancel, loading }: SendConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="서류를 전송하시겠습니까?"
      message="서명된 입사 서류 7종이 인사팀과 귀하의 이메일로 동시에 발송됩니다. 전송 후에는 취소할 수 없습니다."
      confirmLabel="전송하기"
      cancelLabel="취소"
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  )
}
