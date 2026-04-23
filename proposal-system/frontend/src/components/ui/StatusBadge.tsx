import type { ProposalStatus } from '../../types';

interface StatusBadgeProps {
  status: ProposalStatus;
}

const statusConfig: Record<ProposalStatus, { label: string; className: string }> = {
  draft: {
    label: 'טיוטה',
    className: 'bg-gray-100 text-gray-700',
  },
  sent: {
    label: 'נשלח',
    className: 'bg-blue-100 text-blue-700',
  },
  signed: {
    label: 'נחתם',
    className: 'bg-green-100 text-green-700',
  },
  void: {
    label: 'בוטל',
    className: 'bg-red-100 text-red-700',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
